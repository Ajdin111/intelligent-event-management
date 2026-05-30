"""
Demand Forecasting Model Training
----------------------------------
Trains a Gradient Boosting Regressor to predict total registrations
for an event based on its features.

Also computes price recommendations based on predicted fill rate.

Run from backend/:
    PYTHONPATH=. python -m ml.training.train_demand

Saves:
    ml/models/demand_model.pkl
    ml/models/demand_scaler.pkl
    ml/models/demand_encoder.pkl
    ml/models/demand_metadata.pkl
"""

import joblib
import logging
import sys
from datetime import datetime
from pathlib import Path

import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import KFold, cross_val_score
from sklearn.preprocessing import LabelEncoder, StandardScaler

from app.db.session import SessionLocal
from app.models.event import Event, EventCategory, Category
from app.models.registration import Registration
from app.models.ticket import TicketTier

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# ─── Paths ────────────────────────────────────────────────────────────────────

MODELS_DIR            = Path(__file__).resolve().parent.parent / "models"
MODELS_DIR.mkdir(exist_ok=True)

DEMAND_MODEL_PATH    = MODELS_DIR / "demand_model.pkl"
DEMAND_SCALER_PATH   = MODELS_DIR / "demand_scaler.pkl"
DEMAND_ENCODER_PATH  = MODELS_DIR / "demand_encoder.pkl"
DEMAND_METADATA_PATH = MODELS_DIR / "demand_metadata.pkl"

# ─── Constants ────────────────────────────────────────────────────────────────

MIN_SAMPLES  = 20
RANDOM_STATE = 42

CATEGORIES = [
    "AI & Machine Learning",
    "Web Development",
    "Cloud & DevOps",
    "Cybersecurity",
    "Data Science",
    "Product & Design",
    "Startup & Business",
    "Networking",
    "unknown",
]

LOCATION_TYPES     = ["physical", "online", "hybrid"]
REGISTRATION_TYPES = ["automatic", "manual", "invite_only"]


# ─── Feature Extraction ───────────────────────────────────────────────────────

def extract_features(
    event: Event,
    category_name: str,
    base_price: float,
    cat_encoder: LabelEncoder,
    loc_encoder: LabelEncoder,
    reg_encoder: LabelEncoder,
) -> list:
    now = datetime.utcnow()

    days_until_event = max(0, (event.start_datetime - now).days)
    day_of_week      = event.start_datetime.weekday()
    month            = event.start_datetime.month

    try:
        cat_encoded = cat_encoder.transform([category_name])[0]
    except ValueError:
        cat_encoded = cat_encoder.transform(["unknown"])[0]

    try:
        loc_encoded = loc_encoder.transform([event.location_type])[0]
    except ValueError:
        loc_encoded = 0

    try:
        reg_encoded = reg_encoder.transform([event.registration_type])[0]
    except ValueError:
        reg_encoded = 0

    return [
        cat_encoded,
        loc_encoded,
        int(event.is_free),
        float(base_price),
        float(event.capacity) if event.capacity else 0.0,
        float(days_until_event),
        float(day_of_week),
        float(month),
        reg_encoded,
        int(event.has_ticketing),
    ]


FEATURE_NAMES = [
    "category",
    "location_type",
    "is_free",
    "base_ticket_price",
    "event_capacity",
    "days_until_event",
    "day_of_week",
    "month",
    "registration_type",
    "has_ticketing",
]


# ─── Data Loading ─────────────────────────────────────────────────────────────

def load_training_data(
    cat_encoder: LabelEncoder,
    loc_encoder: LabelEncoder,
    reg_encoder: LabelEncoder,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Load past closed events with known final registration counts.
    Returns (X, y) where y = total confirmed registrations.
    """
    db = SessionLocal()
    try:
        now = datetime.utcnow()

        # Only use past events with known outcomes
        past_events = (
            db.query(Event)
            .filter(
                Event.status == "published",
                Event.end_datetime < now,
                Event.deleted_at.is_(None),
                Event.capacity.isnot(None),
            )
            .all()
        )

        X_rows = []
        y_vals = []

        for event in past_events:
            # Get category
            cat_link = (
                db.query(EventCategory)
                .filter(EventCategory.event_id == event.id)
                .first()
            )
            category_name = "unknown"
            if cat_link:
                cat = db.query(Category).filter(
                    Category.id == cat_link.category_id
                ).first()
                if cat:
                    category_name = cat.name

            # Get base price from ticket tier
            tier = (
                db.query(TicketTier)
                .filter(TicketTier.event_id == event.id)
                .first()
            )
            base_price = float(tier.price) if tier else 0.0

            # Final confirmed registration count (ground truth)
            final_registrations = (
                db.query(Registration)
                .filter(
                    Registration.event_id == event.id,
                    Registration.status == "confirmed",
                )
                .count()
            )

            # Skip events with zero registrations — likely test data
            if final_registrations == 0:
                continue

            features = extract_features(
                event=event,
                category_name=category_name,
                base_price=base_price,
                cat_encoder=cat_encoder,
                loc_encoder=loc_encoder,
                reg_encoder=reg_encoder,
            )

            X_rows.append(features)
            y_vals.append(float(final_registrations))

        return np.array(X_rows), np.array(y_vals)

    finally:
        db.close()


# ─── Training ─────────────────────────────────────────────────────────────────

def train() -> dict:
    logger.info("=" * 50)
    logger.info("Demand Forecasting Model Training")
    logger.info("=" * 50)

    # ── Fit encoders on known categories ──
    cat_encoder = LabelEncoder()
    cat_encoder.fit(CATEGORIES)

    loc_encoder = LabelEncoder()
    loc_encoder.fit(LOCATION_TYPES)

    reg_encoder = LabelEncoder()
    reg_encoder.fit(REGISTRATION_TYPES)

    encoders = {
        "category":          cat_encoder,
        "location_type":     loc_encoder,
        "registration_type": reg_encoder,
    }

    # ── Load data ──
    logger.info("Loading training data from database...")
    X, y = load_training_data(cat_encoder, loc_encoder, reg_encoder)

    if len(X) < MIN_SAMPLES:
        logger.error(
            f"Not enough events for training: {len(X)} found, "
            f"{MIN_SAMPLES} required."
        )
        sys.exit(1)

    logger.info(f"Loaded {len(X)} events for training")
    logger.info(f"  Target range:  {y.min():.0f} – {y.max():.0f} registrations")
    logger.info(f"  Target mean:   {y.mean():.1f}")
    logger.info(f"  Target median: {np.median(y):.1f}")

    # ── Scale features ──
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # ── Model ──
    model = GradientBoostingRegressor(
        n_estimators=200,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.8,
        min_samples_leaf=3,
        random_state=RANDOM_STATE,
    )

    # ── Cross-validation ──
    logger.info("\nRunning 5-fold cross-validation...")
    cv = KFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)

    cv_mae = -cross_val_score(
        model, X_scaled, y, cv=cv,
        scoring="neg_mean_absolute_error", n_jobs=-1
    )
    cv_r2 = cross_val_score(
        model, X_scaled, y, cv=cv,
        scoring="r2", n_jobs=-1
    )

    logger.info(f"  CV MAE:  {cv_mae.mean():.2f} ± {cv_mae.std():.2f}")
    logger.info(f"  CV R²:   {cv_r2.mean():.4f} ± {cv_r2.std():.4f}")

    # ── Final fit ──
    logger.info("\nFitting final model on full dataset...")
    model.fit(X_scaled, y)

    train_preds = model.predict(X_scaled)
    train_mae   = mean_absolute_error(y, train_preds)
    train_rmse  = np.sqrt(mean_squared_error(y, train_preds))
    train_r2    = r2_score(y, train_preds)

    logger.info("\nTraining set performance:")
    logger.info(f"  MAE:  {train_mae:.2f} registrations")
    logger.info(f"  RMSE: {train_rmse:.2f} registrations")
    logger.info(f"  R²:   {train_r2:.4f}")

    # ── Feature importance ──
    importances = model.feature_importances_
    logger.info("\nFeature importances:")
    sorted_idx = np.argsort(importances)[::-1]
    for i in sorted_idx:
        logger.info(f"  {FEATURE_NAMES[i]:30s}: {importances[i]:.4f}")

    # ── Save ──
    version  = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    metadata = {
        "version":        version,
        "trained_at":     datetime.utcnow().isoformat(),
        "n_samples":      len(X),
        "target_mean":    float(y.mean()),
        "target_median":  float(np.median(y)),
        "target_min":     float(y.min()),
        "target_max":     float(y.max()),
        "cv_mae_mean":    float(cv_mae.mean()),
        "cv_mae_std":     float(cv_mae.std()),
        "cv_r2_mean":     float(cv_r2.mean()),
        "cv_r2_std":      float(cv_r2.std()),
        "train_mae":      float(train_mae),
        "train_rmse":     float(train_rmse),
        "train_r2":       float(train_r2),
        "feature_names":  FEATURE_NAMES,
        "feature_importances": {
            FEATURE_NAMES[i]: float(importances[i])
            for i in range(len(FEATURE_NAMES))
        },
    }

    joblib.dump(model,    DEMAND_MODEL_PATH)
    joblib.dump(scaler,   DEMAND_SCALER_PATH)
    joblib.dump(encoders, DEMAND_ENCODER_PATH)
    joblib.dump(metadata, DEMAND_METADATA_PATH)

    logger.info("\nArtifacts saved to ml/models/")
    logger.info(f"Model version: {version}")
    logger.info("=" * 50)

    return metadata


if __name__ == "__main__":
    train()