from pydantic import BaseModel
from datetime import datetime
from typing import Optional
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
    created_at: datetime
    deleted_at: Optional[datetime] = None

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