from celery import shared_task
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.core.config import settings
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)


def get_db() -> Session:
    return SessionLocal()


def send_email(to: str, subject: str, html_body: str) -> bool:
    """Low-level email sender. Returns True on success."""
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.SMTP_USER
        msg["To"] = to
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_USER, to, msg.as_string())
        return True
    except Exception as e:
        logger.error(f"Email send failed to {to}: {e}")
        return False


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_registration_confirmation(self, registration_id: int):
    """Send confirmation email when a registration is confirmed."""
    db = get_db()
    try:
        from app.models.registration import Registration
        from app.models.notification import NotificationLog

        registration = db.query(Registration).filter(
            Registration.id == registration_id
        ).first()

        if not registration:
            logger.warning(f"Registration {registration_id} not found")
            return

        user = registration.user
        event = registration.event

        html = f"""
        <h2>You're registered for {event.title}!</h2>
        <p>Hi {user.first_name},</p>
        <p>Your registration is confirmed.</p>
        <ul>
            <li><strong>Event:</strong> {event.title}</li>
            <li><strong>Date:</strong> {event.start_datetime.strftime('%B %d, %Y')}</li>
            <li><strong>Location:</strong> {event.physical_address or 'Online'}</li>
        </ul>
        <p>Your tickets are available in your TeqEvent dashboard.</p>
        """

        success = send_email(
            to=user.email,
            subject=f"Registration confirmed — {event.title}",
            html_body=html,
        )

        # Log the notification
        log = NotificationLog(
            user_id=user.id,
            event_id=event.id,
            type="registration_confirmation",
            channel="email",
            status="sent" if success else "failed",
            sent_at=datetime.now(timezone.utc),
        )
        db.add(log)
        db.commit()

    except Exception as exc:
        db.rollback()
        logger.error(f"Task failed for registration {registration_id}: {exc}")
        raise self.retry(exc=exc)
    finally:
        db.close()


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_event_reminder(self, event_id: int, hours_before: int):
    """Send reminder email to all confirmed registrants."""
    db = get_db()
    try:
        from app.models.event import Event
        from app.models.registration import Registration
        from app.models.notification import NotificationPreferences, NotificationLog

        event = db.query(Event).filter(Event.id == event_id).first()
        if not event:
            return

        registrations = db.query(Registration).filter(
            Registration.event_id == event_id,
            Registration.status == "confirmed",
        ).all()

        for reg in registrations:
            user = reg.user

            # Check user preferences
            prefs = db.query(NotificationPreferences).filter(
                NotificationPreferences.user_id == user.id
            ).first()

            if prefs and not prefs.event_reminders:
                continue
            if prefs and not prefs.email_enabled:
                continue

            html = f"""
            <h2>Reminder: {event.title} is in {hours_before} hour{'s' if hours_before > 1 else ''}!</h2>
            <p>Hi {user.first_name},</p>
            <p>Don't forget — <strong>{event.title}</strong> starts soon.</p>
            <ul>
                <li><strong>Date:</strong> {event.start_datetime.strftime('%B %d, %Y at %H:%M')}</li>
                <li><strong>Location:</strong> {event.physical_address or event.online_link or 'TBA'}</li>
            </ul>
            """

            success = send_email(
                to=user.email,
                subject=f"Reminder: {event.title} starts in {hours_before}h",
                html_body=html,
            )

            log = NotificationLog(
                user_id=user.id,
                event_id=event.id,
                type="reminder",
                channel="email",
                status="sent" if success else "failed",
                sent_at=datetime.now(timezone.utc),
            )
            db.add(log)

        db.commit()

    except Exception as exc:
        db.rollback()
        raise self.retry(exc=exc)
    finally:
        db.close()


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_feedback_request(self, event_id: int):
    """Send feedback request email after event ends."""
    db = get_db()
    try:
        from app.models.event import Event
        from app.models.registration import Registration
        from app.models.notification import NotificationLog

        event = db.query(Event).filter(Event.id == event_id).first()
        if not event:
            return

        registrations = db.query(Registration).filter(
            Registration.event_id == event_id,
            Registration.status == "confirmed",
        ).all()

        for reg in registrations:
            user = reg.user

            html = f"""
            <h2>How was {event.title}?</h2>
            <p>Hi {user.first_name},</p>
            <p>We'd love to hear your thoughts. Leave a quick review on TeqEvent.</p>
            <p>Your feedback helps organizers improve and helps other attendees choose the right events.</p>
            """

            success = send_email(
                to=user.email,
                subject=f"How was {event.title}? Leave a review",
                html_body=html,
            )

            log = NotificationLog(
                user_id=user.id,
                event_id=event.id,
                type="feedback_request",
                channel="email",
                status="sent" if success else "failed",
                sent_at=datetime.now(timezone.utc),
            )
            db.add(log)

        db.commit()

    except Exception as exc:
        db.rollback()
        raise self.retry(exc=exc)
    finally:
        db.close()


@shared_task
def send_upcoming_event_reminders():
    """
    Periodic task — runs every hour.
    Finds events starting in ~24h or ~1h and triggers reminder tasks.
    """
    db = get_db()
    try:
        from app.models.event import Event
        from app.models.notification import EventReminder

        now = datetime.now(timezone.utc)

        windows = [
            (timedelta(hours=23, minutes=30), timedelta(hours=24, minutes=30), 24),
            (timedelta(minutes=30), timedelta(hours=1, minutes=30), 1),
        ]

        for lower, upper, hours in windows:
            events = db.query(Event).filter(
                Event.status == "published",
                Event.start_datetime >= now + lower,
                Event.start_datetime <= now + upper,
                Event.deleted_at.is_(None),
            ).all()

            for event in events:
                # Check if reminder already sent for this window
                existing = db.query(EventReminder).filter(
                    EventReminder.event_id == event.id,
                    EventReminder.reminder_type == f"{hours}h_before",
                    EventReminder.status == "sent",
                ).first()

                if not existing:
                    send_event_reminder.delay(event.id, hours)

                    reminder = EventReminder(
                        event_id=event.id,
                        reminder_type=f"{hours}h_before",
                        scheduled_at=now,
                        status="sent",
                    )
                    db.add(reminder)

        db.commit()
    finally:
        db.close()