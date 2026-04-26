from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Literal, List
from app.schemas.utils import NaiveDatetime


class EventCreateRequest(BaseModel):
    title: str
    description: str
    location_type: Literal["physical", "online", "hybrid"]
    physical_address: Optional[str] = None
    online_link: Optional[str] = None
    start_datetime: NaiveDatetime
    end_datetime: NaiveDatetime
    capacity: Optional[int] = None
    registration_type: Literal["automatic", "manual", "invite_only"] = "automatic"
    requires_registration: bool = True
    has_ticketing: bool = True
    is_free: bool = False
    feedback_visibility: Literal["public", "organizer_only"] = "organizer_only"
    category_ids: Optional[List[int]] = None


class EventUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    location_type: Optional[Literal["physical", "online", "hybrid"]] = None
    physical_address: Optional[str] = None
    online_link: Optional[str] = None
    start_datetime: Optional[NaiveDatetime] = None
    end_datetime: Optional[NaiveDatetime] = None
    capacity: Optional[int] = None
    registration_type: Optional[Literal["automatic", "manual", "invite_only"]] = None
    requires_registration: Optional[bool] = None
    has_ticketing: Optional[bool] = None
    is_free: Optional[bool] = None
    feedback_visibility: Optional[Literal["public", "organizer_only"]] = None
    category_ids: Optional[List[int]] = None


class CategoryResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None

    class Config:
        from_attributes = True


class EventResponse(BaseModel):
    id: int
    owner_id: int
    title: str
    description: str
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
    status: str
    feedback_visibility: str
    created_at: datetime
    updated_at: datetime
    category_ids: List[int] = []

    class Config:
        from_attributes = True