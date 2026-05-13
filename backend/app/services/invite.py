import secrets
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.models.event import EventCollaborator
from app.models.registration import Invite, Registration
from app.models.user import User
from app.core.exceptions import NotFoundError, BadRequestError, ForbiddenError
from app.services.common import get_event_or_404
from app.tasks.notifications import create_in_app_notification


def _require_owner_or_accepted_collaborator(db: Session, event, current_user: User):
    if event.owner_id == current_user.id:
        return
    collab = db.query(EventCollaborator).filter(
        EventCollaborator.event_id == event.id,
        EventCollaborator.user_id == current_user.id,
        EventCollaborator.status == "accepted",
    ).first()
    if not collab:
        raise ForbiddenError("Only the event owner or an accepted collaborator can manage invites")


def _send_invite_notifications(target, event, inviter):
    try:
        create_in_app_notification.delay(
            user_id=target.id,
            title="You've been invited to an event",
            message=f"{inviter.first_name} {inviter.last_name} invited you to attend '{event.title}'",
            notification_type="invite",
            event_id=event.id,
        )
        from app.tasks.email import send_event_invite
        send_event_invite.delay(
            target_user_id=target.id,
            event_id=event.id,
            inviter_name=f"{inviter.first_name} {inviter.last_name}",
        )
    except Exception:
        pass


def send_invite(db: Session, event_id: int, email: str, current_user: User) -> Invite:
    event = get_event_or_404(db, event_id)
    _require_owner_or_accepted_collaborator(db, event, current_user)

    target = db.query(User).filter(
        User.email == email,
        User.deleted_at.is_(None),
        User.is_active.is_(True),
    ).first()
    if not target:
        raise NotFoundError("No registered user found with that email. They must create a TeqEvent account first.")

    if target.id == current_user.id:
        raise BadRequestError("You cannot invite yourself")

    existing = db.query(Invite).filter(
        Invite.event_id == event_id,
        Invite.email == email,
    ).first()

    if existing:
        if existing.status == "pending":
            raise BadRequestError("An invite has already been sent to this email")
        if existing.status == "accepted":
            raise BadRequestError("This user has already accepted an invite")
        # declined or expired: re-send
        existing.status = "pending"
        existing.token = secrets.token_urlsafe(32)
        existing.expires_at = datetime.utcnow() + timedelta(days=7)
        existing.invited_by = current_user.id
        db.commit()
        db.refresh(existing)
        _send_invite_notifications(target, event, current_user)
        return existing

    invite = Invite(
        event_id=event_id,
        invited_by=current_user.id,
        email=email,
        token=secrets.token_urlsafe(32),
        status="pending",
        expires_at=datetime.utcnow() + timedelta(days=7),
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)

    _send_invite_notifications(target, event, current_user)

    return invite


def accept_invite(db: Session, event_id: int, current_user: User) -> dict:
    event = get_event_or_404(db, event_id)

    invite = db.query(Invite).filter(
        Invite.event_id == event_id,
        Invite.email == current_user.email,
    ).first()
    if not invite:
        raise NotFoundError("Invite not found")

    if invite.status == "accepted":
        raise BadRequestError("You have already accepted this invite")
    if invite.status == "declined":
        raise BadRequestError("You have already declined this invite")

    if invite.expires_at < datetime.utcnow():
        invite.status = "expired"
        db.commit()
        db.refresh(invite)
        raise BadRequestError("This invite has expired")

    invite.status = "accepted"
    invite.accepted_at = datetime.utcnow()
    invite.user_id = current_user.id

    requires_payment = False
    if event.is_free or not event.has_ticketing:
        db.add(Registration(
            event_id=event_id,
            user_id=current_user.id,
            status="confirmed",
            quantity=1,
            total_amount=0,
        ))
    else:
        requires_payment = True

    db.commit()
    db.refresh(invite)

    return {"invite": invite, "requires_payment": requires_payment, "event_id": event_id}


def decline_invite(db: Session, event_id: int, current_user: User) -> Invite:
    invite = db.query(Invite).filter(
        Invite.event_id == event_id,
        Invite.email == current_user.email,
    ).first()
    if not invite:
        raise NotFoundError("Invite not found")

    if invite.status != "pending":
        raise BadRequestError("This invite is no longer pending")

    invite.status = "declined"
    db.commit()
    db.refresh(invite)
    return invite


def list_event_invites(db: Session, event_id: int, current_user: User) -> list[Invite]:
    event = get_event_or_404(db, event_id)
    _require_owner_or_accepted_collaborator(db, event, current_user)

    return db.query(Invite).filter(
        Invite.event_id == event_id,
    ).all()


def list_my_invites(db: Session, current_user: User) -> list[Invite]:
    return db.query(Invite).filter(
        Invite.email == current_user.email,
        Invite.status == "pending",
    ).all()
