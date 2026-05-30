"""
Event Recommendation Model Training
-------------------------------------
Builds a hybrid recommender combining:
  1. Content-based filtering  (TF-IDF cosine similarity on event features)
  2. Collaborative filtering  (user-event matrix cosine similarity)
  3. Popularity fallback      (registration count per category)

Run from backend/:
    PYTHONPATH=. python -m ml.training.train_recommender

Saves:
    ml/models/recommender_artifacts.pkl
    ml/models/recommender_metadata.pkl
"""

import joblib
import logging
import sys
from datetime import datetime
from pathlib import Path

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import normalize

from app.db.session import SessionLocal
from app.models.event import Event, EventCategory, Category
from app.models.registration import Registration
from app.models.user import User

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# ─── Paths ────────────────────────────────────────────────────────────────────

MODELS_DIR                 = Path(__file__).resolve().parent.parent / "models"
MODELS_DIR.mkdir(exist_ok=True)

RECOMMENDER_ARTIFACTS_PATH = MODELS_DIR / "recommender_artifacts.pkl"
RECOMMENDER_METADATA_PATH  = MODELS_DIR / "recommender_metadata.pkl"

# ─── Constants ────────────────────────────────────────────────────────────────

MIN_EVENTS       = 5
RANDOM_STATE     = 42
TOP_N_DEFAULT    = 10   # default number of recommendations to return


# ─── Data Loading ─────────────────────────────────────────────────────────────

def load_data(db):
    """Load all published events and confirmed registrations."""

    events = (
        db.query(Event)
        .filter(
            Event.status == "published",
            Event.deleted_at.is_(None),
        )
        .all()
    )

    registrations = (
        db.query(Registration)
        .filter(Registration.status == "confirmed")
        .all()
    )

    users = db.query(User).filter(User.is_active.is_(True)).all()

    # Map event_id → category name
    category_map = {}
    for event in events:
        cat_link = (
            db.query(EventCategory)
            .filter(EventCategory.event_id == event.id)
            .first()
        )
        if cat_link:
            cat = db.query(Category).filter(
                Category.id == cat_link.category_id
            ).first()
            category_map[event.id] = cat.name if cat else "unknown"
        else:
            category_map[event.id] = "unknown"

    return events, registrations, users, category_map


# ─── Content Features ─────────────────────────────────────────────────────────

def build_content_features(
    events: list,
    category_map: dict,
) -> tuple[np.ndarray, TfidfVectorizer]:
    """
    Build TF-IDF matrix from event text features.
    Each event is represented as a document combining:
    title + category + location_type + registration_type
    Repeated tokens boost signal for important fields.
    """
    documents = []
    for event in events:
        category     = category_map.get(event.id, "unknown")
        location     = event.location_type or "physical"
        reg_type     = event.registration_type or "automatic"
        is_free_text = "free" if event.is_free else "paid"

        # Repeat category and location_type to boost their weight
        doc = (
            f"{event.title} "
            f"{category} {category} "
            f"{location} {location} "
            f"{reg_type} "
            f"{is_free_text}"
        )
        documents.append(doc.lower())

    vectorizer = TfidfVectorizer(
        max_features=500,
        ngram_range=(1, 2),
        sublinear_tf=True,
        min_df=1,
        strip_accents="unicode",
    )
    content_matrix = vectorizer.fit_transform(documents)

    return content_matrix, vectorizer


# ─── User-Event Matrix ────────────────────────────────────────────────────────

def build_user_event_matrix(
    users: list,
    events: list,
    registrations: list,
) -> np.ndarray:
    """
    Build a binary user × event interaction matrix.
    Matrix[i][j] = 1 if user i is registered for event j.
    """
    user_id_to_idx  = {u.id: i for i, u in enumerate(users)}
    event_id_to_idx = {e.id: j for j, e in enumerate(events)}

    n_users  = len(users)
    n_events = len(events)
    matrix   = np.zeros((n_users, n_events), dtype=np.float32)

    for reg in registrations:
        u_idx = user_id_to_idx.get(reg.user_id)
        e_idx = event_id_to_idx.get(reg.event_id)
        if u_idx is not None and e_idx is not None:
            matrix[u_idx][e_idx] = 1.0

    return matrix


# ─── Popularity Scores ────────────────────────────────────────────────────────

def build_popularity_scores(
    events: list,
    registrations: list,
    category_map: dict,
) -> tuple[np.ndarray, dict]:
    """
    Compute normalized popularity score per event and
    category → [event_indices] map for fallback recommendations.
    """
    event_id_to_idx = {e.id: i for i, e in enumerate(events)}
    reg_counts      = np.zeros(len(events), dtype=np.float32)

    for reg in registrations:
        idx = event_id_to_idx.get(reg.event_id)
        if idx is not None:
            reg_counts[idx] += 1

    # Normalize to 0-1
    max_count = reg_counts.max()
    if max_count > 0:
        popularity_scores = reg_counts / max_count
    else:
        popularity_scores = reg_counts

    # Category → list of event indices
    category_event_map = {}
    for event in events:
        cat = category_map.get(event.id, "unknown")
        category_event_map.setdefault(cat, []).append(
            event_id_to_idx[event.id]
        )

    return popularity_scores, category_event_map


# ─── Training / Building Artifacts ────────────────────────────────────────────

def train() -> dict:
    logger.info("=" * 50)
    logger.info("Recommender System Training")
    logger.info("=" * 50)

    db = SessionLocal()
    try:
        logger.info("Loading data from database...")
        events, registrations, users, category_map = load_data(db)
    finally:
        db.close()

    if len(events) < MIN_EVENTS:
        logger.error(
            f"Not enough events: {len(events)} found, {MIN_EVENTS} required."
        )
        sys.exit(1)

    logger.info(f"  Events:        {len(events)}")
    logger.info(f"  Users:         {len(users)}")
    logger.info(f"  Registrations: {len(registrations)}")

    # ── Content matrix ──
    logger.info("\nBuilding content-based similarity matrix...")
    content_matrix, vectorizer = build_content_features(events, category_map)
    content_similarity = cosine_similarity(content_matrix)
    logger.info(f"  Content matrix shape: {content_matrix.shape}")

    # ── User-event matrix ──
    logger.info("\nBuilding user-event interaction matrix...")
    user_event_matrix = build_user_event_matrix(users, events, registrations)
    logger.info(f"  User-event matrix shape: {user_event_matrix.shape}")

    # Registration density
    n_interactions = int(user_event_matrix.sum())
    density = n_interactions / (len(users) * len(events)) if len(users) * len(events) > 0 else 0
    logger.info(f"  Interactions: {n_interactions}")
    logger.info(f"  Matrix density: {density:.4f}")

    # ── Collaborative similarity ──
    # Normalize rows before cosine similarity so user activity level
    # doesn't dominate — a user with 1 registration is as comparable
    # as a user with 20 registrations
    logger.info("\nBuilding collaborative filtering similarity matrix...")
    user_event_normalized = normalize(user_event_matrix, norm="l2")
    event_collab_similarity = cosine_similarity(
        user_event_normalized.T   # event × event similarity via shared users
    )
    logger.info(f"  Collaborative similarity matrix: {event_collab_similarity.shape}")

    # ── Popularity scores ──
    logger.info("\nComputing popularity scores...")
    popularity_scores, category_event_map = build_popularity_scores(
        events, registrations, category_map
    )
    logger.info(f"  Categories mapped: {len(category_event_map)}")

    # ── Index maps ──
    event_id_to_idx = {e.id: i for i, e in enumerate(events)}
    idx_to_event_id = {i: e.id for i, e in enumerate(events)}
    user_id_to_idx  = {u.id: i for i, u in enumerate(users)}

    # ── Coverage metric ──
    # What fraction of users have at least one registration (can get collab recs)
    users_with_history = int((user_event_matrix.sum(axis=1) >= 2).sum())
    coverage = users_with_history / len(users) if len(users) > 0 else 0
    logger.info("\nCoverage:")
    logger.info(f"  Users with ≥2 registrations (collaborative eligible): {users_with_history}")
    logger.info(f"  Coverage: {coverage:.2%}")

    # ── Save artifacts ──
    version = datetime.utcnow().strftime("%Y%m%d_%H%M%S")

    artifacts = {
        "content_similarity":    content_similarity,
        "collab_similarity":     event_collab_similarity,
        "user_event_matrix":     user_event_matrix,
        "popularity_scores":     popularity_scores,
        "category_event_map":    category_event_map,
        "event_id_to_idx":       event_id_to_idx,
        "idx_to_event_id":       idx_to_event_id,
        "user_id_to_idx":        user_id_to_idx,
        "category_map":          category_map,
        "vectorizer":            vectorizer,
        "version":               version,
    }

    metadata = {
        "version":           version,
        "trained_at":        datetime.utcnow().isoformat(),
        "n_events":          len(events),
        "n_users":           len(users),
        "n_registrations":   len(registrations),
        "matrix_density":    float(density),
        "coverage":          float(coverage),
        "n_categories":      len(category_event_map),
    }

    joblib.dump(artifacts, RECOMMENDER_ARTIFACTS_PATH)
    joblib.dump(metadata,  RECOMMENDER_METADATA_PATH)

    logger.info("\nArtifacts saved to ml/models/")
    logger.info(f"Model version: {version}")
    logger.info("=" * 50)

    return metadata


if __name__ == "__main__":
    train()