from pydantic import BaseModel
from datetime import datetime
from typing import Optional


# ─── Notification Schemas ─────────────────────────────────

class NotificationResponse(BaseModel):
    id: int
    user_id: int
    title: str
    message: str
    type: str
    is_read: bool
    created_at: datetime
    read_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UnreadCountResponse(BaseModel):
    unread_count: int


# ─── Notification Preferences Schemas ────────────────────

class NotificationPreferencesResponse(BaseModel):
    id: int
    user_id: int
    registration_confirmation: bool
    event_reminders: bool
    approval_updates: bool
    feedback_requests: bool
    waitlist_updates: bool
    invite_notifications: bool
    email_enabled: bool
    in_app_enabled: bool
    updated_at: datetime

    class Config:
        from_attributes = True


class NotificationPreferencesUpdateRequest(BaseModel):
    registration_confirmation: Optional[bool] = None
    event_reminders: Optional[bool] = None
    approval_updates: Optional[bool] = None
    feedback_requests: Optional[bool] = None
    waitlist_updates: Optional[bool] = None
    invite_notifications: Optional[bool] = None
    email_enabled: Optional[bool] = None
    in_app_enabled: Optional[bool] = None