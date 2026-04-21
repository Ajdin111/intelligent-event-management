from datetime import datetime
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.user import User
from app.models.event import Event, EventCollaborator
from app.models.agenda import Track, Session as SessionModel, SessionRegistration
from app.models.registration import Registration
from app.schemas.agenda import (
    TrackCreateRequest,
    TrackUpdateRequest,
    SessionCreateRequest,
    SessionUpdateRequest
)


# helpers

def _get_event_or_404(db: Session, event_id: int) -> Event:
    event = db.query(Event).filter(
        Event.id == event_id,
        Event.deleted_at.is_(None)
    ).first()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    return event


def _check_event_permission(db: Session, event: Event, current_user: User) -> None:
    is_owner = event.owner_id == current_user.id
    is_collaborator = db.query(EventCollaborator).filter(
        EventCollaborator.event_id == event.id,
        EventCollaborator.user_id == current_user.id
    ).first()
    if not is_owner and not is_collaborator:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to manage this event agenda"
        )


def _check_session_conflicts(
    db: Session,
    track_id: int,
    start_time: datetime,
    end_time: datetime,
    exclude_session_id: int = None
) -> bool:
    query = db.query(SessionModel).filter(
        SessionModel.track_id == track_id,
        SessionModel.start_time < end_time,
        SessionModel.end_time > start_time
    )
    if exclude_session_id:
        query = query.filter(SessionModel.id != exclude_session_id)
    return query.first() is not None


def _get_session_count(db: Session, track_id: int) -> int:
    return db.query(SessionModel).filter(
        SessionModel.track_id == track_id
    ).count()


#track services

def create_track(
    db: Session,
    event_id: int,
    data: TrackCreateRequest,
    current_user: User
) -> Track:
    event = _get_event_or_404(db, event_id)
    _check_event_permission(db, event, current_user)

    # check track name is unique within event
    existing = db.query(Track).filter(
        Track.event_id == event_id,
        Track.name == data.name
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A track with this name already exists for this event"
        )

    track = Track(
        event_id=event_id,
        name=data.name,
        description=data.description,
        color=data.color,
        order_index=data.order_index
    )
    db.add(track)
    db.commit()
    db.refresh(track)
    track.session_count = 0
    return track


def get_tracks(db: Session, event_id: int) -> list[Track]:
    _get_event_or_404(db, event_id)
    tracks = db.query(Track).filter(
        Track.event_id == event_id
    ).order_by(Track.order_index).all()

    for track in tracks:
        track.session_count = _get_session_count(db, track.id)

    return tracks


def update_track(
    db: Session,
    track_id: int,
    data: TrackUpdateRequest,
    current_user: User
) -> Track:
    track = db.query(Track).filter(Track.id == track_id).first()
    if not track:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Track not found"
        )

    event = _get_event_or_404(db, track.event_id)
    _check_event_permission(db, event, current_user)

    # check name uniqueness if name is being updated
    if data.name and data.name != track.name:
        existing = db.query(Track).filter(
            Track.event_id == track.event_id,
            Track.name == data.name
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A track with this name already exists for this event"
            )

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(track, field, value)

    db.commit()
    db.refresh(track)
    track.session_count = _get_session_count(db, track.id)
    return track


def delete_track(
    db: Session,
    track_id: int,
    current_user: User
) -> None:
    track = db.query(Track).filter(Track.id == track_id).first()
    if not track:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Track not found"
        )

    event = _get_event_or_404(db, track.event_id)
    _check_event_permission(db, event, current_user)

    db.delete(track)
    db.commit()


# session

def create_session(
    db: Session,
    track_id: int,
    data: SessionCreateRequest,
    current_user: User
) -> SessionModel:
    track = db.query(Track).filter(Track.id == track_id).first()
    if not track:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Track not found"
        )

    event = _get_event_or_404(db, track.event_id)
    _check_event_permission(db, event, current_user)

    # validate session times
    if data.end_time <= data.start_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session end time must be after start time"
        )

    # validate session is within event timeframe
    if data.start_time < event.start_datetime or data.end_time > event.end_datetime:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session times must be within event start and end datetime"
        )

    # check for conflicts in same track
    has_conflict = _check_session_conflicts(
        db, track_id, data.start_time, data.end_time
    )

    session = SessionModel(
        track_id=track_id,
        event_id=track.event_id,
        title=data.title,
        description=data.description,
        speaker_name=data.speaker_name,
        speaker_bio=data.speaker_bio,
        start_time=data.start_time,
        end_time=data.end_time,
        capacity=data.capacity,
        requires_registration=data.requires_registration,
        location=data.location,
        order_index=data.order_index
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    session.has_conflict = has_conflict
    return session


def get_sessions_by_event(db: Session, event_id: int) -> list[SessionModel]:
    _get_event_or_404(db, event_id)
    sessions = db.query(SessionModel).filter(
        SessionModel.event_id == event_id
    ).order_by(SessionModel.start_time).all()

    for session in sessions:
        session.has_conflict = _check_session_conflicts(
            db, session.track_id,
            session.start_time, session.end_time,
            exclude_session_id=session.id
        )

    return sessions


def get_sessions_by_track(db: Session, track_id: int) -> list[SessionModel]:
    track = db.query(Track).filter(Track.id == track_id).first()
    if not track:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Track not found"
        )

    sessions = db.query(SessionModel).filter(
        SessionModel.track_id == track_id
    ).order_by(SessionModel.order_index).all()

    for session in sessions:
        session.has_conflict = _check_session_conflicts(
            db, session.track_id,
            session.start_time, session.end_time,
            exclude_session_id=session.id
        )

    return sessions


def update_session(
    db: Session,
    session_id: int,
    data: SessionUpdateRequest,
    current_user: User
) -> SessionModel:
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )

    event = _get_event_or_404(db, session.event_id)
    _check_event_permission(db, event, current_user)

    # validate times if being updated
    final_start = data.start_time or session.start_time
    final_end = data.end_time or session.end_time

    if final_end <= final_start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session end time must be after start time"
        )

    if final_start < event.start_datetime or final_end > event.end_datetime:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session times must be within event start and end datetime"
        )

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(session, field, value)

    db.commit()
    db.refresh(session)

    session.has_conflict = _check_session_conflicts(
        db, session.track_id,
        session.start_time, session.end_time,
        exclude_session_id=session.id
    )

    return session


def delete_session(
    db: Session,
    session_id: int,
    current_user: User
) -> None:
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )

    event = _get_event_or_404(db, session.event_id)
    _check_event_permission(db, event, current_user)

    db.delete(session)
    db.commit()


# session registration

def register_for_session(
    db: Session,
    session_id: int,
    current_user: User
) -> SessionRegistration:
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )

    # check session requires registration
    if not session.requires_registration:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This session does not require registration"
        )

    # check user is registered for the event
    event_registration = db.query(Registration).filter(
        Registration.event_id == session.event_id,
        Registration.user_id == current_user.id,
        Registration.status == "confirmed"
    ).first()

    if not event_registration:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must be registered for the event to register for a session"
        )

    # check not already registered for this session
    existing = db.query(SessionRegistration).filter(
        SessionRegistration.session_id == session_id,
        SessionRegistration.user_id == current_user.id
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already registered for this session"
        )

    # check capacity
    if session.capacity:
        current_count = db.query(SessionRegistration).filter(
            SessionRegistration.session_id == session_id,
            SessionRegistration.status == "confirmed"
        ).count()
        if current_count >= session.capacity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Session is at full capacity"
            )

    session_registration = SessionRegistration(
        session_id=session_id,
        user_id=current_user.id,
        event_id=session.event_id,
        registration_id=event_registration.id,
        status="confirmed"
    )
    db.add(session_registration)
    db.commit()
    db.refresh(session_registration)
    return session_registration


def cancel_session_registration(
    db: Session,
    session_id: int,
    current_user: User
) -> None:
    session_registration = db.query(SessionRegistration).filter(
        SessionRegistration.session_id == session_id,
        SessionRegistration.user_id == current_user.id
    ).first()

    if not session_registration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session registration not found"
        )

    session_registration.status = "cancelled"
    db.commit()


def get_session_registrations(
    db: Session,
    session_id: int,
    current_user: User
) -> list[SessionRegistration]:
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )

    event = _get_event_or_404(db, session.event_id)
    _check_event_permission(db, event, current_user)

    return db.query(SessionRegistration).filter(
        SessionRegistration.session_id == session_id
    ).all()