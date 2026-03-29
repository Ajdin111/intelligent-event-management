from sqlalchemy import Boolean, DateTime, Integer, String, Text, func, ForeignKey
from sqlalchemy.orm import mapped_column, relationship
from app.db.base import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = mapped_column(Integer, primary_key=True)
    user_id = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    title = mapped_column(String(255), nullable=False)
    message = mapped_column(Text, nullable=False)
    type = mapped_column(String(50), nullable=False)
    # 'registration_confirmation', 'approval', 'rejection',
    # 'reminder', 'feedback_request', 'waitlist_notification', 'invite'
    is_read = mapped_column(Boolean, default=False)
    created_at = mapped_column(DateTime, server_default=func.now())
    read_at = mapped_column(DateTime, nullable=True)
    expires_at = mapped_column(DateTime, nullable=True)
    # set to created_at + 90 days, cleaned up by Celery

    # relationships
    user = relationship("User")


class NotificationLog(Base):
    __tablename__ = "notification_logs"

    id = mapped_column(Integer, primary_key=True)
    user_id = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    event_id = mapped_column(Integer, ForeignKey("events.id"), nullable=True)
    type = mapped_column(String(50), nullable=False)
    channel = mapped_column(String(20), nullable=False)
    # 'email', 'in_app'
    status = mapped_column(String(20), nullable=False)
    # 'sent', 'failed', 'pending'
    sent_at = mapped_column(DateTime, server_default=func.now())
    error_message = mapped_column(Text, nullable=True)

    # relationships
    user = relationship("User")
    event = relationship("Event")


class NotificationPreferences(Base):
    __tablename__ = "notification_preferences"

    id = mapped_column(Integer, primary_key=True)
    user_id = mapped_column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    registration_confirmation = mapped_column(Boolean, default=True)
    event_reminders = mapped_column(Boolean, default=True)
    approval_updates = mapped_column(Boolean, default=True)
    feedback_requests = mapped_column(Boolean, default=True)
    waitlist_updates = mapped_column(Boolean, default=True)
    invite_notifications = mapped_column(Boolean, default=True)
    email_enabled = mapped_column(Boolean, default=True)
    in_app_enabled = mapped_column(Boolean, default=True)
    updated_at = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    # relationships
    user = relationship("User")


class EventReminder(Base):
    __tablename__ = "event_reminders"

    id = mapped_column(Integer, primary_key=True)
    event_id = mapped_column(Integer, ForeignKey("events.id"), nullable=False)
    reminder_type = mapped_column(String(50), nullable=False)
    # '24h_before', '1h_before', 'custom'
    scheduled_at = mapped_column(DateTime, nullable=False)
    sent_at = mapped_column(DateTime, nullable=True)
    status = mapped_column(String(20), nullable=False, default="pending")
    # 'pending', 'sent', 'failed'
    created_at = mapped_column(DateTime, server_default=func.now())

    # relationships
    event = relationship("Event")