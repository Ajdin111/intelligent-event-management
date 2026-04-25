from datetime import datetime
from decimal import Decimal
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.ticket import TicketTier, PromoCode
from app.schemas.ticket import (
    TicketTierCreateRequest,
    TicketTierUpdateRequest,
    PromoCodeCreateRequest,
    PromoCodeUpdateRequest,
)
from app.core.exceptions import NotFoundError, BadRequestError
from app.services.common import get_event_or_404, check_event_permission


# ticket tier service

def create_ticket_tier(db: Session, event_id: int, data: TicketTierCreateRequest, current_user: User) -> TicketTier:
    event = get_event_or_404(db, event_id)
    check_event_permission(db, event, current_user)

    if data.sale_end <= data.sale_start:
        raise BadRequestError("Sale end must be after sale start")
    if data.price < 0:
        raise BadRequestError("Price cannot be negative")
    if data.quantity <= 0:
        raise BadRequestError("Quantity must be greater than zero")

    tier = TicketTier(
        event_id=event_id,
        name=data.name,
        description=data.description,
        price=data.price,
        quantity=data.quantity,
        quantity_sold=0,
        sale_start=data.sale_start,
        sale_end=data.sale_end,
        is_active=data.is_active,
    )
    db.add(tier)
    db.commit()
    db.refresh(tier)

    tier.quantity_available = tier.quantity - tier.quantity_sold
    tier.is_sold_out = tier.quantity_sold >= tier.quantity
    return tier


def get_ticket_tiers(db: Session, event_id: int) -> list[TicketTier]:
    get_event_or_404(db, event_id)
    tiers = db.query(TicketTier).filter(TicketTier.event_id == event_id).all()
    for tier in tiers:
        tier.quantity_available = tier.quantity - tier.quantity_sold
        tier.is_sold_out = tier.quantity_sold >= tier.quantity
    return tiers


def update_ticket_tier(db: Session, tier_id: int, data: TicketTierUpdateRequest, current_user: User) -> TicketTier:
    tier = db.query(TicketTier).filter(TicketTier.id == tier_id).first()
    if not tier:
        raise NotFoundError("Ticket tier not found")

    event = get_event_or_404(db, tier.event_id)
    check_event_permission(db, event, current_user)

    if data.quantity is not None and data.quantity < tier.quantity_sold:
        raise BadRequestError(f"Cannot reduce quantity below already sold amount ({tier.quantity_sold})")
    if data.price is not None and data.price < 0:
        raise BadRequestError("Price cannot be negative")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(tier, field, value)

    db.commit()
    db.refresh(tier)

    tier.quantity_available = tier.quantity - tier.quantity_sold
    tier.is_sold_out = tier.quantity_sold >= tier.quantity
    return tier


def delete_ticket_tier(db: Session, tier_id: int, current_user: User) -> None:
    tier = db.query(TicketTier).filter(TicketTier.id == tier_id).first()
    if not tier:
        raise NotFoundError("Ticket tier not found")

    event = get_event_or_404(db, tier.event_id)
    check_event_permission(db, event, current_user)

    if tier.quantity_sold > 0:
        raise BadRequestError("Cannot delete a ticket tier that has sold tickets")

    db.delete(tier)
    db.commit()


# promo code service

def create_promo_code(db: Session, event_id: int, data: PromoCodeCreateRequest, current_user: User) -> PromoCode:
    event = get_event_or_404(db, event_id)
    check_event_permission(db, event, current_user)

    if db.query(PromoCode).filter(PromoCode.event_id == event_id, PromoCode.code == data.code.upper()).first():
        raise BadRequestError("Promo code already exists for this event")

    if data.discount_type == "percentage" and not (0 < data.discount_value <= 100):
        raise BadRequestError("Percentage discount must be between 1 and 100")
    if data.discount_type == "fixed" and data.discount_value <= 0:
        raise BadRequestError("Fixed discount must be greater than zero")
    if data.valid_until <= data.valid_from:
        raise BadRequestError("Valid until must be after valid from")

    promo = PromoCode(
        event_id=event_id,
        code=data.code.upper(),
        discount_type=data.discount_type,
        discount_value=data.discount_value,
        max_uses=data.max_uses,
        uses_count=0,
        valid_from=data.valid_from,
        valid_until=data.valid_until,
        is_active=data.is_active,
    )
    db.add(promo)
    db.commit()
    db.refresh(promo)

    promo.is_valid = _check_promo_validity(promo)
    return promo


def get_promo_codes(db: Session, event_id: int, current_user: User) -> list[PromoCode]:
    event = get_event_or_404(db, event_id)
    check_event_permission(db, event, current_user)

    promos = db.query(PromoCode).filter(PromoCode.event_id == event_id).all()
    for promo in promos:
        promo.is_valid = _check_promo_validity(promo)
    return promos


def _check_promo_validity(promo: PromoCode) -> bool:
    now = datetime.now()
    return (
        promo.is_active
        and promo.uses_count < promo.max_uses
        and promo.valid_from <= now <= promo.valid_until
    )


def validate_promo_code(db: Session, event_id: int, code: str, ticket_tier_id: int) -> dict:
    promo = db.query(PromoCode).filter(
        PromoCode.event_id == event_id,
        PromoCode.code == code.upper(),
    ).first()

    if not promo:
        return {"is_valid": False, "message": "Promo code not found"}
    if not _check_promo_validity(promo):
        return {"is_valid": False, "message": "Promo code is expired or no longer valid"}

    tier = db.query(TicketTier).filter(TicketTier.id == ticket_tier_id).first()
    if not tier:
        return {"is_valid": False, "message": "Ticket tier not found"}

    if promo.discount_type == "percentage":
        final_price = max(Decimal("0"), tier.price - tier.price * (promo.discount_value / Decimal("100")))
    else:
        final_price = max(Decimal("0"), tier.price - promo.discount_value)

    return {
        "is_valid": True,
        "discount_type": promo.discount_type,
        "discount_value": promo.discount_value,
        "final_price": final_price.quantize(Decimal("0.01")),
        "message": "Promo code applied successfully",
    }


def update_promo_code(db: Session, promo_id: int, data: PromoCodeUpdateRequest, current_user: User) -> PromoCode:
    promo = db.query(PromoCode).filter(PromoCode.id == promo_id).first()
    if not promo:
        raise NotFoundError("Promo code not found")

    event = get_event_or_404(db, promo.event_id)
    check_event_permission(db, event, current_user)

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(promo, field, value)

    db.commit()
    db.refresh(promo)
    promo.is_valid = _check_promo_validity(promo)
    return promo


def delete_promo_code(db: Session, promo_id: int, current_user: User) -> None:
    promo = db.query(PromoCode).filter(PromoCode.id == promo_id).first()
    if not promo:
        raise NotFoundError("Promo code not found")

    event = get_event_or_404(db, promo.event_id)
    check_event_permission(db, event, current_user)

    db.delete(promo)
    db.commit()
