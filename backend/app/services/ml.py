from datetime import datetime
from pathlib import Path

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.event import Event, EventCollaborator
from app.models.ml import MLDemandForecast, MLRecommendation
from app.models.review import Review
from app.models.user import User

MODELS_DIR = Path(__file__).resolve().parent.parent.parent / "ml" / "models"


def _assert_event_owner_or_collaborator(event_id: int, current_user: User, db: Session) -> Event:
    event = db.query(Event).filter(
        Event.id == event_id,
        Event.deleted_at.is_(None),
    ).first()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    is_owner = event.owner_id == current_user.id
    is_collaborator = (
        db.query(EventCollaborator)
        .filter(
            EventCollaborator.event_id == event_id,
            EventCollaborator.user_id == current_user.id,
        )
        .first()
        is not None
    )
    if not is_owner and not is_collaborator:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return event


def get_recommendations(user_id: int, db: Session) -> list[MLRecommendation]:
    now = datetime.utcnow()
    return (
        db.query(MLRecommendation)
        .filter(
            MLRecommendation.user_id == user_id,
            MLRecommendation.expires_at > now,
        )
        .order_by(MLRecommendation.score.desc())
        .limit(10)
        .all()
    )


def get_demand_forecast(event_id: int, current_user: User, db: Session) -> MLDemandForecast:
    _assert_event_owner_or_collaborator(event_id, current_user, db)

    forecast = (
        db.query(MLDemandForecast)
        .filter(MLDemandForecast.event_id == event_id)
        .order_by(MLDemandForecast.generated_at.desc())
        .first()
    )
    if not forecast:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No forecast available yet",
        )
    return forecast


def get_sentiment_breakdown(event_id: int, current_user: User, db: Session) -> dict:
    _assert_event_owner_or_collaborator(event_id, current_user, db)

    reviews = (
        db.query(Review)
        .filter(
            Review.event_id == event_id,
            Review.sentiment.isnot(None),
        )
        .all()
    )

    total = len(reviews)
    if total == 0:
        return {
            "total_reviews": 0,
            "positive_pct": 0.0,
            "neutral_pct": 0.0,
            "negative_pct": 0.0,
            "top_keywords": [],
        }

    positive_pct = sum(1 for r in reviews if r.sentiment == "positive") / total
    neutral_pct  = sum(1 for r in reviews if r.sentiment == "neutral")  / total
    negative_pct = sum(1 for r in reviews if r.sentiment == "negative") / total

    word_counts: dict[str, int] = {}
    for r in reviews:
        if r.comment:
            for word in r.comment.lower().split():
                if len(word) >= 4:
                    word_counts[word] = word_counts.get(word, 0) + 1
    top_keywords = sorted(word_counts, key=word_counts.get, reverse=True)[:5]

    return {
        "total_reviews": total,
        "positive_pct": round(positive_pct, 4),
        "neutral_pct":  round(neutral_pct,  4),
        "negative_pct": round(negative_pct, 4),
        "top_keywords": top_keywords,
    }


def trigger_retrain() -> dict:
    from app.tasks.ml import run_full_retrain

    task = run_full_retrain.delay()
    return {"message": "Retrain job enqueued", "task_id": str(task.id)}


def get_model_status() -> dict:
    last_retrain_at = None
    try:
        import redis as redis_lib
        from app.core.config import settings

        r = redis_lib.from_url(settings.REDIS_URL)
        val = r.get("ml:last_retrain_at")
        if val:
            last_retrain_at = val.decode()
    except Exception:
        pass

    return {
        "sentiment":      (MODELS_DIR / "sentiment_model.pkl").exists(),
        "demand":         (MODELS_DIR / "demand_model.pkl").exists(),
        "recommender":    (MODELS_DIR / "recommender_artifacts.pkl").exists(),
        "last_retrain_at": last_retrain_at,
    }
