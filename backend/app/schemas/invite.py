from datetime import datetime
from pydantic import BaseModel, EmailStr


class InviteCreateRequest(BaseModel):
    email: EmailStr


class InviteResponse(BaseModel):
    id: int
    event_id: int
    email: str
    status: str
    sent_at: datetime
    expires_at: datetime

    class Config:
        from_attributes = True


class InviteEventInfo(BaseModel):
    id: int
    title: str
    cover_image: str | None
    start_datetime: datetime | None
    is_free: bool
    has_ticketing: bool

    class Config:
        from_attributes = True


class InviteWithEventResponse(BaseModel):
    id: int
    event_id: int
    email: str
    status: str
    sent_at: datetime
    expires_at: datetime
    event: "InviteEventInfo"

    class Config:
        from_attributes = True


class InviteUserInfo(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: str

    class Config:
        from_attributes = True


class InviteDetailResponse(BaseModel):
    id: int
    event_id: int
    email: str
    status: str
    sent_at: datetime
    expires_at: datetime
    user: "InviteUserInfo | None"

    class Config:
        from_attributes = True


class AcceptInviteResponse(BaseModel):
    requires_payment: bool
    event_id: int
    invite: InviteResponse

    class Config:
        from_attributes = True


InviteWithEventResponse.model_rebuild()
InviteDetailResponse.model_rebuild()
AcceptInviteResponse.model_rebuild()
