from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_current_user
from app.models.user import User
from app.schemas.registration import (
    RegistrationCreateRequest,
    RegistrationResponse,
    RegistrationCancelRequest,
    RegistrationRejectRequest,
    TicketResponse,
    WaitlistResponse
)
from app.services.registration import (
    create_registration,
    get_my_registrations,
    get_registration_by_id,
    cancel_registration,
    get_event_registrations,
    approve_registration,
    reject_registration,
    get_registration_tickets
)

router = APIRouter(tags=["registrations"])


# ─── Registration Endpoints ───────────────────────────────

@router.post(
    "/api/registrations",
    response_model=RegistrationResponse,
    status_code=201
)
def register(
    data: RegistrationCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return create_registration(db, data, current_user)


@router.get(
    "/api/registrations/me",
    response_model=list[RegistrationResponse]
)
def my_registrations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return get_my_registrations(db, current_user)


@router.get(
    "/api/registrations/{registration_id}",
    response_model=RegistrationResponse
)
def get_registration(
    registration_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return get_registration_by_id(db, registration_id, current_user)


@router.delete(
    "/api/registrations/{registration_id}",
    response_model=RegistrationResponse
)
def cancel(
    registration_id: int,
    data: RegistrationCancelRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return cancel_registration(db, registration_id, data, current_user)


# ─── Organizer Registration Management ───────────────────

@router.get(
    "/api/events/{event_id}/registrations",
    response_model=list[RegistrationResponse]
)
def event_registrations(
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return get_event_registrations(db, event_id, current_user)


@router.patch(
    "/api/registrations/{registration_id}/approve",
    response_model=RegistrationResponse
)
def approve(
    registration_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return approve_registration(db, registration_id, current_user)


@router.patch(
    "/api/registrations/{registration_id}/reject",
    response_model=RegistrationResponse
)
def reject(
    registration_id: int,
    data: RegistrationRejectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return reject_registration(db, registration_id, data, current_user)


# ─── Ticket Endpoints ─────────────────────────────────────

@router.get(
    "/api/registrations/{registration_id}/tickets",
    response_model=list[TicketResponse]
)
def registration_tickets(
    registration_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return get_registration_tickets(db, registration_id, current_user)