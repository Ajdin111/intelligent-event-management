import html as html_lib
import smtplib
import logging
from app.core.celery_app import celery_app
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.core.config import settings
from app.core.constants import REG_STATUS_CONFIRMED, EVENT_STATUS_PUBLISHED
from app.db.session import get_db_context

logger = logging.getLogger(__name__)


def _is_email_allowed(db, user_id: int, pref_attr: str = None) -> bool:
    from app.models.notification import NotificationPreferences
    prefs = db.query(NotificationPreferences).filter(
        NotificationPreferences.user_id == user_id
    ).first()
    if prefs and not prefs.email_enabled:
        return False
    if pref_attr and prefs and not getattr(prefs, pref_attr, True):
        return False
    return True


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

            if not _is_email_allowed(db, user.id, "registration_confirmation"):
                return

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
                sent_at=datetime.utcnow(),
            ))
            db.commit()

    except Exception as exc:
        logger.error(f"Task failed for registration {registration_id}: {exc}")
        raise self.retry(exc=exc)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def send_registration_cancellation(self, registration_id: int):
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

            if not _is_email_allowed(db, user.id):
                return

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
                sent_at=datetime.utcnow(),
            ))
            db.commit()

    except Exception as exc:
        logger.error(f"Task failed for registration {registration_id}: {exc}")
        raise self.retry(exc=exc)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def send_event_reminder(self, event_id: int, hours_before: int):
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
                Registration.status == REG_STATUS_CONFIRMED,
            ).all()

            for reg in registrations:
                user = reg.user

                if not _is_email_allowed(db, user.id, "event_reminders"):
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
                    sent_at=datetime.utcnow(),
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
                Registration.status == REG_STATUS_CONFIRMED,
            ).all()

            for reg in registrations:
                user = reg.user

                if not _is_email_allowed(db, user.id, "feedback_requests"):
                    continue

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
                    sent_at=datetime.utcnow(),
                ))

            db.commit()

    except Exception as exc:
        raise self.retry(exc=exc)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=120)
def send_upcoming_event_reminders(self):
    """Periodic task — runs every hour. Triggers reminders for events starting in ~24h or ~1h."""
    try:
        with get_db_context() as db:
            from app.models.event import Event
            from app.models.notification import EventReminder

            now = datetime.utcnow()

            windows = [
                (timedelta(hours=23, minutes=30), timedelta(hours=24, minutes=30), 24),
                (timedelta(minutes=30), timedelta(hours=1, minutes=30), 1),
            ]

            for lower, upper, hours in windows:
                events = db.query(Event).filter(
                    Event.status == EVENT_STATUS_PUBLISHED,
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

    except Exception as exc:
        logger.error(f"send_upcoming_event_reminders failed: {exc}")
        raise self.retry(exc=exc)

@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def send_collaborator_invite(self, target_user_id: int, event_id: int, inviter_name: str):
    try:
        with get_db_context() as db:
            from app.models.user import User
            from app.models.event import Event
            from app.models.notification import NotificationLog

            target = db.query(User).filter(User.id == target_user_id).first()
            event = db.query(Event).filter(Event.id == event_id).first()

            if not target or not event:
                logger.warning(f"send_collaborator_invite: user {target_user_id} or event {event_id} not found")
                return

            if not _is_email_allowed(db, target.id, "invite_notifications"):
                return

            body = f"""
            <h2>You've been invited to co-manage an event</h2>
            <p>Hi {html_lib.escape(target.first_name)},</p>
            <p><strong>{html_lib.escape(inviter_name)}</strong> has invited you to collaborate on:</p>
            <ul>
                <li><strong>Event:</strong> {html_lib.escape(event.title)}</li>
                <li><strong>Date:</strong> {event.start_datetime.strftime('%B %d, %Y') if event.start_datetime else 'TBD'}</li>
            </ul>
            <p>Log in to TeqEvent to accept or decline this invitation.</p>
            """

            success = send_email(
                to=target.email,
                subject=f"You've been invited to co-manage '{event.title}'",
                html_body=body,
            )

            db.add(NotificationLog(
                user_id=target.id,
                event_id=event.id,
                type="invite",
                channel="email",
                status="sent" if success else "failed",
                sent_at=datetime.utcnow(),
            ))
            db.commit()

    except Exception as exc:
        logger.error(f"send_collaborator_invite failed for user {target_user_id}: {exc}")
        raise self.retry(exc=exc)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def send_event_invite(self, target_user_id: int, event_id: int, inviter_name: str):
    try:
        with get_db_context() as db:
            from app.models.user import User
            from app.models.event import Event
            from app.models.notification import NotificationLog

            target = db.query(User).filter(User.id == target_user_id).first()
            event = db.query(Event).filter(Event.id == event_id).first()

            if not target or not event:
                logger.warning(f"send_event_invite: user {target_user_id} or event {event_id} not found")
                return

            if not _is_email_allowed(db, target.id, "invite_notifications"):
                return

            body = f"""
            <h2>You've been invited to attend an event</h2>
            <p>Hi {html_lib.escape(target.first_name)},</p>
            <p><strong>{html_lib.escape(inviter_name)}</strong> has invited you to attend:</p>
            <ul>
                <li><strong>Event:</strong> {html_lib.escape(event.title)}</li>
                <li><strong>Date:</strong> {event.start_datetime.strftime('%B %d, %Y') if event.start_datetime else 'TBD'}</li>
                <li><strong>Location:</strong> {html_lib.escape(event.physical_address or event.online_link or 'TBA')}</li>
            </ul>
            <p>Log in to TeqEvent and check your notifications to accept or decline this invitation.</p>
            """

            success = send_email(
                to=target.email,
                subject=f"You've been invited to attend '{event.title}'",
                html_body=body,
            )

            db.add(NotificationLog(
                user_id=target.id,
                event_id=event.id,
                type="invite",
                channel="email",
                status="sent" if success else "failed",
                sent_at=datetime.utcnow(),
            ))
            db.commit()

    except Exception as exc:
        logger.error(f"send_event_invite failed for user {target_user_id}: {exc}")
        raise self.retry(exc=exc)