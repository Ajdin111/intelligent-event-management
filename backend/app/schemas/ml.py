from pydantic import BaseModel
from datetime import datetime
from decimal import Decimal
from typing import Optional, Literal


# ─── Demand Forecast Schemas ──────────────────────────────────────────

class MLDemandForecastResponse(BaseModel):
    id: int
    event_id: int
    ticket_tier_id: Optional[int] = None
    predicted_demand: int
    predicted_sellout_date: Optional[datetime] = None
    confidence_score: Optional[Decimal] = None
    price_action: Optional[Literal["increase", "decrease", "optimal"]] = None
    price_suggestion: Optional[Decimal] = None
    model_version: Optional[str] = None
    generated_at: datetime

    class Config:
        from_attributes = True


class PriceSuggestionResponse(BaseModel):
    event_id: int
    current_price: Optional[Decimal] = None
    price_action: Optional[Literal["increase", "decrease", "optimal"]] = None
    price_suggestion: Optional[Decimal] = None
    fill_rate_prediction: Optional[float] = None
    generated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ─── Recommendation Schemas ───────────────────────────────────────────

class MLRecommendationResponse(BaseModel):
    id: int
    user_id: int
    event_id: int
    score: Decimal
    reason: Optional[str] = None
    generated_at: datetime
    expires_at: datetime

    class Config:
        from_attributes = True


# ─── Model Status Schemas ─────────────────────────────────────────────

class ModelMetrics(BaseModel):
    accuracy: Optional[float] = None       # sentiment
    mae: Optional[float] = None            # demand forecasting
    coverage: Optional[float] = None       # recommender
    f1_score: Optional[float] = None       # sentiment


class ModelStatusResponse(BaseModel):
    model_name: str
    version: Optional[str] = None
    last_trained_at: Optional[datetime] = None
    metrics: Optional[ModelMetrics] = None
    record_count_at_train: Optional[int] = None


# ─── Retrain Schemas ──────────────────────────────────────────────────

class RetrainResponse(BaseModel):
    triggered: bool
    task_id: Optional[str] = None
    message: str