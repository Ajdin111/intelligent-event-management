from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.core.dependencies import get_db, get_current_user, require_organizer, get_optional_user
from app.models.user import User
from app.schemas.event import (
    EventCreateRequest,
    EventUpdateRequest,
    EventResponse,
    OrganizerStatsResponse,
    RegistrationTimelinePoint,
    ActivityItem,
)
from app.schemas.utils import PaginatedResponse
from app.services.event import (
    create_event,
    get_events,
    get_my_events,
    get_event_by_id,
    update_event,
    delete_event,
    publish_event,
    cancel_event,
    get_organizer_stats,
    get_organizer_timeline,
    get_organizer_activity,
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


@router.get("/my-events", response_model=list[EventResponse])
def my_events(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_my_events(db, current_user)


@router.get("/my-stats", response_model=OrganizerStatsResponse)
def my_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_organizer_stats(db, current_user)


@router.get("/my-registrations-timeline", response_model=list[RegistrationTimelinePoint])
def my_registrations_timeline(
    days: int = Query(90, ge=7, le=365),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_organizer_timeline(db, current_user, days)


@router.get("/my-activity", response_model=list[ActivityItem])
def my_activity(
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_organizer_activity(db, current_user, limit)


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
