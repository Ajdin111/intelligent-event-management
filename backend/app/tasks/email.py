import html as html_lib
import smtplib
import logging
from app.core.celery_app import celery_app
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.core.config import settings
from app.db.session import get_db_context

logger = logging.getLogger(__name__)


def send_email(to: str, subject: str, html_body: str) -> bool:
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


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def send_registration_confirmation(self, registration_id: int):
    try:
        with get_db_context() as db:
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

            body = f"""
            <h2>You're registered for {html_lib.escape(event.title)}!</h2>
            <p>Hi {html_lib.escape(user.first_name)},</p>
            <p>Your registration is confirmed.</p>
            <ul>
                <li><strong>Event:</strong> {html_lib.escape(event.title)}</li>
                <li><strong>Date:</strong> {event.start_datetime.strftime('%B %d, %Y')}</li>
                <li><strong>Location:</strong> {html_lib.escape(event.physical_address or 'Online')}</li>
            </ul>
            <p>Your tickets are available in your TeqEvent dashboard.</p>
            """

            success = send_email(
                to=user.email,
                subject=f"Registration confirmed — {event.title}",
                html_body=body,
            )

            db.add(NotificationLog(
                user_id=user.id,
                event_id=event.id,
                type="registration_confirmation",
                channel="email",
                status="sent" if success else "failed",
                sent_at=datetime.now(),
            ))
            db.commit()

    except Exception as exc:
        logger.error(f"Task failed for registration {registration_id}: {exc}")
        raise self.retry(exc=exc)


@celery_app.task
def send_registration_cancellation(registration_id: int):
    with get_db_context() as db:
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

        body = f"""
        <h2>Registration Cancelled — {html_lib.escape(event.title)}</h2>
        <p>Hi {html_lib.escape(user.first_name)},</p>
        <p>Your registration for <strong>{html_lib.escape(event.title)}</strong> has been cancelled.</p>
        <p>If a refund is applicable, it will be processed within 5-7 business days.</p>
        """

        success = send_email(
            to=user.email,
            subject=f"Registration Cancelled — {event.title}",
            html_body=body,
        )

        db.add(NotificationLog(
            user_id=user.id,
            event_id=event.id,
            type="registration_cancellation",
            channel="email",
            status="sent" if success else "failed",
            sent_at=datetime.now(),
        ))
        db.commit()


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def send_event_reminder(self, event_id: int, hours_before: int):
    try:
        with get_db_context() as db:
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

                prefs = db.query(NotificationPreferences).filter(
                    NotificationPreferences.user_id == user.id
                ).first()

                if prefs and not prefs.event_reminders:
                    continue
                if prefs and not prefs.email_enabled:
                    continue

                plural = "s" if hours_before > 1 else ""
                body = f"""
                <h2>Reminder: {html_lib.escape(event.title)} is in {hours_before} hour{plural}!</h2>
                <p>Hi {html_lib.escape(user.first_name)},</p>
                <p>Don't forget — <strong>{html_lib.escape(event.title)}</strong> starts soon.</p>
                <ul>
                    <li><strong>Date:</strong> {event.start_datetime.strftime('%B %d, %Y at %H:%M')}</li>
                    <li><strong>Location:</strong> {html_lib.escape(event.physical_address or event.online_link or 'TBA')}</li>
                </ul>
                """

                success = send_email(
                    to=user.email,
                    subject=f"Reminder: {event.title} starts in {hours_before}h",
                    html_body=body,
                )

                db.add(NotificationLog(
                    user_id=user.id,
                    event_id=event.id,
                    type="reminder",
                    channel="email",
                    status="sent" if success else "failed",
                    sent_at=datetime.now(),
                ))

            db.commit()

    except Exception as exc:
        raise self.retry(exc=exc)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def send_feedback_request(self, event_id: int):
    try:
        with get_db_context() as db:
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

                body = f"""
                <h2>How was {html_lib.escape(event.title)}?</h2>
                <p>Hi {html_lib.escape(user.first_name)},</p>
                <p>We'd love to hear your thoughts. Leave a quick review on TeqEvent.</p>
                <p>Your feedback helps organizers improve and helps other attendees choose the right events.</p>
                """

                success = send_email(
                    to=user.email,
                    subject=f"How was {event.title}? Leave a review",
                    html_body=body,
                )

                db.add(NotificationLog(
                    user_id=user.id,
                    event_id=event.id,
                    type="feedback_request",
                    channel="email",
                    status="sent" if success else "failed",
                    sent_at=datetime.now(),
                ))

            db.commit()

    except Exception as exc:
        raise self.retry(exc=exc)


@celery_app.task
def send_upcoming_event_reminders():
    """Periodic task — runs every hour. Triggers reminders for events starting in ~24h or ~1h."""
    with get_db_context() as db:
        from app.models.event import Event
        from app.models.notification import EventReminder

        now = datetime.now()

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
                existing = db.query(EventReminder).filter(
                    EventReminder.event_id == event.id,
                    EventReminder.reminder_type == f"{hours}h_before",
                    EventReminder.status == "sent",
                ).first()

                if not existing:
                    send_event_reminder.delay(event.id, hours)

                    db.add(EventReminder(
                        event_id=event.id,
                        reminder_type=f"{hours}h_before",
                        scheduled_at=now,
                        status="sent",
                    ))

        db.commit()
