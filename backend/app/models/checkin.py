from sqlalchemy import Boolean, DateTime, Integer, String, Text, func, ForeignKey
from sqlalchemy.orm import mapped_column, relationship
from app.db.base import Base


class Checkin(Base):
    __tablename__ = "checkins"

    id = mapped_column(Integer, primary_key=True)
    registration_id = mapped_column(Integer, ForeignKey("registrations.id"), nullable=False)
    ticket_id = mapped_column(Integer, ForeignKey("tickets.id"), nullable=False)
    event_id = mapped_column(Integer, ForeignKey("events.id"), nullable=False)
    user_id = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    checked_in_by = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    checked_in_at = mapped_column(DateTime, server_default=func.now())
    is_manual = mapped_column(Boolean, default=False)

    # relationships
    registration = relationship("Registration")
    ticket = relationship("Ticket")
    event = relationship("Event")
    user = relationship("User", foreign_keys=[user_id])
    checker = relationship("User", foreign_keys=[checked_in_by])


class OfflineCheckinQueue(Base):
    __tablename__ = "offline_checkin_queue"

    id = mapped_column(Integer, primary_key=True)
    ticket_id = mapped_column(Integer, ForeignKey("tickets.id"), nullable=False)
    event_id = mapped_column(Integer, ForeignKey("events.id"), nullable=False)
    scanned_by = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    scanned_at = mapped_column(DateTime, nullable=False)
    synced_at = mapped_column(DateTime, nullable=True)
    status = mapped_column(String(20), nullable=False, default="pending")
    # 'pending', 'synced', 'conflict'
    conflict_reason = mapped_column(Text, nullable=True)

    # relationships
    ticket = relationship("Ticket")
    event = relationship("Event")
    scanner = relationship("User")