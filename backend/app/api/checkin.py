from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_current_user
from app.models.user import User
from app.schemas.checkin import (
    QRCheckinRequest,
    ManualCheckinRequest,
    OfflineSyncRequest,
    CheckinResponse,
    OfflineSyncResult,
    CheckinStatsResponse,
)
from app.services.checkin import (
    qr_checkin,
    manual_checkin,
    get_event_checkins,
    get_checkin_stats,
    sync_offline_checkins,
)

router = APIRouter(prefix="/api/checkin", tags=["Check-in"])


@router.post("/qr", response_model=CheckinResponse)
def checkin_by_qr(
    data: QRCheckinRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return qr_checkin(db, data, current_user)


@router.post("/manual", response_model=CheckinResponse)
def checkin_manually(
    data: ManualCheckinRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return manual_checkin(db, data, current_user)


@router.get("/{event_id}", response_model=list[CheckinResponse])
def list_checkins(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return get_event_checkins(db, event_id, current_user)


@router.get("/{event_id}/stats", response_model=CheckinStatsResponse)
def checkin_stats(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return get_checkin_stats(db, event_id, current_user)


@router.post("/offline/sync", response_model=OfflineSyncResult)
def sync_offline(
    data: OfflineSyncRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return sync_offline_checkins(db, data, current_user)