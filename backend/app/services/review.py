from datetime import datetime
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.review import Review
from app.models.registration import Registration
from app.schemas.review import ReviewCreateRequest
from app.core.exceptions import NotFoundError, ForbiddenError, BadRequestError
from app.services.common import get_event_or_404
from app.core.constants import REG_STATUS_CONFIRMED


def create_or_update_review(
    db: Session,
    data: ReviewCreateRequest,
    current_user: User
) -> Review:
    event = get_event_or_404(db, data.event_id)

    if datetime.utcnow() < event.end_datetime:
        raise BadRequestError("You can only review an event after it has ended")

    registration = db.query(Registration).filter(
        Registration.event_id == data.event_id,
        Registration.user_id == current_user.id,
        Registration.status == REG_STATUS_CONFIRMED
    ).first()

    if not registration:
        raise ForbiddenError("You must have attended this event to leave a review")

    existing = db.query(Review).filter(
        Review.event_id == data.event_id,
        Review.user_id == current_user.id
    ).first()

    if existing:
        existing.rating = data.rating
        existing.comment = data.comment
        existing.is_anonymous = data.is_anonymous
        existing.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        try:
            from app.tasks.ml import run_sentiment_analysis
            run_sentiment_analysis.delay(existing.id)
        except Exception:
            pass  # never block a review submission because ML is unavailable
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
    try:
        from app.tasks.ml import run_sentiment_analysis
        run_sentiment_analysis.delay(review.id)
    except Exception:
        pass  # never block a review submission because ML is unavailable

    if review.is_anonymous:
        review.user_id = None

    return review


def get_event_reviews(
    db: Session,
    event_id: int,
    current_user: User = None
) -> list[Review]:
    event = get_event_or_404(db, event_id)

    if event.feedback_visibility == "organizer_only":
        if current_user is None or (not current_user.is_admin and event.owner_id != current_user.id):
            raise ForbiddenError("Reviews for this event are not public")

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
        raise NotFoundError("Review not found")

    if review.user_id != current_user.id:
        raise ForbiddenError("You can only delete your own review")

    db.delete(review)
    db.commit()


def get_my_review(
    db: Session,
    event_id: int,
    current_user: User
) -> Review:
    get_event_or_404(db, event_id)

    review = db.query(Review).filter(
        Review.event_id == event_id,
        Review.user_id == current_user.id
    ).first()

    if not review:
        raise NotFoundError("You have not reviewed this event yet")

    return review
