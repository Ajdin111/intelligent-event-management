from datetime import datetime
from sqlalchemy.orm import Session

from app.models.checkin import Checkin, OfflineCheckinQueue
from app.models.ticket import Ticket
from app.models.registration import Registration
from app.models.event import Event, EventCollaborator
from app.models.user import User
from app.schemas.checkin import QRCheckinRequest, ManualCheckinRequest, OfflineSyncRequest
from app.core.exceptions import NotFoundError, ForbiddenError, BadRequestError
from app.services.common import get_event_or_404


def _check_organizer_permission(db: Session, event_id: int, current_user: User) -> Event:
    event = get_event_or_404(db, event_id)

    is_owner = event.owner_id == current_user.id
    is_collaborator = db.query(EventCollaborator).filter(
        EventCollaborator.event_id == event_id,
        EventCollaborator.user_id == current_user.id,
    ).first()

    if not is_owner and not is_collaborator and not current_user.is_admin:
        raise ForbiddenError("You do not have permission to check in attendees for this event")

    return event


def qr_checkin(db: Session, data: QRCheckinRequest, current_user: User) -> Checkin:
    _check_organizer_permission(db, data.event_id, current_user)

    ticket = db.query(Ticket).filter(
        Ticket.qr_code == data.qr_code,
        Ticket.event_id == data.event_id,
    ).first()

    if not ticket:
        raise NotFoundError("Ticket not found")
    if not ticket.is_valid:
        raise BadRequestError("Ticket is no longer valid")

    if db.query(Checkin).filter(Checkin.ticket_id == ticket.id, Checkin.event_id == data.event_id).first():
        raise BadRequestError("Attendee is already checked in")

    registration = db.query(Registration).filter(Registration.id == ticket.registration_id).first()
    if not registration or registration.status != "confirmed":
        raise BadRequestError("Registration is not confirmed")

    checkin = Checkin(
        registration_id=ticket.registration_id,
        ticket_id=ticket.id,
        event_id=data.event_id,
        user_id=ticket.user_id,
        checked_in_by=current_user.id,
        checked_in_at=datetime.now(),
        is_manual=False,
    )
    db.add(checkin)
    db.commit()
    db.refresh(checkin)
    return checkin


def manual_checkin(db: Session, data: ManualCheckinRequest, current_user: User) -> Checkin:
    _check_organizer_permission(db, data.event_id, current_user)

    registration = db.query(Registration).filter(
        Registration.id == data.registration_id,
        Registration.event_id == data.event_id,
    ).first()

    if not registration:
        raise NotFoundError("Registration not found")
    if registration.status != "confirmed":
        raise BadRequestError("Registration is not confirmed")

    if db.query(Checkin).filter(
        Checkin.registration_id == data.registration_id,
        Checkin.event_id == data.event_id,
    ).first():
        raise BadRequestError("Attendee is already checked in")

    ticket = db.query(Ticket).filter(
        Ticket.registration_id == data.registration_id,
        Ticket.is_valid == True,  # noqa: E712
    ).first()

    if not ticket:
        raise BadRequestError("No valid ticket found for this registration")

    checkin = Checkin(
        registration_id=data.registration_id,
        ticket_id=ticket.id,
        event_id=data.event_id,
        user_id=registration.user_id,
        checked_in_by=current_user.id,
        checked_in_at=datetime.now(),
        is_manual=True,
    )
    db.add(checkin)
    db.commit()
    db.refresh(checkin)
    return checkin


def get_event_checkins(
    db: Session,
    event_id: int,
    current_user: User,
    skip: int = 0,
    limit: int = 100,
):
    _check_organizer_permission(db, event_id, current_user)

    from app.schemas.utils import PaginatedResponse
    base = db.query(Checkin).filter(Checkin.event_id == event_id)
    total = base.count()
    items = base.order_by(Checkin.checked_in_at.desc()).offset(skip).limit(limit).all()
    return PaginatedResponse(total=total, skip=skip, limit=limit, items=items)


def get_checkin_stats(db: Session, event_id: int, current_user: User) -> dict:
    _check_organizer_permission(db, event_id, current_user)

    total_registered = db.query(Registration).filter(
        Registration.event_id == event_id,
        Registration.status == "confirmed",
    ).count()

    total_checked_in = db.query(Checkin).filter(Checkin.event_id == event_id).count()

    attendance_rate = (
        round(total_checked_in / total_registered * 100, 1) if total_registered > 0 else 0.0
    )

    return {
        "event_id": event_id,
        "total_registered": total_registered,
        "total_checked_in": total_checked_in,
        "attendance_rate": attendance_rate,
        "remaining": total_registered - total_checked_in,
    }


def sync_offline_checkins(db: Session, data: OfflineSyncRequest, current_user: User) -> dict:
    synced = 0
    conflicts = 0
    details = []

    for item in data.items:
        ticket = db.query(Ticket).filter(
            Ticket.qr_code == item.qr_code,
            Ticket.event_id == item.event_id,
        ).first()

        queue_entry = OfflineCheckinQueue(
            ticket_id=ticket.id if ticket else None,
            event_id=item.event_id,
            scanned_by=current_user.id,
            scanned_at=item.scanned_at,
            status="pending",
        )

        conflict_reason = None

        if not ticket:
            conflict_reason = "Ticket not found"
        elif not ticket.is_valid:
            conflict_reason = "Ticket is invalid"
        else:
            existing_checkin = db.query(Checkin).filter(
                Checkin.ticket_id == ticket.id,
                Checkin.event_id == item.event_id,
            ).first()

            if existing_checkin:
                conflict_reason = "Already checked in"
            else:
                registration = db.query(Registration).filter(
                    Registration.id == ticket.registration_id
                ).first()

                if not registration or registration.status != "confirmed":
                    conflict_reason = "Registration not confirmed"
                else:
                    db.add(Checkin(
                        registration_id=ticket.registration_id,
                        ticket_id=ticket.id,
                        event_id=item.event_id,
                        user_id=ticket.user_id,
                        checked_in_by=current_user.id,
                        checked_in_at=item.scanned_at,
                        is_manual=False,
                    ))
                    queue_entry.status = "synced"
                    queue_entry.synced_at = datetime.now()
                    synced += 1

        if conflict_reason:
            queue_entry.status = "conflict"
            queue_entry.conflict_reason = conflict_reason
            conflicts += 1
            details.append({"qr_code": item.qr_code, "status": "conflict", "reason": conflict_reason})
        else:
            details.append({"qr_code": item.qr_code, "status": "synced"})

        if ticket:
            queue_entry.ticket_id = ticket.id
            db.add(queue_entry)

    db.commit()
    return {"synced": synced, "conflicts": conflicts, "details": details}
