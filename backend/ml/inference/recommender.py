"""
Recommender Inference Module
------------------------------
Loads pre-built similarity matrices and generates hybrid event
recommendations for a given user.

Recommendation strategy:
  - User has ≥2 registrations → weighted hybrid (collaborative + content + popularity)
  - User has 1 registration   → content-based + popularity
  - New user (0 registrations) → popularity fallback by category

Used by Celery tasks to populate ml_recommendations table.
"""

import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import joblib
import numpy as np

logger = logging.getLogger(__name__)

# ─── Paths ────────────────────────────────────────────────────────────────────

MODELS_DIR                 = Path(__file__).resolve().parent.parent / "models"
RECOMMENDER_ARTIFACTS_PATH = MODELS_DIR / "recommender_artifacts.pkl"
RECOMMENDER_METADATA_PATH  = MODELS_DIR / "recommender_metadata.pkl"

# ─── Blend weights ────────────────────────────────────────────────────────────

WEIGHTS_FULL_HISTORY = {
    "collaborative": 0.50,
    "content":       0.30,
    "popularity":    0.20,
}

WEIGHTS_PARTIAL_HISTORY = {
    "collaborative": 0.00,
    "content":       0.60,
    "popularity":    0.40,
}

WEIGHTS_NO_HISTORY = {
    "collaborative": 0.00,
    "content":       0.00,
    "popularity":    1.00,
}

# ─── Recommendation expiry ────────────────────────────────────────────────────

RECOMMENDATION_TTL_HOURS = 24

# ─── Model Cache ──────────────────────────────────────────────────────────────

_artifacts = None
_metadata  = None


def _load_artifacts():
    global _artifacts, _metadata

    if _artifacts is not None:
        return

    if not RECOMMENDER_ARTIFACTS_PATH.exists():
        raise FileNotFoundError(
            f"Recommender artifacts not found at {RECOMMENDER_ARTIFACTS_PATH}. "
            "Run ml/training/train_recommender.py first."
        )

    _artifacts = joblib.load(RECOMMENDER_ARTIFACTS_PATH)
    _metadata  = joblib.load(RECOMMENDER_METADATA_PATH) if RECOMMENDER_METADATA_PATH.exists() else {}

    logger.info(
        f"Recommender loaded (version: {_artifacts.get('version', 'unknown')})"
    )


# ─── Score Computation ────────────────────────────────────────────────────────

def _get_user_registered_indices(user_id: int) -> list[int]:
    """Return list of event indices the user is already registered for."""
    _load_artifacts()
    user_event_matrix = _artifacts["user_event_matrix"]
    user_id_to_idx    = _artifacts["user_id_to_idx"]

    u_idx = user_id_to_idx.get(user_id)
    if u_idx is None:
        return []

    return list(np.where(user_event_matrix[u_idx] > 0)[0])


def _collaborative_scores(user_id: int) -> np.ndarray:
    """
    Compute collaborative score for each event based on
    similarity to events the user has already registered for.
    """
    _load_artifacts()
    collab_sim        = _artifacts["collab_similarity"]
    n_events          = collab_sim.shape[0]
    registered_indices = _get_user_registered_indices(user_id)

    if not registered_indices:
        return np.zeros(n_events)

    # Average similarity across all events the user registered for
    scores = collab_sim[registered_indices].mean(axis=0)
    return scores


def _content_scores(user_id: int) -> np.ndarray:
    """
    Compute content-based score for each event based on
    similarity to events the user has registered for.
    """
    _load_artifacts()
    content_sim        = _artifacts["content_similarity"]
    n_events           = content_sim.shape[0]
    registered_indices = _get_user_registered_indices(user_id)

    if not registered_indices:
        return np.zeros(n_events)

    scores = content_sim[registered_indices].mean(axis=0)
    return scores


def _popularity_scores() -> np.ndarray:
    """Return pre-computed normalized popularity scores."""
    _load_artifacts()
    return _artifacts["popularity_scores"].copy()


def _determine_reason(
    collab_score: float,
    content_score: float,
    popularity_score: float,
    n_registrations: int,
) -> str:
    """
    Determine the primary reason for a recommendation.
    Maps to the reason field in ml_recommendations.
    """
    if n_registrations >= 2:
        if collab_score >= content_score and collab_score >= popularity_score:
            return "based_on_history"
        elif content_score >= popularity_score:
            return "similar_events"
        else:
            return "popular_in_category"
    elif n_registrations == 1:
        if content_score >= popularity_score:
            return "similar_events"
        else:
            return "popular_in_category"
    else:
        return "popular_in_category"


# ─── Public Interface ─────────────────────────────────────────────────────────

def recommend(
    user_id: int,
    top_n: int = 10,
    exclude_registered: bool = True,
    future_only: bool = True,
) -> list[dict]:
    """
    Generate event recommendations for a user.

    Args:
        user_id:            Target user ID.
        top_n:              Number of recommendations to return.
        exclude_registered: Exclude events the user is already registered for.
        future_only:        Only recommend upcoming events.

    Returns:
        List of dicts ordered by score descending:
        [
            {
                "event_id":   int,
                "score":      float (0.0-1.0),
                "reason":     str,
                "expires_at": datetime,
            },
            ...
        ]
    """
    _load_artifacts()

    idx_to_event_id   = _artifacts["idx_to_event_id"]

    registered_indices = _get_user_registered_indices(user_id)
    n_registrations    = len(registered_indices)

    # ── Determine blend weights ──
    if n_registrations >= 2:
        weights = WEIGHTS_FULL_HISTORY
    elif n_registrations == 1:
        weights = WEIGHTS_PARTIAL_HISTORY
    else:
        weights = WEIGHTS_NO_HISTORY

    # ── Compute component scores ──
    collab_scores     = _collaborative_scores(user_id)
    content_scores    = _content_scores(user_id)
    popularity_scores = _popularity_scores()

    # ── Blend ──
    final_scores = (
        weights["collaborative"] * collab_scores +
        weights["content"]       * content_scores +
        weights["popularity"]    * popularity_scores
    )

    # ── Filter already registered events ──
    if exclude_registered and registered_indices:
        final_scores[registered_indices] = -1.0

    # ── Rank ──
    ranked_indices = np.argsort(final_scores)[::-1]

    results    = []
    expires_at = datetime.now() + timedelta(hours=RECOMMENDATION_TTL_HOURS)

    for idx in ranked_indices:
        if len(results) >= top_n:
            break

        if final_scores[idx] < 0:
            continue

        event_id     = idx_to_event_id.get(int(idx))
        if event_id is None:
            continue

        c_score = float(collab_scores[idx])
        t_score = float(content_scores[idx])
        p_score = float(popularity_scores[idx])

        reason = _determine_reason(c_score, t_score, p_score, n_registrations)
        score  = round(float(final_scores[idx]), 4)

        results.append({
            "event_id":   event_id,
            "score":      score,
            "reason":     reason,
            "expires_at": expires_at,
        })

    return results


def recommend_for_new_user(
    preferred_categories: Optional[list[str]] = None,
    top_n: int = 10,
) -> list[dict]:
    """
    Generate recommendations for a user not yet in the system
    (not in user_event_matrix) based on popularity within
    preferred categories.

    Args:
        preferred_categories: Optional list of category names to filter by.
        top_n:                Number of recommendations to return.
    """
    _load_artifacts()

    popularity_scores  = _popularity_scores()
    category_event_map = _artifacts["category_event_map"]
    idx_to_event_id    = _artifacts["idx_to_event_id"]
    expires_at         = datetime.now() + timedelta(hours=RECOMMENDATION_TTL_HOURS)

    if preferred_categories:
        candidate_indices = []
        for cat in preferred_categories:
            candidate_indices.extend(category_event_map.get(cat, []))
        candidate_indices = list(set(candidate_indices))
    else:
        candidate_indices = list(idx_to_event_id.keys())

    if not candidate_indices:
        candidate_indices = list(idx_to_event_id.keys())

    # Sort by popularity
    sorted_indices = sorted(
        candidate_indices,
        key=lambda i: popularity_scores[i],
        reverse=True,
    )

    results = []
    for idx in sorted_indices[:top_n]:
        event_id = idx_to_event_id.get(int(idx))
        if event_id is None:
            continue
        results.append({
            "event_id":   event_id,
            "score":      round(float(popularity_scores[idx]), 4),
            "reason":     "popular_in_category",
            "expires_at": expires_at,
        })

    return results


def get_model_version() -> Optional[str]:
    """Returns the version string of the currently loaded artifacts."""
    if _artifacts is None:
        try:
            _load_artifacts()
        except FileNotFoundError:
            return None
    return _artifacts.get("version") if _artifacts else None