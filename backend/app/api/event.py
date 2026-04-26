from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.core.dependencies import get_db, get_current_user, require_organizer, get_optional_user
from app.models.user import User
from app.schemas.event import EventCreateRequest, EventUpdateRequest, EventResponse
from app.schemas.utils import PaginatedResponse
from app.services.event import (
    create_event,
    get_events,
    get_event_by_id,
    update_event,
    delete_event,
    publish_event,
    cancel_event,
)

router = APIRouter(prefix="/api/events", tags=["events"])


@router.post("", response_model=EventResponse, status_code=201)
def create(
    data: EventCreateRequest,
    current_user: User = Depends(require_organizer),
    db: Session = Depends(get_db),
):
    return create_event(db, data, current_user)


@router.get("", response_model=PaginatedResponse[EventResponse])
def list_events(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return get_events(db, skip=skip, limit=limit)


@router.get("/{event_id}", response_model=EventResponse)
def get_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    return get_event_by_id(db, event_id, current_user)


@router.patch("/{event_id}", response_model=EventResponse)
def update(
    event_id: int,
    data: EventUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return update_event(db, event_id, data, current_user)


@router.delete("/{event_id}", status_code=204)
def delete(
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    delete_event(db, event_id, current_user)


@router.patch("/{event_id}/publish", response_model=EventResponse)
def publish(
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return publish_event(db, event_id, current_user)


@router.patch("/{event_id}/cancel", response_model=EventResponse)
def cancel(
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return cancel_event(db, event_id, current_user)
