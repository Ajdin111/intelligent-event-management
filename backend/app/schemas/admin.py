from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
from decimal import Decimal


# ─── User Schemas ─────────────────────────────────────────────────────

class AdminUserResponse(BaseModel):
    id: int
    email: str
    first_name: str
    last_name: str
    is_active: bool
    is_admin: bool
    is_organizer: bool
    role: Optional[str] = None  # 'Admin', 'Organizer', 'Attendee'
    created_at: datetime
    deleted_at: Optional[datetime] = None


# ─── Event Schemas ────────────────────────────────────────────────────

class AdminEventResponse(BaseModel):
    id: int
    title: str
    status: str  # 'draft', 'published', 'cancelled', 'closed'
    location_type: str  # 'physical', 'online', 'hybrid'
    physical_address: Optional[str] = None
    start_datetime: datetime
    end_datetime: datetime
    capacity: Optional[int] = None
    is_free: bool
    owner_id: int
    owner_email: Optional[str] = None
    total_registrations: Optional[int] = None
    total_revenue: Optional[Decimal] = None
    created_at: datetime
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class AdminEventDetailResponse(BaseModel):
    id: int
    title: str
    description: str
    status: str
    location_type: str
    physical_address: Optional[str] = None
    online_link: Optional[str] = None
    start_datetime: datetime
    end_datetime: datetime
    capacity: Optional[int] = None
    registration_type: str
    requires_registration: bool
    has_ticketing: bool
    is_free: bool
    feedback_visibility: str
    owner_id: int
    owner_email: Optional[str] = None
    owner_first_name: Optional[str] = None
    owner_last_name: Optional[str] = None
    category_ids: List[int] = []
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ─── Event Analytics Schemas ─────────────────────────────────────────

class AdminEventAnalyticsResponse(BaseModel):
    event_id: int
    total_registrations: int
    confirmed_registrations: int
    cancelled_registrations: int
    total_checked_in: int
    attendance_rate: Decimal
    total_revenue: Decimal
    average_rating: Decimal
    total_reviews: int
    positive_sentiment_pct: Decimal
    negative_sentiment_pct: Decimal
    neutral_sentiment_pct: Decimal
    last_updated: datetime

    class Config:
        from_attributes = True


# ─── Analytics Schemas ────────────────────────────────────────────────

class PlatformAnalyticsResponse(BaseModel):
    total_users: int
    total_events: int
    total_registrations: int
    total_revenue: Decimal
    active_events: int
    computed_at: datetime

    class Config:
        from_attributes = True