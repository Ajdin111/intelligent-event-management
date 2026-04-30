"""
Sentiment Inference Module
--------------------------
Loads the trained sentiment pipeline and exposes a simple predict interface.
Used by Celery tasks when a review is submitted or updated.
"""

import logging
from pathlib import Path
from typing import Literal

import joblib

logger = logging.getLogger(__name__)

# ─── Paths ────────────────────────────────────────────────────────────────────

MODELS_DIR            = Path(__file__).resolve().parent.parent / "models"
SENTIMENT_MODEL_PATH  = MODELS_DIR / "sentiment_model.pkl"
SENTIMENT_METADATA_PATH = MODELS_DIR / "sentiment_metadata.pkl"

SentimentLabel = Literal["positive", "neutral", "negative"]

# ─── Model Cache ──────────────────────────────────────────────────────────────
# Pipeline is loaded once on first call and cached in memory.
# Celery workers load it once per process — not on every task.

_pipeline = None
_metadata = None


def _load_pipeline():
    global _pipeline, _metadata

    if _pipeline is not None:
        return _pipeline

    if not SENTIMENT_MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Sentiment model not found at {SENTIMENT_MODEL_PATH}. "
            "Run ml/training/train_sentiment.py first."
        )

    _pipeline = joblib.load(SENTIMENT_MODEL_PATH)
    _metadata = joblib.load(SENTIMENT_METADATA_PATH) if SENTIMENT_METADATA_PATH.exists() else {}
    logger.info(f"Sentiment model loaded (version: {_metadata.get('version', 'unknown')})")
    return _pipeline


# ─── Public Interface ─────────────────────────────────────────────────────────

def predict(comment: str) -> SentimentLabel:
    """
    Predict sentiment label for a single review comment.

    Args:
        comment: Raw review text string.

    Returns:
        One of: 'positive', 'neutral', 'negative'

    Raises:
        FileNotFoundError: If model artifacts have not been trained yet.
        ValueError: If comment is empty or None.
    """
    if not comment or not comment.strip():
        raise ValueError("Comment text cannot be empty.")

    pipeline = _load_pipeline()
    label = pipeline.predict([comment.strip()])[0]
    return label


def predict_batch(comments: list[str]) -> list[SentimentLabel]:
    """
    Predict sentiment for a list of comments in one pass.
    More efficient than calling predict() in a loop.

    Args:
        comments: List of review text strings.

    Returns:
        List of sentiment labels in the same order.
    """
    if not comments:
        return []

    pipeline = _load_pipeline()
    cleaned = [c.strip() if c else "" for c in comments]
    labels = pipeline.predict(cleaned)
    return list(labels)


def predict_with_confidence(comment: str) -> dict:
    """
    Predict sentiment with class probabilities.
    Useful for borderline cases and debugging.

    Returns:
        {
            "label": "positive",
            "confidence": 0.87,
            "probabilities": {"negative": 0.05, "neutral": 0.08, "positive": 0.87}
        }
    """
    if not comment or not comment.strip():
        raise ValueError("Comment text cannot be empty.")

    pipeline = _load_pipeline()
    proba = pipeline.predict_proba([comment.strip()])[0]
    classes = pipeline.classes_

    proba_dict = {cls: float(p) for cls, p in zip(classes, proba)}
    label = max(proba_dict, key=proba_dict.get)
    confidence = proba_dict[label]

    return {
        "label":         label,
        "confidence":    round(confidence, 4),
        "probabilities": {k: round(v, 4) for k, v in proba_dict.items()},
    }


def get_model_version() -> str | None:
    """Returns the version string of the currently loaded model."""
    if _metadata is None:
        try:
            _load_pipeline()
        except FileNotFoundError:
            return None
    return _metadata.get("version") if _metadata else None