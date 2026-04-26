# backend/app/services/review.py
from datetime import datetime
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.user import User
from app.models.event import Event
from app.models.review import Review
from app.models.registration import Registration
from app.schemas.review import ReviewCreateRequest, ReviewUpdateRequest


def _normalize_dt(dt: datetime) -> datetime:
    if dt is None:
        return None
    return dt.replace(tzinfo=None)


def _get_event_or_404(db: Session, event_id: int) -> Event:
    event = db.query(Event).filter(
        Event.id == event_id,
        Event.deleted_at.is_(None)
    ).first()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    return event


def create_or_update_review(
    db: Session,
    data: ReviewCreateRequest,
    current_user: User
) -> Review:
    event = _get_event_or_404(db, data.event_id)

    if _normalize_dt(datetime.now()) < _normalize_dt(event.end_datetime):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You can only review an event after it has ended"
        )

    registration = db.query(Registration).filter(
        Registration.event_id == data.event_id,
        Registration.user_id == current_user.id,
        Registration.status == "confirmed"
    ).first()

    if not registration:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must have attended this event to leave a review"
        )

    existing = db.query(Review).filter(
        Review.event_id == data.event_id,
        Review.user_id == current_user.id
    ).first()

    if existing:
        existing.rating = data.rating
        existing.comment = data.comment
        existing.is_anonymous = data.is_anonymous
        existing.updated_at = datetime.now()
        db.commit()
        db.refresh(existing)
        if existing.is_anonymous:
            existing.user_id = None
        return existing

    review = Review(
        event_id=data.event_id,
        user_id=current_user.id,
        rating=data.rating,
        comment=data.comment,
        is_anonymous=data.is_anonymous,
        sentiment=None
    )
    db.add(review)
    db.commit()
    db.refresh(review)

    if review.is_anonymous:
        review.user_id = None

    return review


def get_event_reviews(
    db: Session,
    event_id: int,
    current_user: User = None
) -> list[Review]:
    event = _get_event_or_404(db, event_id)

    if event.feedback_visibility == "organizer_only":
        if current_user is None or event.owner_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Reviews for this event are not public"
            )

    reviews = db.query(Review).filter(
        Review.event_id == event_id
    ).order_by(Review.created_at.desc()).all()

    for review in reviews:
        if review.is_anonymous:
            review.user_id = None

    return reviews


def delete_review(
    db: Session,
    review_id: int,
    current_user: User
) -> None:
    review = db.query(Review).filter(Review.id == review_id).first()

    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review not found"
        )

    if review.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own review"
        )

    db.delete(review)
    db.commit()


def get_my_review(
    db: Session,
    event_id: int,
    current_user: User
) -> Review:
    _get_event_or_404(db, event_id)

    review = db.query(Review).filter(
        Review.event_id == event_id,
        Review.user_id == current_user.id
    ).first()

    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="You have not reviewed this event yet"
        )

    return review