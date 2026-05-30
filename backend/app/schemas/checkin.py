from pydantic import BaseModel
from datetime import datetime


class QRCheckinRequest(BaseModel):
    qr_code: str
    event_id: int


class ManualCheckinRequest(BaseModel):
    event_id: int
    registration_id: int


class OfflineCheckinItem(BaseModel):
    qr_code: str
    event_id: int
    scanned_at: datetime


class OfflineSyncRequest(BaseModel):
    items: list[OfflineCheckinItem]


class CheckinResponse(BaseModel):
    id: int
    ticket_id: int
    registration_id: int
    event_id: int
    user_id: int
    checked_in_by: int
    checked_in_at: datetime
    is_manual: bool

    class Config:
        from_attributes = True


class OfflineSyncResult(BaseModel):
    synced: int
    conflicts: int
    details: list[dict]


class CheckinStatsResponse(BaseModel):
    event_id: int
    total_registered: int
    total_checked_in: int
    attendance_rate: float
    remaining: int