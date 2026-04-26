from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from app.schemas.utils import NaiveDatetime


# ─── Track Schemas ───────────────────────────────────────

class TrackCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    color: Optional[str] = None
    order_index: int = 0


class TrackUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    order_index: Optional[int] = None


class TrackResponse(BaseModel):
    id: int
    event_id: int
    name: str
    description: Optional[str] = None
    color: Optional[str] = None
    order_index: int
    created_at: datetime
    session_count: int = 0

    class Config:
        from_attributes = True


# ─── Session Schemas ──────────────────────────────────────

class SessionCreateRequest(BaseModel):
    title: str
    description: Optional[str] = None
    speaker_name: Optional[str] = None
    speaker_bio: Optional[str] = None
    start_datetime: NaiveDatetime
    end_datetime: NaiveDatetime
    capacity: Optional[int] = None
    requires_registration: bool = False
    location: Optional[str] = None
    order_index: int = 0


class SessionUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    speaker_name: Optional[str] = None
    speaker_bio: Optional[str] = None
    start_datetime: Optional[NaiveDatetime] = None
    end_datetime: Optional[NaiveDatetime] = None
    capacity: Optional[int] = None
    requires_registration: Optional[bool] = None
    location: Optional[str] = None
    order_index: Optional[int] = None


class SessionResponse(BaseModel):
    id: int
    track_id: int
    event_id: int
    title: str
    description: Optional[str] = None
    speaker_name: Optional[str] = None
    speaker_bio: Optional[str] = None
    start_datetime: datetime
    end_datetime: datetime
    capacity: Optional[int] = None
    requires_registration: bool
    location: Optional[str] = None
    order_index: int
    created_at: datetime
    has_conflict: bool = False

    class Config:
        from_attributes = True


# ─── Session Registration Schemas ────────────────────────

class SessionRegistrationResponse(BaseModel):
    id: int
    session_id: int
    user_id: int
    status: str
    registered_at: datetime

    class Config:
        from_attributes = True
