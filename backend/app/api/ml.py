from datetime import datetime
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db, require_admin
from app.models.user import User
from app.services import ml as ml_service

router = APIRouter(prefix="/api/ml", tags=["ML"])


# ── Response schemas ────────────────────────────────────────────────────────


class RecommendationItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    event_id: int
    score: Decimal
    reason: Optional[str] = None
    generated_at: datetime


class DemandForecastResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

    event_id: int
    ticket_tier_id: Optional[int] = None
    predicted_demand: int
    predicted_sellout_date: Optional[datetime] = None
    confidence_score: Optional[Decimal] = None
    price_action: Optional[str] = None
    price_suggestion: Optional[Decimal] = None
    generated_at: datetime


class SentimentResponse(BaseModel):
    total_reviews: int
    positive_pct: float
    neutral_pct: float
    negative_pct: float
    top_keywords: list[str]


class RetrainResponse(BaseModel):
    message: str
    task_id: str


class ModelStatusResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    sentiment: bool
    demand: bool
    recommender: bool
    last_retrain_at: Optional[str] = None


# ── Endpoints ───────────────────────────────────────────────────────────────


@router.get("/recommendations", response_model=list[RecommendationItem])
def get_recommendations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return ml_service.get_recommendations(current_user.id, db)


@router.get("/demand/{event_id}", response_model=DemandForecastResponse)
def get_demand_forecast(
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return ml_service.get_demand_forecast(event_id, current_user, db)


@router.get("/sentiment/{event_id}", response_model=SentimentResponse)
def get_sentiment(
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return ml_service.get_sentiment_breakdown(event_id, current_user, db)


@router.post("/retrain", response_model=RetrainResponse)
def retrain(
    _admin: User = Depends(require_admin),
):
    return ml_service.trigger_retrain()


@router.get("/status", response_model=ModelStatusResponse)
def model_status(
    _admin: User = Depends(require_admin),
):
    return ml_service.get_model_status()
