from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_current_user
from app.models.user import User
from app.schemas.agenda import (
    TrackCreateRequest,
    TrackUpdateRequest,
    TrackResponse,
    SessionCreateRequest,
    SessionUpdateRequest,
    SessionResponse,
    SessionRegistrationResponse
)
from app.services.agenda import (
    create_track,
    get_tracks,
    update_track,
    delete_track,
    create_session,
    get_sessions_by_event,
    get_sessions_by_track,
    update_session,
    delete_session,
    register_for_session,
    cancel_session_registration,
    get_session_registrations
)

router = APIRouter(tags=["agenda"])


# ─── Track Endpoints ──────────────────────────────────────

@router.post(
    "/api/events/{event_id}/tracks",
    response_model=TrackResponse,
    status_code=201
)
def create_track_endpoint(
    event_id: int,
    data: TrackCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return create_track(db, event_id, data, current_user)


@router.get(
    "/api/events/{event_id}/tracks",
    response_model=list[TrackResponse]
)
def list_tracks(
    event_id: int,
    db: Session = Depends(get_db)
):
    return get_tracks(db, event_id)


@router.patch(
    "/api/tracks/{track_id}",
    response_model=TrackResponse
)
def update_track_endpoint(
    track_id: int,
    data: TrackUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return update_track(db, track_id, data, current_user)


@router.delete(
    "/api/tracks/{track_id}",
    status_code=204
)
def delete_track_endpoint(
    track_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    delete_track(db, track_id, current_user)


# ─── Session Endpoints ────────────────────────────────────

@router.post(
    "/api/tracks/{track_id}/sessions",
    response_model=SessionResponse,
    status_code=201
)
def create_session_endpoint(
    track_id: int,
    data: SessionCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return create_session(db, track_id, data, current_user)


@router.get(
    "/api/events/{event_id}/sessions",
    response_model=list[SessionResponse]
)
def list_sessions_by_event(
    event_id: int,
    db: Session = Depends(get_db)
):
    return get_sessions_by_event(db, event_id)


@router.get(
    "/api/tracks/{track_id}/sessions",
    response_model=list[SessionResponse]
)
def list_sessions_by_track(
    track_id: int,
    db: Session = Depends(get_db)
):
    return get_sessions_by_track(db, track_id)


@router.patch(
    "/api/sessions/{session_id}",
    response_model=SessionResponse
)
def update_session_endpoint(
    session_id: int,
    data: SessionUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return update_session(db, session_id, data, current_user)


@router.delete(
    "/api/sessions/{session_id}",
    status_code=204
)
def delete_session_endpoint(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    delete_session(db, session_id, current_user)


# ─── Session Registration Endpoints ──────────────────────

@router.post(
    "/api/sessions/{session_id}/register",
    response_model=SessionRegistrationResponse,
    status_code=201
)
def register_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return register_for_session(db, session_id, current_user)


@router.delete(
    "/api/sessions/{session_id}/register",
    status_code=204
)
def cancel_session_reg(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    cancel_session_registration(db, session_id, current_user)


@router.get(
    "/api/sessions/{session_id}/registrations",
    response_model=list[SessionRegistrationResponse]
)
def session_registrations(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return get_session_registrations(db, session_id, current_user)