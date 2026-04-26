from sqlalchemy.orm import Session

from app.models.event import Event, EventCollaborator
from app.models.user import User
from app.core.exceptions import NotFoundError, ForbiddenError


def get_event_or_404(db: Session, event_id: int) -> Event:
    event = db.query(Event).filter(
        Event.id == event_id,
        Event.deleted_at.is_(None)
    ).first()
    if not event:
        raise NotFoundError("Event not found")
    return event


def check_event_permission(db: Session, event: Event, current_user: User) -> None:
    is_owner = event.owner_id == current_user.id
    is_collaborator = db.query(EventCollaborator).filter(
        EventCollaborator.event_id == event.id,
        EventCollaborator.user_id == current_user.id
    ).first()
    if not is_owner and not is_collaborator:
        raise ForbiddenError("You do not have permission to manage this event")
