from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.user import User
from app.models.event import Event, EventCollaborator, EventCategory, Category
from app.schemas.event import EventCreateRequest, EventUpdateRequest
from app.schemas.utils import PaginatedResponse
from app.core.exceptions import NotFoundError, ForbiddenError, BadRequestError
from app.services.common import get_event_or_404, check_event_permission
from app.tasks.analytics import compute_event_analytics
from app.tasks.email import send_feedback_request


def _get_category_ids_bulk(db: Session, event_ids: list[int]) -> dict[int, list[int]]:
    rows = db.query(EventCategory).filter(EventCategory.event_id.in_(event_ids)).all()
    result: dict[int, list[int]] = {}
    for row in rows:
        result.setdefault(row.event_id, []).append(row.category_id)
    return result


def create_event(db: Session, data: EventCreateRequest, current_user: User) -> Event:
    if data.end_datetime <= data.start_datetime:
        raise BadRequestError("End datetime must be after start datetime")

    if data.location_type in ["online", "hybrid"] and not data.online_link:
        raise BadRequestError("Online link is required for online and hybrid events")

    if data.category_ids:
        for cid in data.category_ids:
            if not db.query(Category).filter(Category.id == cid).first():
                raise BadRequestError(f"Category with id {cid} does not exist")

    event = Event(
        owner_id=current_user.id,
        title=data.title,
        description=data.description,
        location_type=data.location_type,
        physical_address=data.physical_address,
        online_link=data.online_link,
        start_datetime=data.start_datetime,
        end_datetime=data.end_datetime,
        capacity=data.capacity,
        registration_type=data.registration_type,
        requires_registration=data.requires_registration,
        has_ticketing=data.has_ticketing,
        is_free=data.is_free,
        feedback_visibility=data.feedback_visibility,
        status="draft"
    )
    db.add(event)
    db.flush()

    if data.category_ids:
        for cid in data.category_ids:
            db.add(EventCategory(event_id=event.id, category_id=cid))

    db.commit()
    db.refresh(event)
    event.category_ids = _get_category_ids_bulk(db, [event.id]).get(event.id, [])
    return event


def get_events(db: Session, skip: int = 0, limit: int = 20) -> PaginatedResponse:
    base = db.query(Event).filter(Event.status == "published", Event.deleted_at.is_(None))
    total = base.count()
    events = base.offset(skip).limit(limit).all()

    if events:
        category_map = _get_category_ids_bulk(db, [e.id for e in events])
        for event in events:
            event.category_ids = category_map.get(event.id, [])

    return PaginatedResponse(total=total, skip=skip, limit=limit, items=events)


def get_event_by_id(db: Session, event_id: int, current_user: User = None) -> Event:
    event = get_event_or_404(db, event_id)

    if event.online_link and current_user is None:
        event.online_link = None

    event.category_ids = _get_category_ids_bulk(db, [event.id]).get(event.id, [])
    return event


def update_event(db: Session, event_id: int, data: EventUpdateRequest, current_user: User) -> Event:
    event = get_event_or_404(db, event_id)
    check_event_permission(db, event, current_user)

    final_start = data.start_datetime or event.start_datetime
    final_end = data.end_datetime or event.end_datetime

    if final_end <= final_start:
        raise BadRequestError("End datetime must be after start datetime")

    final_location_type = data.location_type or event.location_type
    final_online_link = data.online_link or event.online_link

    if final_location_type in ["online", "hybrid"] and not final_online_link:
        raise BadRequestError("Online link is required for online and hybrid events")

    if data.category_ids is not None:
        for cid in data.category_ids:
            if not db.query(Category).filter(Category.id == cid).first():
                raise BadRequestError(f"Category with id {cid} does not exist")

        db.query(EventCategory).filter(EventCategory.event_id == event_id).delete()
        for cid in data.category_ids:
            db.add(EventCategory(event_id=event.id, category_id=cid))

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(event, field, value)

    db.commit()
    db.refresh(event)
    event.category_ids = _get_category_ids_bulk(db, [event.id]).get(event.id, [])
    return event


def delete_event(db: Session, event_id: int, current_user: User) -> None:
    event = get_event_or_404(db, event_id)

    if event.owner_id != current_user.id:
        raise ForbiddenError("Only the event owner can delete this event")

    event.deleted_at = datetime.now()
    db.commit()


def publish_event(db: Session, event_id: int, current_user: User) -> Event:
    event = get_event_or_404(db, event_id)

    if event.owner_id != current_user.id:
        raise ForbiddenError("Only the event owner can publish this event")

    if event.status != "draft":
        raise BadRequestError("Only draft events can be published")

    event.status = "published"
    db.commit()
    db.refresh(event)
    return event


def cancel_event(db: Session, event_id: int, current_user: User) -> Event:
    event = get_event_or_404(db, event_id)

    if event.owner_id != current_user.id:
        raise ForbiddenError("Only the event owner can cancel this event")

    if event.status not in ["draft", "published"]:
        raise BadRequestError("Event cannot be cancelled")

    event.status = "cancelled"
    db.commit()
    db.refresh(event)

    compute_event_analytics.delay(event.id)
    send_feedback_request.delay(event.id)

    return event
