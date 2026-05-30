"""
Demand Forecasting Inference Module
-------------------------------------
Loads the trained GradientBoostingRegressor and exposes prediction
and price recommendation interfaces.

Used by Celery tasks to populate ml_demand_forecasts table.
"""

import logging
from datetime import datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from typing import Optional

import joblib
import numpy as np

logger = logging.getLogger(__name__)

# ─── Paths ────────────────────────────────────────────────────────────────────

MODELS_DIR           = Path(__file__).resolve().parent.parent / "models"
DEMAND_MODEL_PATH    = MODELS_DIR / "demand_model.pkl"
DEMAND_SCALER_PATH   = MODELS_DIR / "demand_scaler.pkl"
DEMAND_ENCODER_PATH  = MODELS_DIR / "demand_encoder.pkl"
DEMAND_METADATA_PATH = MODELS_DIR / "demand_metadata.pkl"

# ─── Price recommendation thresholds ─────────────────────────────────────────

HIGH_DEMAND_THRESHOLD = 0.90   # fill rate above this → suggest price increase
PRICE_INCREASE_FACTOR = 1.15   # +15%

# ─── Model Cache ──────────────────────────────────────────────────────────────

_model    = None
_scaler   = None
_encoders = None
_metadata = None


def _load_artifacts():
    global _model, _scaler, _encoders, _metadata

    if _model is not None:
        return

    for path in [DEMAND_MODEL_PATH, DEMAND_SCALER_PATH, DEMAND_ENCODER_PATH]:
        if not path.exists():
            raise FileNotFoundError(
                f"Demand model artifact not found: {path}. "
                "Run ml/training/train_demand.py first."
            )

    _model    = joblib.load(DEMAND_MODEL_PATH)
    _scaler   = joblib.load(DEMAND_SCALER_PATH)
    _encoders = joblib.load(DEMAND_ENCODER_PATH)
    _metadata = joblib.load(DEMAND_METADATA_PATH) if DEMAND_METADATA_PATH.exists() else {}

    logger.info(
        f"Demand model loaded (version: {_metadata.get('version', 'unknown')})"
    )


# ─── Feature Builder ──────────────────────────────────────────────────────────

def _build_feature_vector(
    category_name: str,
    location_type: str,
    is_free: bool,
    base_price: float,
    capacity: int,
    start_datetime: datetime,
    registration_type: str,
    has_ticketing: bool,
) -> np.ndarray:
    """Build and scale the feature vector for inference."""
    _load_artifacts()

    now              = datetime.utcnow()
    days_until_event = max(0, (start_datetime - now).days)
    day_of_week      = start_datetime.weekday()
    month            = start_datetime.month

    cat_encoder = _encoders["category"]
    loc_encoder = _encoders["location_type"]
    reg_encoder = _encoders["registration_type"]

    try:
        cat_encoded = cat_encoder.transform([category_name])[0]
    except ValueError:
        cat_encoded = cat_encoder.transform(["unknown"])[0]

    try:
        loc_encoded = loc_encoder.transform([location_type])[0]
    except ValueError:
        loc_encoded = 0

    try:
        reg_encoded = reg_encoder.transform([registration_type])[0]
    except ValueError:
        reg_encoded = 0

    features = np.array([[
        cat_encoded,
        loc_encoded,
        int(is_free),
        float(base_price),
        float(capacity),
        float(days_until_event),
        float(day_of_week),
        float(month),
        reg_encoded,
        int(has_ticketing),
    ]])

    return _scaler.transform(features)


# ─── Price Recommendation ─────────────────────────────────────────────────────

def _compute_price_recommendation(
    predicted_demand: int,
    capacity: int,
    current_price: float,
) -> tuple[str, Decimal]:
    """
    Compute price action and suggested price based on predicted fill rate.

    Returns:
        (price_action, price_suggestion)
        price_action: 'increase' | 'optimal'
        price_suggestion: suggested price as Decimal
    """
    if capacity <= 0 or current_price <= 0:
        return "optimal", Decimal(str(current_price)).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )

    fill_rate = predicted_demand / capacity

    if fill_rate >= HIGH_DEMAND_THRESHOLD:
        action    = "increase"
        new_price = current_price * PRICE_INCREASE_FACTOR
    else:
        action    = "optimal"
        new_price = current_price

    suggestion = Decimal(str(round(new_price, 2))).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )

    return action, suggestion


# ─── Sellout Date ─────────────────────────────────────────────────────────────

def _compute_sellout_date(
    predicted_demand: int,
    capacity: int,
    current_registrations: int,
    published_at: datetime,
    start_datetime: datetime,
) -> Optional[datetime]:
    """
    Estimate sellout date from registration velocity.
    Returns None if event is not predicted to sell out.
    """
    if predicted_demand < capacity:
        return None

    now              = datetime.utcnow()
    days_since_open  = max(1, (now - published_at).days)
    velocity         = current_registrations / days_since_open  # regs per day

    if velocity <= 0:
        return None

    remaining    = max(0, capacity - current_registrations)
    days_to_sell = remaining / velocity

    sellout_date = now + timedelta(days=days_to_sell)

    # Sellout can't be after the event starts
    if sellout_date > start_datetime:
        return start_datetime - timedelta(days=1)

    return sellout_date


# ─── Public Interface ─────────────────────────────────────────────────────────

def predict(
    category_name: str,
    location_type: str,
    is_free: bool,
    base_price: float,
    capacity: int,
    start_datetime: datetime,
    registration_type: str,
    has_ticketing: bool,
    current_registrations: int = 0,
    published_at: Optional[datetime] = None,
    current_price: Optional[float] = None,
) -> dict:
    """
    Predict demand and compute price recommendation for an event.

    Returns:
        {
            "predicted_demand":       int,
            "confidence_score":       float (0-100),
            "predicted_sellout_date": datetime | None,
            "price_action":           str,
            "price_suggestion":       Decimal,
            "fill_rate_prediction":   float,
        }
    """
    _load_artifacts()

    X = _build_feature_vector(
        category_name=category_name,
        location_type=location_type,
        is_free=is_free,
        base_price=base_price,
        capacity=capacity,
        start_datetime=start_datetime,
        registration_type=registration_type,
        has_ticketing=has_ticketing,
    )

    raw_prediction   = float(_model.predict(X)[0])
    predicted_demand = max(0, min(int(round(raw_prediction)), capacity))

    fill_rate = predicted_demand / capacity if capacity > 0 else 0.0

    # Confidence: based on how extreme the fill rate is (clamped to 1.0 so
    # over-capacity predictions don't falsely read as 100% confident)
    clamped_fill_rate = min(fill_rate, 1.0)
    confidence = round(50.0 + abs(clamped_fill_rate - 0.5) * 90.0, 1)

    # Price recommendation
    effective_price = current_price if current_price is not None else base_price
    price_action, price_suggestion = _compute_price_recommendation(
        predicted_demand=predicted_demand,
        capacity=capacity,
        current_price=effective_price,
    )

    # Sellout date
    sellout_date = None
    if published_at:
        sellout_date = _compute_sellout_date(
            predicted_demand=predicted_demand,
            capacity=capacity,
            current_registrations=current_registrations,
            published_at=published_at,
            start_datetime=start_datetime,
        )

    return {
        "predicted_demand":       predicted_demand,
        "confidence_score":       confidence,
        "predicted_sellout_date": sellout_date,
        "price_action":           price_action,
        "price_suggestion":       price_suggestion,
        "fill_rate_prediction":   round(fill_rate, 4),
    }


def get_model_version() -> Optional[str]:
    """Returns the version string of the currently loaded model."""
    if _metadata is None:
        try:
            _load_artifacts()
        except FileNotFoundError:
            return None
    return _metadata.get("version") if _metadata else None