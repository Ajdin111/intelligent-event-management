from datetime import datetime
from pydantic import BaseModel, EmailStr


class CollaboratorInviteRequest(BaseModel):
    email: EmailStr


class CollaboratorResponse(BaseModel):
    id: int
    event_id: int
    user_id: int
    added_by: int | None
    status: str
    added_at: datetime

    class Config:
        from_attributes = True


class CollaboratorWithUserResponse(BaseModel):
    id: int
    event_id: int
    status: str
    added_at: datetime
    user: "CollaboratorUserInfo"

    class Config:
        from_attributes = True


class CollaboratorUserInfo(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: str
    profile_picture: str | None

    class Config:
        from_attributes = True


class PendingInviteResponse(BaseModel):
    id: int
    event_id: int
    status: str
    added_at: datetime
    event: "CollaboratorEventInfo"

    class Config:
        from_attributes = True


class CollaboratorEventInfo(BaseModel):
    id: int
    title: str
    cover_image: str | None
    start_datetime: datetime | None

    class Config:
        from_attributes = True


CollaboratorWithUserResponse.model_rebuild()
PendingInviteResponse.model_rebuild()