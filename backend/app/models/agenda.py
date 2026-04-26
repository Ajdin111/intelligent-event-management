from sqlalchemy import Boolean, DateTime, Integer, String, Text, func, ForeignKey
from sqlalchemy.orm import mapped_column, relationship
from app.db.base import Base


class Track(Base):
    __tablename__ = "tracks"

    id = mapped_column(Integer, primary_key=True)
    event_id = mapped_column(Integer, ForeignKey("events.id"), nullable=False)
    name = mapped_column(String(255), nullable=False)
    description = mapped_column(Text, nullable=True)
    color = mapped_column(String(20), nullable=True)
    order_index = mapped_column(Integer, nullable=False, default=0)
    deleted_at = mapped_column(DateTime, nullable=True)
    created_at = mapped_column(DateTime, server_default=func.now())

    # relationships
    event = relationship("Event")
    sessions = relationship("AgendaSession", back_populates="track", cascade="all, delete-orphan")


class AgendaSession(Base):
    __tablename__ = "sessions"

    id = mapped_column(Integer, primary_key=True)
    track_id = mapped_column(Integer, ForeignKey("tracks.id"), nullable=False)
    event_id = mapped_column(Integer, ForeignKey("events.id"), nullable=False)
    title = mapped_column(String(255), nullable=False)
    description = mapped_column(Text, nullable=True)
    speaker_name = mapped_column(String(255), nullable=True)
    speaker_bio = mapped_column(Text, nullable=True)
    start_datetime = mapped_column(DateTime, nullable=False)
    end_datetime = mapped_column(DateTime, nullable=False)
    capacity = mapped_column(Integer, nullable=True)
    requires_registration = mapped_column(Boolean, nullable=False, default=False)
    location = mapped_column(String(255), nullable=True)
    order_index = mapped_column(Integer, nullable=False, default=0)
    deleted_at = mapped_column(DateTime, nullable=True)
    created_at = mapped_column(DateTime, server_default=func.now())

    # relationships
    track = relationship("Track", back_populates="sessions")
    event = relationship("Event")
    session_registrations = relationship("SessionRegistration", back_populates="session", cascade="all, delete-orphan")


class SessionRegistration(Base):
    __tablename__ = "session_registrations"

    id = mapped_column(Integer, primary_key=True)
    session_id = mapped_column(Integer, ForeignKey("sessions.id"), nullable=False)
    user_id = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    event_id = mapped_column(Integer, ForeignKey("events.id"), nullable=False)
    registration_id = mapped_column(Integer, ForeignKey("registrations.id"), nullable=False)
    status = mapped_column(String(20), nullable=False, default="confirmed")
    # 'confirmed', 'cancelled'
    registered_at = mapped_column(DateTime, server_default=func.now())

    # relationships
    session = relationship("AgendaSession", back_populates="session_registrations")
    user = relationship("User")
