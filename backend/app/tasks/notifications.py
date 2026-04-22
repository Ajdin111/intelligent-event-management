from celery import shared_task
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from datetime import datetime, timezone, timedelta
import logging

logger = logging.getLogger(__name__)


def get_db() -> Session:
    return SessionLocal()


@shared_task
def cleanup_expired_notifications():
    """
    Periodic task — runs every 24h.
    Hard-deletes notifications older than 90 days per business rules.
    """
    db = get_db()
    try:
        from app.models.notification import Notification

        cutoff = datetime.now(timezone.utc) - timedelta(days=90)
        deleted = db.query(Notification).filter(
            Notification.created_at < cutoff
        ).delete(synchronize_session=False)

        db.commit()
        logger.info(f"Cleaned up {deleted} expired notifications")
        return deleted
    except Exception as e:
        db.rollback()
        logger.error(f"Notification cleanup failed: {e}")
        raise
    finally:
        db.close()


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def create_in_app_notification(
    self,
    user_id: int,
    title: str,
    message: str,
    notification_type: str,
    event_id: int | None = None,
):
    """Create an in-app notification for a user."""
    db = get_db()
    try:
        from app.models.notification import Notification, NotificationPreferences
        from datetime import timedelta

        prefs = db.query(NotificationPreferences).filter(
            NotificationPreferences.user_id == user_id
        ).first()

        if prefs and not prefs.in_app_enabled:
            return

        notification = Notification(
            user_id=user_id,
            title=title,
            message=message,
            type=notification_type,
            expires_at=datetime.now(timezone.utc) + timedelta(days=90),
        )
        db.add(notification)
        db.commit()

    except Exception as exc:
        db.rollback()
        raise self.retry(exc=exc)
    finally:
        db.close()


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def notify_waitlist_user(self, waitlist_id: int):
    """Notify waitlist user that a spot opened up."""
    db = get_db()
    try:
        from app.models.registration import Waitlist
        from datetime import timedelta

        entry = db.query(Waitlist).filter(Waitlist.id == waitlist_id).first()
        if not entry or entry.status != "waiting":
            return

        user = entry.user
        event = entry.event

        # Update waitlist entry
        entry.status = "notified"
        entry.notified_at = datetime.now(timezone.utc)
        entry.confirmation_deadline = datetime.now(timezone.utc) + timedelta(hours=24)
        db.commit()

        # Fire both email and in-app notification
        from app.tasks.email import send_email
        html = f"""
        <h2>A spot opened up for {event.title}!</h2>
        <p>Hi {user.first_name},</p>
        <p>You have 24 hours to confirm your spot before it goes to the next person on the waitlist.</p>
        """
        send_email(
            to=user.email,
            subject=f"Spot available — {event.title}",
            html_body=html,
        )

        create_in_app_notification.delay(
            user_id=user.id,
            title="Spot available!",
            message=f"A spot opened up for {event.title}. Confirm within 24 hours.",
            notification_type="waitlist_notification",
        )

    except Exception as exc:
        db.rollback()
        raise self.retry(exc=exc)
    finally:
        db.close()