import html as html_lib
import logging
from app.core.celery_app import celery_app
from datetime import datetime, timedelta

from app.db.session import get_db_context
from app.core.constants import NOTIFICATION_RETENTION_DAYS, WAITLIST_CONFIRMATION_HOURS

logger = logging.getLogger(__name__)


@celery_app.task
def cleanup_expired_notifications():
    """Periodic task — runs every 24h. Hard-deletes notifications older than 90 days."""
    with get_db_context() as db:
        from app.models.notification import Notification

        cutoff = datetime.now() - timedelta(days=NOTIFICATION_RETENTION_DAYS)
        deleted = db.query(Notification).filter(
            Notification.created_at < cutoff
        ).delete(synchronize_session=False)

        db.commit()
        logger.info(f"Cleaned up {deleted} expired notifications")
        return deleted


@celery_app.task(bind=True, max_retries=3, default_retry_delay=30)
def create_in_app_notification(
    self,
    user_id: int,
    title: str,
    message: str,
    notification_type: str,
    event_id: int | None = None,
):
    try:
        with get_db_context() as db:
            from app.models.notification import Notification, NotificationPreferences

            prefs = db.query(NotificationPreferences).filter(
                NotificationPreferences.user_id == user_id
            ).first()

            if prefs and not prefs.in_app_enabled:
                return

            db.add(Notification(
                user_id=user_id,
                title=title,
                message=message,
                type=notification_type,
                expires_at=datetime.now() + timedelta(days=NOTIFICATION_RETENTION_DAYS),
            ))
            db.commit()

    except Exception as exc:
        raise self.retry(exc=exc)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=30)
def notify_waitlist_user(self, waitlist_id: int):
    try:
        with get_db_context() as db:
            from app.models.registration import Waitlist

            entry = db.query(Waitlist).filter(Waitlist.id == waitlist_id).first()
            if not entry or entry.status != "notified":
                return

            user = entry.user
            event = entry.event

            from app.tasks.email import send_email
            body = f"""
            <h2>A spot opened up for {html_lib.escape(event.title)}!</h2>
            <p>Hi {html_lib.escape(user.first_name)},</p>
            <p>You have 24 hours to confirm your spot before it goes to the next person on the waitlist.</p>
            """
            send_email(
                to=user.email,
                subject=f"Spot available — {event.title}",
                html_body=body,
            )

            create_in_app_notification.delay(
                user_id=user.id,
                title="Spot available!",
                message=f"A spot opened up for {event.title}. Confirm within 24 hours.",
                notification_type="waitlist_notification",
            )

    except Exception as exc:
        raise self.retry(exc=exc)
