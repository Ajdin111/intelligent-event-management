from datetime import datetime
from sqlalchemy.orm import Session

from app.models.event import EventCollaborator
from app.models.user import User, UserRole
from app.core.exceptions import NotFoundError, BadRequestError, ForbiddenError
from app.services.common import get_event_or_404
from app.tasks.notifications import create_in_app_notification
from app.tasks.email import send_collaborator_invite


def _require_owner(event, current_user):
    if current_user.is_admin:
        return
    if event.owner_id != current_user.id:
        raise ForbiddenError("Only the event owner can manage collaborators")


def _get_collaborator_entry(db: Session, event_id: int, user_id: int) -> EventCollaborator:
    entry = db.query(EventCollaborator).filter(
        EventCollaborator.event_id == event_id,
        EventCollaborator.user_id == user_id,
    ).first()
    if not entry:
        raise NotFoundError("Collaborator not found")
    return entry


def add_collaborator(db: Session, event_id: int, email: str, current_user: User) -> EventCollaborator:
    event = get_event_or_404(db, event_id)
    _require_owner(event, current_user)

    # find target user
    target = db.query(User).filter(
        User.email == email,
        User.deleted_at.is_(None),
        User.is_active.is_(True),
    ).first()
    if not target:
        raise NotFoundError("No active user found with that email")

    # must be an organizer
    role = db.query(UserRole).filter(
        UserRole.user_id == target.id,
        UserRole.role == "organizer",
    ).first()
    if not role:
        raise BadRequestError("User must have an organizer role to be added as collaborator")

    # cannot invite yourself
    if target.id == current_user.id:
        raise BadRequestError("You cannot add yourself as a collaborator")

    # check if already invited or collaborating
    existing = db.query(EventCollaborator).filter(
        EventCollaborator.event_id == event_id,
        EventCollaborator.user_id == target.id,
    ).first()
    if existing:
        if existing.status == "pending":
            raise BadRequestError("User has already been invited and has not responded yet")
        if existing.status == "accepted":
            raise BadRequestError("User is already a collaborator on this event")
        if existing.status == "declined":
            # re-invite if they previously declined
            existing.status = "pending"
            existing.added_by = current_user.id
            existing.added_at = datetime.utcnow()
            db.commit()
            db.refresh(existing)
            _send_invite_notifications(target, event, current_user)
            return existing

    collaborator = EventCollaborator(
        event_id=event_id,
        user_id=target.id,
        added_by=current_user.id,
        status="pending",
    )
    db.add(collaborator)
    db.commit()
    db.refresh(collaborator)

    _send_invite_notifications(target, event, current_user)

    return collaborator


def _send_invite_notifications(target, event, inviter):
    try:
        create_in_app_notification.delay(
            user_id=target.id,
            title="You've been invited as a collaborator",
            message=f"{inviter.first_name} {inviter.last_name} invited you to co-manage '{event.title}'",
            notification_type="invite",
            event_id=event.id,
        )
        send_collaborator_invite.delay(
            target_user_id=target.id,
            event_id=event.id,
            inviter_name=f"{inviter.first_name} {inviter.last_name}",
        )
    except Exception:
        pass


def accept_invite(db: Session, event_id: int, current_user: User) -> EventCollaborator:
    entry = _get_collaborator_entry(db, event_id, current_user.id)

    if entry.status == "accepted":
        raise BadRequestError("You have already accepted this invite")
    if entry.status == "declined":
        raise BadRequestError("You have already declined this invite")

    entry.status = "accepted"
    db.commit()
    db.refresh(entry)
    return entry


def decline_invite(db: Session, event_id: int, current_user: User) -> EventCollaborator:
    entry = _get_collaborator_entry(db, event_id, current_user.id)

    if entry.status == "accepted":
        raise BadRequestError("You have already accepted this invite")
    if entry.status == "declined":
        raise BadRequestError("You have already declined this invite")

    entry.status = "declined"
    db.commit()
    db.refresh(entry)
    return entry


def remove_collaborator(db: Session, event_id: int, user_id: int, current_user: User) -> None:
    event = get_event_or_404(db, event_id)
    _require_owner(event, current_user)

    entry = _get_collaborator_entry(db, event_id, user_id)
    db.delete(entry)
    db.commit()


def list_collaborators(db: Session, event_id: int, current_user: User) -> list[EventCollaborator]:
    event = get_event_or_404(db, event_id)
    _require_owner(event, current_user)

    return db.query(EventCollaborator).filter(
        EventCollaborator.event_id == event_id,
    ).all()


def list_my_invites(db: Session, current_user: User) -> list[EventCollaborator]:
    return db.query(EventCollaborator).filter(
        EventCollaborator.user_id == current_user.id,
        EventCollaborator.status == "pending",
    ).all()


def list_collaborating_events(db: Session, current_user: User) -> list:
    from app.models.event import Event
    entries = db.query(EventCollaborator).filter(
        EventCollaborator.user_id == current_user.id,
        EventCollaborator.status == "accepted",
    ).all()

    event_ids = [e.event_id for e in entries]
    if not event_ids:
        return []

    return db.query(Event).filter(
        Event.id.in_(event_ids),
        Event.deleted_at.is_(None),
    ).all()