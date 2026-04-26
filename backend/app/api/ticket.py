from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_current_user
from app.models.user import User
from app.schemas.ticket import (
    TicketTierCreateRequest,
    TicketTierUpdateRequest,
    TicketTierResponse,
    PromoCodeCreateRequest,
    PromoCodeUpdateRequest,
    PromoCodeResponse,
    PromoCodeValidateRequest,
    PromoCodeValidateResponse
)
from app.services.ticket import (
    create_ticket_tier,
    get_ticket_tiers,
    update_ticket_tier,
    delete_ticket_tier,
    create_promo_code,
    get_promo_codes,
    validate_promo_code,
    update_promo_code,
    delete_promo_code
)

router = APIRouter(tags=["tickets"])


# ticket tier endpoint

@router.post(
    "/api/events/{event_id}/ticket-tiers",
    response_model=TicketTierResponse,
    status_code=201
)
def create_tier(
    event_id: int,
    data: TicketTierCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return create_ticket_tier(db, event_id, data, current_user)


@router.get(
    "/api/events/{event_id}/ticket-tiers",
    response_model=list[TicketTierResponse]
)
def list_tiers(
    event_id: int,
    db: Session = Depends(get_db)
):
    return get_ticket_tiers(db, event_id)


@router.patch(
    "/api/ticket-tiers/{tier_id}",
    response_model=TicketTierResponse
)
def update_tier(
    tier_id: int,
    data: TicketTierUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return update_ticket_tier(db, tier_id, data, current_user)


@router.delete(
    "/api/ticket-tiers/{tier_id}",
    status_code=204
)
def delete_tier(
    tier_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    delete_ticket_tier(db, tier_id, current_user)


# promo code endpoint

@router.post(
    "/api/events/{event_id}/promo-codes",
    response_model=PromoCodeResponse,
    status_code=201
)
def create_promo(
    event_id: int,
    data: PromoCodeCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return create_promo_code(db, event_id, data, current_user)


@router.get(
    "/api/events/{event_id}/promo-codes",
    response_model=list[PromoCodeResponse]
)
def list_promos(
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return get_promo_codes(db, event_id, current_user)


@router.post(
    "/api/events/{event_id}/promo-codes/validate",
    response_model=PromoCodeValidateResponse
)
def validate_promo(
    event_id: int,
    data: PromoCodeValidateRequest,
    db: Session = Depends(get_db)
):
    result = validate_promo_code(db, event_id, data.code, data.ticket_tier_id)
    return PromoCodeValidateResponse(**result)


@router.patch(
    "/api/promo-codes/{promo_id}",
    response_model=PromoCodeResponse
)
def update_promo(
    promo_id: int,
    data: PromoCodeUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return update_promo_code(db, promo_id, data, current_user)


@router.delete(
    "/api/promo-codes/{promo_id}",
    status_code=204
)
def delete_promo(
    promo_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    delete_promo_code(db, promo_id, current_user)