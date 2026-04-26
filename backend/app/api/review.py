from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Optional

from app.core.dependencies import get_db, get_current_user, get_optional_user
from app.models.user import User
from app.schemas.review import ReviewCreateRequest, ReviewResponse
from app.services.review import (
    create_or_update_review,
    get_event_reviews,
    get_my_review,
    delete_review,
)

router = APIRouter(tags=["reviews"])


@router.post("/api/reviews", response_model=ReviewResponse, status_code=201)
def create_or_update(
    data: ReviewCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return create_or_update_review(db, data, current_user)


@router.get("/api/events/{event_id}/reviews", response_model=list[ReviewResponse])
def list_reviews(
    event_id: int,
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    return get_event_reviews(db, event_id, current_user)


@router.get("/api/events/{event_id}/reviews/me", response_model=ReviewResponse)
def my_review(
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_my_review(db, event_id, current_user)


@router.delete("/api/reviews/{review_id}", status_code=204)
def remove_review(
    review_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    delete_review(db, review_id, current_user)
