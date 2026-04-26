from pydantic import BaseModel
from datetime import datetime
from decimal import Decimal
from typing import Optional, Literal
from app.schemas.utils import NaiveDatetime


class TicketTierCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    price: Decimal = Decimal("0.00")
    quantity: int
    sale_start: NaiveDatetime
    sale_end: NaiveDatetime
    is_active: bool = True


class TicketTierUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[Decimal] = None
    quantity: Optional[int] = None
    sale_start: Optional[NaiveDatetime] = None
    sale_end: Optional[NaiveDatetime] = None
    is_active: Optional[bool] = None


class TicketTierResponse(BaseModel):
    id: int
    event_id: int
    name: str
    description: Optional[str] = None
    price: Decimal
    quantity: int
    quantity_sold: int
    quantity_available: int
    sale_start: datetime
    sale_end: datetime
    is_active: bool
    is_sold_out: bool
    created_at: datetime

    class Config:
        from_attributes = True


# promo code

class PromoCodeCreateRequest(BaseModel):
    code: str
    discount_type: Literal["percentage", "fixed"]
    discount_value: Decimal
    max_uses: int
    valid_from: NaiveDatetime
    valid_until: NaiveDatetime
    is_active: bool = True


class PromoCodeUpdateRequest(BaseModel):
    discount_type: Optional[Literal["percentage", "fixed"]] = None
    discount_value: Optional[Decimal] = None
    max_uses: Optional[int] = None
    valid_from: Optional[NaiveDatetime] = None
    valid_until: Optional[NaiveDatetime] = None
    is_active: Optional[bool] = None


class PromoCodeResponse(BaseModel):
    id: int
    event_id: int
    code: str
    discount_type: str
    discount_value: Decimal
    max_uses: int
    uses_count: int
    valid_from: datetime
    valid_until: datetime
    is_active: bool
    is_valid: bool
    created_at: datetime

    class Config:
        from_attributes = True


class PromoCodeValidateRequest(BaseModel):
    code: str
    ticket_tier_id: int


class PromoCodeValidateResponse(BaseModel):
    is_valid: bool
    discount_type: Optional[str] = None
    discount_value: Optional[Decimal] = None
    final_price: Optional[Decimal] = None
    message: str
