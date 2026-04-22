from datetime import datetime
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.user import User
from app.models.event import Event, EventCollaborator, EventCategory, Category
from app.schemas.event import EventCreateRequest, EventUpdateRequest

def _get_category_ids(db: Session, event_id: int) -> list[int]:
    categories = db.query(EventCategory).filter(
        EventCategory.event_id == event_id
    ).all()
    return [c.category_id for c in categories]

def create_event(db: Session, data: EventCreateRequest, current_user: User) -> Event:
    # validate dates
    if data.end_datetime <= data.start_datetime:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End datetime must be after start datetime"
        )

    # validate online link for online/hybrid events
    if data.location_type in ["online", "hybrid"] and not data.online_link:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Online link is required for online and hybrid events"
        )

    # validate categories exist
    if data.category_ids:
        for category_id in data.category_ids:
            category = db.query(Category).filter(Category.id == category_id).first()
            if not category:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Category with id {category_id} does not exist"
                )

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

    # assign categories
    if data.category_ids:
        for category_id in data.category_ids:
            event_category = EventCategory(
                event_id=event.id,
                category_id=category_id
            )
            db.add(event_category)

    db.commit()
    db.refresh(event)
    
    event.category_ids = _get_category_ids(db, event.id)
    return event

def get_events(db: Session, skip: int = 0, limit: int = 20) -> list[Event]:
    events = db.query(Event).filter(
        Event.status == "published",
        Event.deleted_at.is_(None)
    ).offset(skip).limit(limit).all()

    for event in events:
        event.category_ids = _get_category_ids(db, event.id)

    return events


def get_event_by_id(db: Session, event_id: int, current_user: User = None) -> Event:
    event = db.query(Event).filter(
        Event.id == event_id,
        Event.deleted_at.is_(None)
    ).first()

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )

    # hide online link from non-registered attendees
    if event.online_link and current_user is None:
        event.online_link = None

    event.category_ids = _get_category_ids(db, event.id)

    return event


def update_event(
    db: Session,
    event_id: int,
    data: EventUpdateRequest,
    current_user: User
) -> Event:
    event = db.query(Event).filter(
        Event.id == event_id,
        Event.deleted_at.is_(None)
    ).first()

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )

    # check if user is owner or collaborator
    is_owner = event.owner_id == current_user.id
    is_collaborator = db.query(EventCollaborator).filter(
        EventCollaborator.event_id == event_id,
        EventCollaborator.user_id == current_user.id
    ).first()

    if not is_owner and not is_collaborator:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to update this event"
        )

    # validate dates if either is being updated
    final_start = data.start_datetime or event.start_datetime
    final_end = data.end_datetime or event.end_datetime

    if final_end <= final_start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End datetime must be after start datetime"
        )

    # validate online link
    final_location_type = data.location_type or event.location_type
    final_online_link = data.online_link or event.online_link

    if final_location_type in ["online", "hybrid"] and not final_online_link:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Online link is required for online and hybrid events"
        )
    # update categories if provided
    if data.category_ids is not None:
        # validate all categories exist
        for category_id in data.category_ids:
            category = db.query(Category).filter(Category.id == category_id).first()
            if not category:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Category with id {category_id} does not exist"
                )

        # delete existing categories
        db.query(EventCategory).filter(
            EventCategory.event_id == event_id
        ).delete()

        # add new categories
        for category_id in data.category_ids:
            event_category = EventCategory(
                event_id=event.id,
                category_id=category_id
            )
            db.add(event_category)

    # only update fields that were sent
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(event, field, value)

    db.commit()
    db.refresh(event)
    event.category_ids = _get_category_ids(db, event.id)
    return event


def delete_event(db: Session, event_id: int, current_user: User) -> None:
    event = db.query(Event).filter(
        Event.id == event_id,
        Event.deleted_at.is_(None)
    ).first()

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )

    # only owner can delete
    if event.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the event owner can delete this event"
        )

    event.deleted_at = datetime.now()
    db.commit()


def publish_event(db: Session, event_id: int, current_user: User) -> Event:
    event = db.query(Event).filter(
        Event.id == event_id,
        Event.deleted_at.is_(None)
    ).first()

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )

    # only owner can publish
    if event.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the event owner can publish this event"
        )

    if event.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only draft events can be published"
        )

    event.status = "published"
    db.commit()
    db.refresh(event)
    return event
def cancel_event(db: Session, event_id: int, current_user: User) -> Event:
    event = db.query(Event).filter(
        Event.id == event_id,
        Event.deleted_at.is_(None)
    ).first()

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )

    if event.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the event owner can cancel this event"
        )

    if event.status not in ["draft", "published"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Event cannot be cancelled"
        )

    event.status = "cancelled"
    db.commit()
    db.refresh(event)
    return event