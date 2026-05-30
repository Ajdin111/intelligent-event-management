# backend/app/schemas/review.py
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

class ReviewCreateRequest(BaseModel):
    event_id: int
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None
    is_anonymous: bool = False

class ReviewUpdateRequest(BaseModel):
    rating: Optional[int] = Field(None, ge=1, le=5)
    comment: Optional[str] = None
    is_anonymous: Optional[bool] = None

class ReviewResponse(BaseModel):
    id: int
    event_id: int
    user_id: Optional[int] = None
    rating: int
    comment: Optional[str] = None
    sentiment: Optional[str] = None
    is_anonymous: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True