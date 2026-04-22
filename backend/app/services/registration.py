import uuid
import qrcode
import io
import base64
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.user import User
from app.models.event import Event
from app.models.ticket import TicketTier, Ticket, PromoCode
from app.models.registration import Registration, Waitlist
from app.schemas.registration import (
    RegistrationCreateRequest,
    RegistrationCancelRequest,
    RegistrationRejectRequest
)


# ─── Helpers ─────────────────────────────────────────────

def _normalize_dt(dt: datetime) -> datetime:
    if dt is None:
        return None
    return dt.replace(tzinfo=None)


def _get_event_or_404(db: Session, event_id: int) -> Event:
    event = db.query(Event).filter(
        Event.id == event_id,
        Event.deleted_at.is_(None)
    ).first()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    return event


def _generate_qr_code() -> str:
    return str(uuid.uuid4())


def _get_waitlist_position(db: Session, event_id: int) -> int:
    count = db.query(Waitlist).filter(
        Waitlist.event_id == event_id,
        Waitlist.status == "waiting"
    ).count()
    return count + 1


def _check_capacity(db: Session, event: Event, ticket_tier: TicketTier = None, quantity: int = 1) -> bool:
    if ticket_tier:
        available = ticket_tier.quantity - ticket_tier.quantity_sold
        return available >= quantity
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
    quantity: int
) -> tuple[float, PromoCode]:
    promo = db.query(PromoCode).filter(
        PromoCode.event_id == event_id,
        PromoCode.code == promo_code.upper(),
        PromoCode.is_active == True
    ).first()

    if not promo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid promo code"
        )

    now = datetime.now()
    if not (promo.uses_count < promo.max_uses and
            _normalize_dt(promo.valid_from) <= now <= _normalize_dt(promo.valid_until)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Promo code is expired or no longer valid"
        )

    price = ticket_tier.price if ticket_tier else 0
    if promo.discount_type == "percentage":
        discount = price * (promo.discount_value / 100)
        final_price = max(0, price - discount)
    else:
        final_price = max(0, price - promo.discount_value)

    return round(final_price * quantity, 2), promo


# ─── Registration Services ────────────────────────────────

def create_registration(
    db: Session,
    data: RegistrationCreateRequest,
    current_user: User
) -> Registration:
    event = _get_event_or_404(db, data.event_id)

    # check event is published
    if event.status != "published":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Event is not available for registration"
        )

    # check user not already registered
    existing = db.query(Registration).filter(
        Registration.event_id == data.event_id,
        Registration.user_id == current_user.id,
        Registration.status.in_(["pending", "confirmed"])
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already registered for this event"
        )

    # get ticket tier if provided
    ticket_tier = None
    if data.ticket_tier_id:
        ticket_tier = db.query(TicketTier).filter(
            TicketTier.id == data.ticket_tier_id,
            TicketTier.event_id == data.event_id,
            TicketTier.is_active == True
        ).first()
        if not ticket_tier:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ticket tier not found or not active"
            )

        # check tier sale period
        now = datetime.now()
        if not (_normalize_dt(ticket_tier.sale_start) <= now <= _normalize_dt(ticket_tier.sale_end)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ticket tier is not currently on sale"
            )

    # check capacity
    has_capacity = _check_capacity(db, event, ticket_tier, data.quantity)

    # if no capacity — add to waitlist
    if not has_capacity:
        return _add_to_waitlist(db, event, data, current_user, ticket_tier)

    # calculate total amount
    total_amount = 0.0
    promo = None

    if ticket_tier:
        if data.promo_code:
            total_amount, promo = _apply_promo_code(
                db, data.event_id, data.promo_code, ticket_tier, data.quantity
            )
        else:
            total_amount = round(float(ticket_tier.price) * data.quantity, 2)

    # determine registration status
    if event.registration_type == "automatic":
        reg_status = "confirmed"
    elif event.registration_type == "manual":
        reg_status = "pending"
    else:
        reg_status = "pending"

    # create registration
    registration = Registration(
        event_id=data.event_id,
        user_id=current_user.id,
        ticket_tier_id=data.ticket_tier_id,
        promo_code_id=promo.id if promo else None,
        quantity=data.quantity,
        total_amount=total_amount,
        status=reg_status
    )
    db.add(registration)
    db.flush()

    # if confirmed — generate tickets and update quantity sold
    if reg_status == "confirmed":
        _generate_tickets(db, registration, ticket_tier, current_user)
        if ticket_tier:
            ticket_tier.quantity_sold += data.quantity

    db.commit()
    db.refresh(registration)
    return registration


def _add_to_waitlist(
    db: Session,
    event: Event,
    data: RegistrationCreateRequest,
    current_user: User,
    ticket_tier: TicketTier = None
) -> Registration:
    # check waitlist limit
    waitlist_count = db.query(Waitlist).filter(
        Waitlist.event_id == event.id,
        Waitlist.status == "waiting"
    ).count()

    if waitlist_count >= 50:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Event waitlist is full"
        )

    # check not already on waitlist
    existing_waitlist = db.query(Waitlist).filter(
        Waitlist.event_id == event.id,
        Waitlist.user_id == current_user.id,
        Waitlist.status == "waiting"
    ).first()

    if existing_waitlist:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already on the waitlist for this event"
        )

    position = _get_waitlist_position(db, event.id)

    waitlist = Waitlist(
        event_id=event.id,
        user_id=current_user.id,
        ticket_tier_id=data.ticket_tier_id,
        position=position,
        status="waiting"
    )
    db.add(waitlist)
    db.commit()

    raise HTTPException(
        status_code=status.HTTP_200_OK,
        detail=f"Event is full. You have been added to the waitlist at position {position}"
    )


def _generate_tickets(
    db: Session,
    registration: Registration,
    ticket_tier: TicketTier,
    current_user: User
) -> None:
    for _ in range(registration.quantity):
        ticket = Ticket(
            registration_id=registration.id,
            ticket_tier_id=ticket_tier.id if ticket_tier else None,
            user_id=current_user.id,
            event_id=registration.event_id,
            qr_code=_generate_qr_code(),
            is_valid=True,
            is_guest=False
        )
        db.add(ticket)


def get_my_registrations(db: Session, current_user: User) -> list[Registration]:
    return db.query(Registration).filter(
        Registration.user_id == current_user.id
    ).order_by(Registration.registered_at.desc()).all()


def get_registration_by_id(
    db: Session,
    registration_id: int,
    current_user: User
) -> Registration:
    registration = db.query(Registration).filter(
        Registration.id == registration_id
    ).first()

    if not registration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Registration not found"
        )

    if registration.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this registration"
        )

    return registration


def cancel_registration(
    db: Session,
    registration_id: int,
    data: RegistrationCancelRequest,
    current_user: User
) -> Registration:
    registration = db.query(Registration).filter(
        Registration.id == registration_id
    ).first()

    if not registration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Registration not found"
        )

    if registration.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only cancel your own registration"
        )

    if registration.status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Registration is already cancelled"
        )

    # invalidate all tickets
    tickets = db.query(Ticket).filter(
        Ticket.registration_id == registration_id
    ).all()
    for ticket in tickets:
        ticket.is_valid = False

    # decrement quantity sold
    if registration.ticket_tier_id:
        tier = db.query(TicketTier).filter(
            TicketTier.id == registration.ticket_tier_id
        ).first()
        if tier:
            tier.quantity_sold = max(0, tier.quantity_sold - registration.quantity)

    registration.status = "cancelled"
    registration.cancelled_at = datetime.now()
    registration.cancellation_reason = data.cancellation_reason

    # check waitlist and notify first person
    _process_waitlist(db, registration.event_id)

    db.commit()
    db.refresh(registration)
    return registration


def _process_waitlist(db: Session, event_id: int) -> None:
    next_in_line = db.query(Waitlist).filter(
        Waitlist.event_id == event_id,
        Waitlist.status == "waiting"
    ).order_by(Waitlist.position).first()

    if next_in_line:
        next_in_line.status = "notified"
        next_in_line.notified_at = datetime.now()
        next_in_line.confirmation_deadline = datetime.now() + timedelta(hours=24)
        db.commit()


def get_event_registrations(
    db: Session,
    event_id: int,
    current_user: User
) -> list[Registration]:
    from app.models.event import EventCollaborator
    event = _get_event_or_404(db, event_id)

    is_owner = event.owner_id == current_user.id
    is_collaborator = db.query(EventCollaborator).filter(
        EventCollaborator.event_id == event_id,
        EventCollaborator.user_id == current_user.id
    ).first()

    if not is_owner and not is_collaborator:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view registrations for this event"
        )

    return db.query(Registration).filter(
        Registration.event_id == event_id
    ).all()


def approve_registration(
    db: Session,
    registration_id: int,
    current_user: User
) -> Registration:
    registration = db.query(Registration).filter(
        Registration.id == registration_id
    ).first()

    if not registration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Registration not found"
        )

    from app.models.event import EventCollaborator
    event = _get_event_or_404(db, registration.event_id)

    is_owner = event.owner_id == current_user.id
    is_collaborator = db.query(EventCollaborator).filter(
        EventCollaborator.event_id == registration.event_id,
        EventCollaborator.user_id == current_user.id
    ).first()

    if not is_owner and not is_collaborator:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to approve registrations"
        )

    if registration.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending registrations can be approved"
        )

    registration.status = "confirmed"
    registration.approved_at = datetime.now()
    registration.approved_by = current_user.id

    # generate tickets
    ticket_tier = None
    if registration.ticket_tier_id:
        ticket_tier = db.query(TicketTier).filter(
            TicketTier.id == registration.ticket_tier_id
        ).first()
        ticket_tier.quantity_sold += registration.quantity

    user = db.query(User).filter(User.id == registration.user_id).first()
    _generate_tickets(db, registration, ticket_tier, user)

    db.commit()
    db.refresh(registration)
    return registration


def reject_registration(
    db: Session,
    registration_id: int,
    data: RegistrationRejectRequest,
    current_user: User
) -> Registration:
    registration = db.query(Registration).filter(
        Registration.id == registration_id
    ).first()

    if not registration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Registration not found"
        )

    from app.models.event import EventCollaborator
    event = _get_event_or_404(db, registration.event_id)

    is_owner = event.owner_id == current_user.id
    is_collaborator = db.query(EventCollaborator).filter(
        EventCollaborator.event_id == registration.event_id,
        EventCollaborator.user_id == current_user.id
    ).first()

    if not is_owner and not is_collaborator:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to reject registrations"
        )

    if registration.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending registrations can be rejected"
        )

    registration.status = "rejected"
    registration.cancellation_reason = data.cancellation_reason
    registration.cancelled_at = datetime.now()

    db.commit()
    db.refresh(registration)
    return registration


def get_registration_tickets(
    db: Session,
    registration_id: int,
    current_user: User
) -> list[Ticket]:
    registration = db.query(Registration).filter(
        Registration.id == registration_id
    ).first()

    if not registration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Registration not found"
        )

    if registration.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to these tickets"
        )

    return db.query(Ticket).filter(
        Ticket.registration_id == registration_id
    ).all()