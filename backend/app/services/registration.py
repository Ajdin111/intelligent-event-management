import uuid
from datetime import datetime, timedelta
from decimal import Decimal
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.event import Event
from app.models.ticket import TicketTier, Ticket, PromoCode
from app.models.registration import Registration, Waitlist
from app.schemas.registration import (
    RegistrationCreateRequest,
    RegistrationCancelRequest,
    RegistrationRejectRequest,
)
from app.schemas.utils import PaginatedResponse
from app.core.exceptions import NotFoundError, ForbiddenError, BadRequestError
from app.core.constants import WAITLIST_MAX_SIZE, WAITLIST_CONFIRMATION_HOURS
from app.services.common import get_event_or_404
from app.tasks.email import send_registration_confirmation
from app.tasks.notifications import create_in_app_notification


# ─── Helpers ─────────────────────────────────────────────

def _generate_qr_code() -> str:
    return str(uuid.uuid4())


def _get_waitlist_position(db: Session, event_id: int) -> int:
    return db.query(Waitlist).filter(
        Waitlist.event_id == event_id,
        Waitlist.status == "waiting"
    ).count() + 1


def _check_capacity(db: Session, event: Event, ticket_tier: TicketTier = None, quantity: int = 1) -> bool:
    if ticket_tier:
        return (ticket_tier.quantity - ticket_tier.quantity_sold) >= quantity
    if event.capacity:
        confirmed = db.query(Registration).filter(
            Registration.event_id == event.id,
            Registration.status == "confirmed"
        ).count()
        return (event.capacity - confirmed) >= quantity
    return True


def _apply_promo_code(
    db: Session,
    event_id: int,
    promo_code: str,
    ticket_tier: TicketTier,
    quantity: int,
) -> tuple[Decimal, PromoCode]:
    promo = db.query(PromoCode).filter(
        PromoCode.event_id == event_id,
        PromoCode.code == promo_code.upper(),
        PromoCode.is_active == True,  # noqa: E712
    ).first()

    if not promo:
        raise BadRequestError("Invalid promo code")

    now = datetime.now()
    if not (promo.uses_count < promo.max_uses and promo.valid_from <= now <= promo.valid_until):
        raise BadRequestError("Promo code is expired or no longer valid")

    price = ticket_tier.price if ticket_tier else Decimal("0")
    if promo.discount_type == "percentage":
        final_price = max(Decimal("0"), price - price * (promo.discount_value / Decimal("100")))
    else:
        final_price = max(Decimal("0"), price - promo.discount_value)

    return (final_price * quantity).quantize(Decimal("0.01")), promo


# ─── Registration Services ────────────────────────────────

def create_registration(
    db: Session,
    data: RegistrationCreateRequest,
    current_user: User,
) -> Registration | Waitlist:
    event = get_event_or_404(db, data.event_id)

    if event.status != "published":
        raise BadRequestError("Event is not available for registration")

    existing = db.query(Registration).filter(
        Registration.event_id == data.event_id,
        Registration.user_id == current_user.id,
        Registration.status.in_(["pending", "confirmed"]),
    ).first()
    if existing:
        raise BadRequestError("You are already registered for this event")

    ticket_tier = None
    if data.ticket_tier_id:
        ticket_tier = db.query(TicketTier).filter(
            TicketTier.id == data.ticket_tier_id,
            TicketTier.event_id == data.event_id,
            TicketTier.is_active == True,  # noqa: E712
        ).first()
        if not ticket_tier:
            raise BadRequestError("Ticket tier not found or not active")

        now = datetime.now()
        if not (ticket_tier.sale_start <= now <= ticket_tier.sale_end):
            raise BadRequestError("Ticket tier is not currently on sale")

    if not _check_capacity(db, event, ticket_tier, data.quantity):
        return _add_to_waitlist(db, event, data, current_user, ticket_tier)

    total_amount = Decimal("0.00")
    promo = None

    if ticket_tier:
        if data.promo_code:
            total_amount, promo = _apply_promo_code(
                db, data.event_id, data.promo_code, ticket_tier, data.quantity
            )
        else:
            total_amount = (ticket_tier.price * data.quantity).quantize(Decimal("0.01"))

    reg_status = "confirmed" if event.registration_type == "automatic" else "pending"

    registration = Registration(
        event_id=data.event_id,
        user_id=current_user.id,
        ticket_tier_id=data.ticket_tier_id,
        promo_code_id=promo.id if promo else None,
        quantity=data.quantity,
        total_amount=total_amount,
        status=reg_status,
    )
    db.add(registration)
    db.flush()

    if reg_status == "confirmed":
        _generate_tickets(db, registration, ticket_tier, current_user)
        if ticket_tier:
            ticket_tier.quantity_sold += data.quantity

    if promo:
        promo.uses_count += 1

    db.commit()
    db.refresh(registration)

    if reg_status == "confirmed":
        try:
            send_registration_confirmation.delay(registration.id)
            create_in_app_notification.delay(
                user_id=current_user.id,
                title="Registration confirmed",
                message=f"You're registered for {event.title}",
                notification_type="registration_confirmation",
            )
        except Exception:
            pass

    return registration


def _add_to_waitlist(
    db: Session,
    event: Event,
    data: RegistrationCreateRequest,
    current_user: User,
    ticket_tier: TicketTier = None,
) -> Waitlist:
    count = db.query(Waitlist).filter(
        Waitlist.event_id == event.id,
        Waitlist.status == "waiting",
    ).count()

    if count >= WAITLIST_MAX_SIZE:
        raise BadRequestError("Event waitlist is full")

    if db.query(Waitlist).filter(
        Waitlist.event_id == event.id,
        Waitlist.user_id == current_user.id,
        Waitlist.status == "waiting",
    ).first():
        raise BadRequestError("You are already on the waitlist for this event")

    waitlist = Waitlist(
        event_id=event.id,
        user_id=current_user.id,
        ticket_tier_id=data.ticket_tier_id,
        position=_get_waitlist_position(db, event.id),
        status="waiting",
    )
    db.add(waitlist)
    db.commit()
    db.refresh(waitlist)
    return waitlist


def _generate_tickets(
    db: Session,
    registration: Registration,
    ticket_tier: TicketTier,
    current_user: User,
) -> None:
    for _ in range(registration.quantity):
        db.add(Ticket(
            registration_id=registration.id,
            ticket_tier_id=ticket_tier.id if ticket_tier else None,
            user_id=current_user.id,
            event_id=registration.event_id,
            qr_code=_generate_qr_code(),
            is_valid=True,
            is_guest=False,
        ))


def get_my_registrations(db: Session, current_user: User) -> list[Registration]:
    return db.query(Registration).filter(
        Registration.user_id == current_user.id
    ).order_by(Registration.registered_at.desc()).all()


def get_registration_by_id(db: Session, registration_id: int, current_user: User) -> Registration:
    registration = db.query(Registration).filter(Registration.id == registration_id).first()
    if not registration:
        raise NotFoundError("Registration not found")
    if registration.user_id != current_user.id:
        raise ForbiddenError("You do not have access to this registration")
    return registration


def cancel_registration(
    db: Session,
    registration_id: int,
    data: RegistrationCancelRequest,
    current_user: User,
) -> Registration:
    registration = db.query(Registration).filter(Registration.id == registration_id).first()
    if not registration:
        raise NotFoundError("Registration not found")
    if registration.user_id != current_user.id:
        raise ForbiddenError("You can only cancel your own registration")
    if registration.status == "cancelled":
        raise BadRequestError("Registration is already cancelled")

    for ticket in db.query(Ticket).filter(Ticket.registration_id == registration_id).all():
        ticket.is_valid = False

    if registration.ticket_tier_id:
        tier = db.query(TicketTier).filter(TicketTier.id == registration.ticket_tier_id).first()
        if tier:
            tier.quantity_sold = max(0, tier.quantity_sold - registration.quantity)

    registration.status = "cancelled"
    registration.cancelled_at = datetime.now()
    registration.cancellation_reason = data.cancellation_reason

    _process_waitlist(db, registration.event_id)

    db.commit()
    db.refresh(registration)
    return registration


def _process_waitlist(db: Session, event_id: int) -> None:
    next_in_line = db.query(Waitlist).filter(
        Waitlist.event_id == event_id,
        Waitlist.status == "waiting",
    ).order_by(Waitlist.position).first()

    if next_in_line:
        next_in_line.status = "notified"
        next_in_line.notified_at = datetime.now()
        next_in_line.confirmation_deadline = datetime.now() + timedelta(hours=WAITLIST_CONFIRMATION_HOURS)
        db.commit()

        from app.tasks.notifications import notify_waitlist_user
        try:
            notify_waitlist_user.delay(next_in_line.id)
        except Exception:
            pass


def get_event_registrations(
    db: Session,
    event_id: int,
    current_user: User,
    skip: int = 0,
    limit: int = 50,
) -> PaginatedResponse:
    from app.models.event import EventCollaborator
    event = get_event_or_404(db, event_id)

    is_owner = event.owner_id == current_user.id
    is_collaborator = db.query(EventCollaborator).filter(
        EventCollaborator.event_id == event_id,
        EventCollaborator.user_id == current_user.id,
    ).first()

    if not is_owner and not is_collaborator:
        raise ForbiddenError("You do not have permission to view registrations for this event")

    base = db.query(Registration).filter(Registration.event_id == event_id)
    total = base.count()
    items = base.offset(skip).limit(limit).all()
    return PaginatedResponse(total=total, skip=skip, limit=limit, items=items)


def approve_registration(db: Session, registration_id: int, current_user: User) -> Registration:
    registration = db.query(Registration).filter(Registration.id == registration_id).first()
    if not registration:
        raise NotFoundError("Registration not found")

    from app.models.event import EventCollaborator
    event = get_event_or_404(db, registration.event_id)

    is_owner = event.owner_id == current_user.id
    is_collaborator = db.query(EventCollaborator).filter(
        EventCollaborator.event_id == registration.event_id,
        EventCollaborator.user_id == current_user.id,
    ).first()

    if not is_owner and not is_collaborator:
        raise ForbiddenError("You do not have permission to approve registrations")

    if registration.status != "pending":
        raise BadRequestError("Only pending registrations can be approved")

    registration.status = "confirmed"
    registration.approved_at = datetime.now()
    registration.approved_by = current_user.id

    ticket_tier = None
    if registration.ticket_tier_id:
        ticket_tier = db.query(TicketTier).filter(TicketTier.id == registration.ticket_tier_id).first()
        ticket_tier.quantity_sold += registration.quantity

    user = db.query(User).filter(User.id == registration.user_id).first()
    _generate_tickets(db, registration, ticket_tier, user)

    db.commit()
    db.refresh(registration)

    try:
        send_registration_confirmation.delay(registration.id)
        create_in_app_notification.delay(
            user_id=registration.user_id,
            title="Registration approved",
            message="Your registration has been approved",
            notification_type="approval",
        )
    except Exception:
        pass

    return registration


def reject_registration(
    db: Session,
    registration_id: int,
    data: RegistrationRejectRequest,
    current_user: User,
) -> Registration:
    registration = db.query(Registration).filter(Registration.id == registration_id).first()
    if not registration:
        raise NotFoundError("Registration not found")

    from app.models.event import EventCollaborator
    event = get_event_or_404(db, registration.event_id)

    is_owner = event.owner_id == current_user.id
    is_collaborator = db.query(EventCollaborator).filter(
        EventCollaborator.event_id == registration.event_id,
        EventCollaborator.user_id == current_user.id,
    ).first()

    if not is_owner and not is_collaborator:
        raise ForbiddenError("You do not have permission to reject registrations")

    if registration.status != "pending":
        raise BadRequestError("Only pending registrations can be rejected")

    registration.status = "rejected"
    registration.cancellation_reason = data.cancellation_reason
    registration.cancelled_at = datetime.now()

    db.commit()
    db.refresh(registration)
    return registration


def get_registration_tickets(db: Session, registration_id: int, current_user: User) -> list[Ticket]:
    registration = db.query(Registration).filter(Registration.id == registration_id).first()
    if not registration:
        raise NotFoundError("Registration not found")
    if registration.user_id != current_user.id:
        raise ForbiddenError("You do not have access to these tickets")
    return db.query(Ticket).filter(Ticket.registration_id == registration_id).all()
