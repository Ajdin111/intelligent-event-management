from pydantic import BaseModel, ConfigDict
from datetime import datetime
from decimal import Decimal
from typing import Optional, Literal


# ─── Demand Forecast Schemas ──────────────────────────────────────────

class MLDemandForecastResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=(), from_attributes=True)

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


class PriceSuggestionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    event_id: int
    current_price: Optional[Decimal] = None
    price_action: Optional[Literal["increase", "decrease", "optimal"]] = None
    price_suggestion: Optional[Decimal] = None
    fill_rate_prediction: Optional[float] = None
    generated_at: Optional[datetime] = None


# ─── Recommendation Schemas ───────────────────────────────────────────

class MLRecommendationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    event_id: int
    score: Decimal
    reason: Optional[str] = None
    generated_at: datetime
    expires_at: datetime


# ─── Model Status Schemas ─────────────────────────────────────────────

class ModelMetrics(BaseModel):
    accuracy: Optional[float] = None
    mae: Optional[float] = None
    coverage: Optional[float] = None
    f1_score: Optional[float] = None


class ModelStatusResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

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