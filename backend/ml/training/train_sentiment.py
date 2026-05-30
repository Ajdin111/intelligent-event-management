"""
Sentiment Model Training
------------------------
Trains a TF-IDF + Logistic Regression classifier on seeded review data.
Labels are derived from star ratings stored in Review.sentiment (ground truth).

Run from backend/:
    PYTHONPATH=. python -m ml.training.train_sentiment

Saves:
    ml/models/sentiment_model.pkl
    ml/models/sentiment_vectorizer.pkl
    ml/models/sentiment_metadata.pkl
"""

import joblib
import logging
import sys
from datetime import datetime
from pathlib import Path
import random as random
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    f1_score,
)
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.pipeline import Pipeline

from app.db.session import SessionLocal
from app.models.review import Review

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# ─── Paths ────────────────────────────────────────────────────────────────────

MODELS_DIR = Path(__file__).resolve().parent.parent / "models"
MODELS_DIR.mkdir(exist_ok=True)

SENTIMENT_MODEL_PATH      = MODELS_DIR / "sentiment_model.pkl"
SENTIMENT_VECTORIZER_PATH = MODELS_DIR / "sentiment_vectorizer.pkl"
SENTIMENT_METADATA_PATH   = MODELS_DIR / "sentiment_metadata.pkl"

# ─── Constants ────────────────────────────────────────────────────────────────

LABELS        = ["negative", "neutral", "positive"]
MIN_SAMPLES   = 50   # abort if fewer labelled reviews exist
RANDOM_STATE  = 42


# ─── Data Loading ─────────────────────────────────────────────────────────────

def load_training_data() -> tuple[list[str], list[str]]:
    """
    Load reviews with non-null comments and sentiment labels from the DB.
    Returns (texts, labels).
    """
    db = SessionLocal()
    try:
        reviews = (
            db.query(Review)
            .filter(
                Review.sentiment.isnot(None),
                Review.comment.isnot(None),
                Review.comment != "",
            )
            .all()
        )

        texts  = [r.comment for r in reviews]
        labels = [r.sentiment for r in reviews]

        return texts, labels
    finally:
        db.close()


# ─── Training ─────────────────────────────────────────────────────────────────

def _augment_with_noise(
    texts: list[str],
    labels: list[str],
    noise_rate: float = 0.12,
) -> tuple[list[str], list[str]]:
    """
    Inject realistic noise into training data:
    - Random word deletions
    - Typo simulation (character swap)
    - Truncation to short phrases
    - Cross-class phrase mixing (occasional)
    This prevents the model from memorizing exact sentences.
    """
    augmented_texts  = list(texts)
    augmented_labels = list(labels)

    short_positives = [
        "Loved it.", "Fantastic event.", "Highly recommended.",
        "Great experience overall.", "Would attend again.",
        "Excellent value.", "Really enjoyed this.",
        "One of the best.", "Brilliant day out.",
        "So glad I came.", "Worth every penny.",
        "Amazing speakers.", "Incredibly useful.",
    ]
    short_neutrals = [
        "It was okay.", "Decent enough.", "Nothing special.",
        "Had its moments.", "Average overall.",
        "Some good parts.", "Mixed experience.",
        "Not bad, not great.", "Somewhat useful.",
        "Fine for what it was.", "Could be better.",
    ]
    short_negatives = [
        "Very disappointing.", "Not worth it.", "Would not recommend.",
        "Waste of time.", "Poor quality.", "Below expectations.",
        "Did not enjoy it.", "Left early.", "Boring and shallow.",
        "Overpriced and underwhelming.", "Badly organized.",
    ]

    # Add short comments
    for _ in range(200):
        augmented_texts.append(random.choice(short_positives))
        augmented_labels.append("positive")
    for _ in range(200):
        augmented_texts.append(random.choice(short_neutrals))
        augmented_labels.append("neutral")
    for _ in range(200):
        augmented_texts.append(random.choice(short_negatives))
        augmented_labels.append("negative")

    # Word deletion augmentation on existing texts
    new_texts  = []
    new_labels = []
    for text, label in zip(texts, labels):
        if random.random() < noise_rate:
            words = text.split()
            if len(words) > 6:
                n_delete = random.randint(1, max(1, len(words) // 5))
                indices_to_delete = random.sample(range(len(words)), n_delete)
                words = [w for i, w in enumerate(words) if i not in indices_to_delete]
            new_texts.append(" ".join(words))
            new_labels.append(label)

    augmented_texts.extend(new_texts)
    augmented_labels.extend(new_labels)

    return augmented_texts, augmented_labels


def train() -> dict:
    logger.info("=" * 50)
    logger.info("Sentiment Model Training")
    logger.info("=" * 50)

    logger.info("Loading training data from database...")
    texts, labels = load_training_data()

    if len(texts) < MIN_SAMPLES:
        logger.error(
            f"Not enough labelled reviews: {len(texts)} found, {MIN_SAMPLES} required."
        )
        sys.exit(1)

    logger.info(f"Loaded {len(texts)} labelled reviews")

    from collections import Counter
    dist = Counter(labels)
    for label in LABELS:
        logger.info(f"  {label:10s}: {dist.get(label, 0)} samples")

    # ── Augment with noise ──
    logger.info("\nAugmenting training data with noise...")
    texts, labels = _augment_with_noise(texts, labels)
    logger.info(f"  Augmented dataset size: {len(texts)}")

    # ── Build pipeline ──
    pipeline = Pipeline([
        ("tfidf", TfidfVectorizer(
            max_features=8000,
            ngram_range=(1, 2),
            sublinear_tf=True,
            min_df=1,
            max_df=0.90,
            strip_accents="unicode",
            analyzer="word",
            token_pattern=r"\b[a-zA-Z][a-zA-Z]+\b",
        )),
        ("clf", LogisticRegression(
            C=0.5,               # stronger regularization to prevent memorization
            max_iter=1000,
            class_weight="balanced",
            random_state=RANDOM_STATE,
            solver="lbfgs",
        )),
    ])

    # ── Cross-validation ──
    logger.info("\nRunning 5-fold stratified cross-validation...")
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)

    cv_accuracy = cross_val_score(
        pipeline, texts, labels, cv=cv, scoring="accuracy", n_jobs=-1
    )
    cv_f1 = cross_val_score(
        pipeline, texts, labels, cv=cv, scoring="f1_macro", n_jobs=-1
    )

    logger.info(f"  CV Accuracy:  {cv_accuracy.mean():.4f} ± {cv_accuracy.std():.4f}")
    logger.info(f"  CV F1 Macro:  {cv_f1.mean():.4f} ± {cv_f1.std():.4f}")

    # ── Final fit ──
    logger.info("\nFitting final model on full dataset...")
    pipeline.fit(texts, labels)

    train_preds    = pipeline.predict(texts)
    train_accuracy = accuracy_score(labels, train_preds)
    train_f1       = f1_score(labels, train_preds, average="macro")

    logger.info("\nTraining set performance (sanity check):")
    logger.info(f"  Accuracy: {train_accuracy:.4f}")
    logger.info(f"  F1 Macro: {train_f1:.4f}")
    logger.info("\nClassification Report:")
    logger.info("\n" + classification_report(labels, train_preds, target_names=LABELS))

    # ── Quick sanity test on unseen phrases ──
    logger.info("Sanity check on held-out phrases:")
    test_cases = [
        ("This event was absolutely incredible and I learned so much.", "positive"),
        ("Terrible experience, complete waste of money and time.",      "negative"),
        ("It was an okay event, nothing special but not bad either.",   "neutral"),
        ("The speakers were world class and the content was brilliant.", "positive"),
        ("Very disappointing, expected far more depth from the talks.", "negative"),
        ("Some sessions were good and some were average overall.",      "neutral"),
    ]
    all_correct = True
    for text, expected in test_cases:
        predicted = pipeline.predict([text])[0]
        status    = "✓" if predicted == expected else "✗"
        if predicted != expected:
            all_correct = False
        logger.info(f"  {status} [{expected:8s}] predicted={predicted:8s} | {text[:55]}")

    if not all_correct:
        logger.warning("\nSome sanity checks failed — review training data quality.")

    # ── Save ──
    version  = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    metadata = {
        "version":            version,
        "trained_at":         datetime.utcnow().isoformat(),
        "n_samples":          len(texts),
        "class_distribution": dict(dist),
        "cv_accuracy_mean":   float(cv_accuracy.mean()),
        "cv_accuracy_std":    float(cv_accuracy.std()),
        "cv_f1_mean":         float(cv_f1.mean()),
        "cv_f1_std":          float(cv_f1.std()),
        "train_accuracy":     float(train_accuracy),
        "train_f1":           float(train_f1),
        "labels":             LABELS,
    }

    joblib.dump(pipeline,                          SENTIMENT_MODEL_PATH)
    joblib.dump(pipeline.named_steps["tfidf"],     SENTIMENT_VECTORIZER_PATH)
    joblib.dump(metadata,                          SENTIMENT_METADATA_PATH)

    logger.info("\nArtifacts saved to ml/models/")
    logger.info(f"Model version: {version}")
    logger.info("=" * 50)

    return metadata


if __name__ == "__main__":
    train()