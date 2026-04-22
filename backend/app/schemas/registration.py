from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Literal


# registration schema

class RegistrationCreateRequest(BaseModel):
    event_id: int
    ticket_tier_id: Optional[int] = None
    promo_code: Optional[str] = None
    quantity: int = 1


class RegistrationResponse(BaseModel):
    id: int
    event_id: int
    user_id: int
    ticket_tier_id: Optional[int] = None
    promo_code_id: Optional[int] = None
    quantity: int
    total_amount: float
    status: str
    registered_at: datetime
    cancelled_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    approved_by: Optional[int] = None
    cancellation_reason: Optional[str] = None

    class Config:
        from_attributes = True


class RegistrationCancelRequest(BaseModel):
    cancellation_reason: Optional[str] = None


class RegistrationApproveRequest(BaseModel):
    pass


class RegistrationRejectRequest(BaseModel):
    cancellation_reason: Optional[str] = None


# ticket schema

class TicketResponse(BaseModel):
    id: int
    registration_id: int
    ticket_tier_id: Optional[int] = None
    user_id: int
    event_id: int
    guest_name: Optional[str] = None
    guest_email: Optional[str] = None
    is_guest: bool
    qr_code: str
    is_valid: bool
    issued_at: datetime

    class Config:
        from_attributes = True


# waitlist schema

class WaitlistResponse(BaseModel):
    id: int
    event_id: int
    user_id: int
    ticket_tier_id: Optional[int] = None
    position: int
    status: str
    joined_at: datetime
    notified_at: Optional[datetime] = None
    confirmation_deadline: Optional[datetime] = None

    class Config:
        from_attributes = True