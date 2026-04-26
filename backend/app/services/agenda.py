from datetime import datetime
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.agenda import Track, AgendaSession, SessionRegistration
from app.models.registration import Registration
from app.schemas.agenda import (
    TrackCreateRequest,
    TrackUpdateRequest,
    SessionCreateRequest,
    SessionUpdateRequest,
)
from app.core.exceptions import NotFoundError, BadRequestError
from app.services.common import get_event_or_404, check_event_permission


def _get_session_count(db: Session, track_id: int) -> int:
    return db.query(AgendaSession).filter(
        AgendaSession.track_id == track_id,
        AgendaSession.deleted_at.is_(None),
    ).count()


def _check_session_conflicts(
    db: Session,
    track_id: int,
    start_datetime: datetime,
    end_datetime: datetime,
    exclude_session_id: int = None,
) -> bool:
    query = db.query(AgendaSession).filter(
        AgendaSession.track_id == track_id,
        AgendaSession.deleted_at.is_(None),
        AgendaSession.start_datetime < end_datetime,
        AgendaSession.end_datetime > start_datetime,
    )
    if exclude_session_id:
        query = query.filter(AgendaSession.id != exclude_session_id)
    return query.first() is not None


# track services

def create_track(db: Session, event_id: int, data: TrackCreateRequest, current_user: User) -> Track:
    event = get_event_or_404(db, event_id)
    check_event_permission(db, event, current_user)

    if db.query(Track).filter(Track.event_id == event_id, Track.name == data.name, Track.deleted_at.is_(None)).first():
        raise BadRequestError("A track with this name already exists for this event")

    track = Track(
        event_id=event_id,
        name=data.name,
        description=data.description,
        color=data.color,
        order_index=data.order_index,
    )
    db.add(track)
    db.commit()
    db.refresh(track)
    track.session_count = 0
    return track


def get_tracks(db: Session, event_id: int) -> list[Track]:
    get_event_or_404(db, event_id)
    tracks = db.query(Track).filter(
        Track.event_id == event_id,
        Track.deleted_at.is_(None),
    ).order_by(Track.order_index).all()

    if tracks:
        track_ids = [t.id for t in tracks]
        from sqlalchemy import func
        counts = dict(
            db.query(AgendaSession.track_id, func.count(AgendaSession.id))
            .filter(AgendaSession.track_id.in_(track_ids), AgendaSession.deleted_at.is_(None))
            .group_by(AgendaSession.track_id)
            .all()
        )
        for track in tracks:
            track.session_count = counts.get(track.id, 0)

    return tracks


def update_track(db: Session, track_id: int, data: TrackUpdateRequest, current_user: User) -> Track:
    track = db.query(Track).filter(Track.id == track_id, Track.deleted_at.is_(None)).first()
    if not track:
        raise NotFoundError("Track not found")

    event = get_event_or_404(db, track.event_id)
    check_event_permission(db, event, current_user)

    if data.name and data.name != track.name:
        if db.query(Track).filter(Track.event_id == track.event_id, Track.name == data.name, Track.deleted_at.is_(None)).first():
            raise BadRequestError("A track with this name already exists for this event")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(track, field, value)

    db.commit()
    db.refresh(track)
    track.session_count = _get_session_count(db, track.id)
    return track


def delete_track(db: Session, track_id: int, current_user: User) -> None:
    track = db.query(Track).filter(Track.id == track_id, Track.deleted_at.is_(None)).first()
    if not track:
        raise NotFoundError("Track not found")

    event = get_event_or_404(db, track.event_id)
    check_event_permission(db, event, current_user)

    track.deleted_at = datetime.now()
    db.commit()


# session services

def create_session(db: Session, track_id: int, data: SessionCreateRequest, current_user: User) -> AgendaSession:
    track = db.query(Track).filter(Track.id == track_id, Track.deleted_at.is_(None)).first()
    if not track:
        raise NotFoundError("Track not found")

    event = get_event_or_404(db, track.event_id)
    check_event_permission(db, event, current_user)

    if data.end_datetime <= data.start_datetime:
        raise BadRequestError("Session end time must be after start time")

    if data.start_datetime < event.start_datetime or data.end_datetime > event.end_datetime:
        raise BadRequestError("Session times must be within event start and end datetime")

    has_conflict = _check_session_conflicts(db, track_id, data.start_datetime, data.end_datetime)

    session = AgendaSession(
        track_id=track_id,
        event_id=track.event_id,
        title=data.title,
        description=data.description,
        speaker_name=data.speaker_name,
        speaker_bio=data.speaker_bio,
        start_datetime=data.start_datetime,
        end_datetime=data.end_datetime,
        capacity=data.capacity,
        requires_registration=data.requires_registration,
        location=data.location,
        order_index=data.order_index,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    session.has_conflict = has_conflict
    return session


def get_sessions_by_event(db: Session, event_id: int) -> list[AgendaSession]:
    get_event_or_404(db, event_id)
    sessions = db.query(AgendaSession).filter(
        AgendaSession.event_id == event_id,
        AgendaSession.deleted_at.is_(None),
    ).order_by(AgendaSession.start_datetime).all()

    for session in sessions:
        session.has_conflict = _check_session_conflicts(
            db, session.track_id, session.start_datetime, session.end_datetime,
            exclude_session_id=session.id,
        )

    return sessions


def get_sessions_by_track(db: Session, track_id: int) -> list[AgendaSession]:
    track = db.query(Track).filter(Track.id == track_id, Track.deleted_at.is_(None)).first()
    if not track:
        raise NotFoundError("Track not found")

    sessions = db.query(AgendaSession).filter(
        AgendaSession.track_id == track_id,
        AgendaSession.deleted_at.is_(None),
    ).order_by(AgendaSession.order_index).all()

    for session in sessions:
        session.has_conflict = _check_session_conflicts(
            db, session.track_id, session.start_datetime, session.end_datetime,
            exclude_session_id=session.id,
        )

    return sessions


def update_session(db: Session, session_id: int, data: SessionUpdateRequest, current_user: User) -> AgendaSession:
    session = db.query(AgendaSession).filter(AgendaSession.id == session_id, AgendaSession.deleted_at.is_(None)).first()
    if not session:
        raise NotFoundError("Session not found")

    event = get_event_or_404(db, session.event_id)
    check_event_permission(db, event, current_user)

    final_start = data.start_datetime or session.start_datetime
    final_end = data.end_datetime or session.end_datetime

    if final_end <= final_start:
        raise BadRequestError("Session end time must be after start time")

    if final_start < event.start_datetime or final_end > event.end_datetime:
        raise BadRequestError("Session times must be within event start and end datetime")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(session, field, value)

    db.commit()
    db.refresh(session)

    session.has_conflict = _check_session_conflicts(
        db, session.track_id, session.start_datetime, session.end_datetime,
        exclude_session_id=session.id,
    )
    return session


def delete_session(db: Session, session_id: int, current_user: User) -> None:
    session = db.query(AgendaSession).filter(AgendaSession.id == session_id, AgendaSession.deleted_at.is_(None)).first()
    if not session:
        raise NotFoundError("Session not found")

    event = get_event_or_404(db, session.event_id)
    check_event_permission(db, event, current_user)

    session.deleted_at = datetime.now()
    db.commit()


# session registration

def register_for_session(db: Session, session_id: int, current_user: User) -> SessionRegistration:
    session = db.query(AgendaSession).filter(AgendaSession.id == session_id, AgendaSession.deleted_at.is_(None)).first()
    if not session:
        raise NotFoundError("Session not found")

    if not session.requires_registration:
        raise BadRequestError("This session does not require registration")

    event_registration = db.query(Registration).filter(
        Registration.event_id == session.event_id,
        Registration.user_id == current_user.id,
        Registration.status == "confirmed",
    ).first()

    if not event_registration:
        raise BadRequestError("You must be registered for the event to register for a session")

    if db.query(SessionRegistration).filter(
        SessionRegistration.session_id == session_id,
        SessionRegistration.user_id == current_user.id,
    ).first():
        raise BadRequestError("You are already registered for this session")

    if session.capacity:
        count = db.query(SessionRegistration).filter(
            SessionRegistration.session_id == session_id,
            SessionRegistration.status == "confirmed",
        ).count()
        if count >= session.capacity:
            raise BadRequestError("Session is at full capacity")

    reg = SessionRegistration(
        session_id=session_id,
        user_id=current_user.id,
        event_id=session.event_id,
        registration_id=event_registration.id,
        status="confirmed",
    )
    db.add(reg)
    db.commit()
    db.refresh(reg)
    return reg


def cancel_session_registration(db: Session, session_id: int, current_user: User) -> None:
    reg = db.query(SessionRegistration).filter(
        SessionRegistration.session_id == session_id,
        SessionRegistration.user_id == current_user.id,
    ).first()

    if not reg:
        raise NotFoundError("Session registration not found")

    reg.status = "cancelled"
    db.commit()


def get_session_registrations(db: Session, session_id: int, current_user: User) -> list[SessionRegistration]:
    session = db.query(AgendaSession).filter(AgendaSession.id == session_id, AgendaSession.deleted_at.is_(None)).first()
    if not session:
        raise NotFoundError("Session not found")

    event = get_event_or_404(db, session.event_id)
    check_event_permission(db, event, current_user)

    return db.query(SessionRegistration).filter(SessionRegistration.session_id == session_id).all()
