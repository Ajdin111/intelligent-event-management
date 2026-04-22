from celery import shared_task
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)


def get_db() -> Session:
    return SessionLocal()


@shared_task(bind=True, max_retries=3, default_retry_delay=120)
def compute_event_analytics(self, event_id: int):
    """
    Compute and store analytics for a single event.
    Triggered after event ends. Updates event_analytics table.
    """
    db = get_db()
    try:
        from app.models.event import Event
        from app.models.registration import Registration
        from app.models.checkin import Checkin
        from app.models.review import Review
        from app.models.analytics import EventAnalytics, EventAnalyticsHistory
        from sqlalchemy import func

        event = db.query(Event).filter(Event.id == event_id).first()
        if not event:
            return

        # Registration counts
        total = db.query(func.count(Registration.id)).filter(
            Registration.event_id == event_id
        ).scalar()

        confirmed = db.query(func.count(Registration.id)).filter(
            Registration.event_id == event_id,
            Registration.status == "confirmed",
        ).scalar()

        cancelled = db.query(func.count(Registration.id)).filter(
            Registration.event_id == event_id,
            Registration.status == "cancelled",
        ).scalar()

        # Check-ins
        checked_in = db.query(func.count(Checkin.id)).filter(
            Checkin.event_id == event_id
        ).scalar()

        attendance_rate = (checked_in / confirmed * 100) if confirmed > 0 else 0.0

        # Revenue
        revenue_result = db.query(func.sum(Registration.total_amount)).filter(
            Registration.event_id == event_id,
            Registration.status == "confirmed",
        ).scalar()
        total_revenue = float(revenue_result or 0)

        # Reviews
        review_stats = db.query(
            func.count(Review.id),
            func.avg(Review.rating),
        ).filter(Review.event_id == event_id).first()

        total_reviews = review_stats[0] or 0
        avg_rating = float(review_stats[1] or 0)

        # Sentiment breakdown
        for sentiment in ["positive", "negative", "neutral"]:
            count = db.query(func.count(Review.id)).filter(
                Review.event_id == event_id,
                Review.sentiment == sentiment,
            ).scalar()
            locals()[f"{sentiment}_count"] = count

        positive_pct = (locals()["positive_count"] / total_reviews * 100) if total_reviews > 0 else 0
        negative_pct = (locals()["negative_count"] / total_reviews * 100) if total_reviews > 0 else 0
        neutral_pct = (locals()["neutral_count"] / total_reviews * 100) if total_reviews > 0 else 0

        # Upsert event_analytics
        analytics = db.query(EventAnalytics).filter(
            EventAnalytics.event_id == event_id
        ).first()

        now = datetime.now(timezone.utc)

        if analytics:
            analytics.total_registrations = total
            analytics.confirmed_registrations = confirmed
            analytics.cancelled_registrations = cancelled
            analytics.total_checked_in = checked_in
            analytics.attendance_rate = attendance_rate
            analytics.total_revenue = total_revenue
            analytics.average_rating = avg_rating
            analytics.total_reviews = total_reviews
            analytics.positive_sentiment_pct = positive_pct
            analytics.negative_sentiment_pct = negative_pct
            analytics.neutral_sentiment_pct = neutral_pct
            analytics.last_updated = now
        else:
            analytics = EventAnalytics(
                event_id=event_id,
                total_registrations=total,
                confirmed_registrations=confirmed,
                cancelled_registrations=cancelled,
                total_checked_in=checked_in,
                attendance_rate=attendance_rate,
                total_revenue=total_revenue,
                average_rating=avg_rating,
                total_reviews=total_reviews,
                positive_sentiment_pct=positive_pct,
                negative_sentiment_pct=negative_pct,
                neutral_sentiment_pct=neutral_pct,
                last_updated=now,
            )
            db.add(analytics)

        # Save history snapshot
        snapshot = EventAnalyticsHistory(
            event_id=event_id,
            snapshot_date=now.date(),
            total_registrations=total,
            confirmed_registrations=confirmed,
            total_checked_in=checked_in,
            total_revenue=total_revenue,
            attendance_rate=attendance_rate,
            average_rating=avg_rating,
            computed_at=now,
        )
        db.add(snapshot)
        db.commit()

        logger.info(f"Analytics computed for event {event_id}")

    except Exception as exc:
        db.rollback()
        logger.error(f"Analytics task failed for event {event_id}: {exc}")
        raise self.retry(exc=exc)
    finally:
        db.close()


@shared_task
def compute_platform_analytics():
    """
    Compute platform-wide analytics snapshot.
    Run daily via beat schedule.
    """
    db = get_db()
    try:
        from app.models.user import User
        from app.models.event import Event
        from app.models.registration import Registration
        from app.models.analytics import PlatformAnalytics
        from sqlalchemy import func
        from datetime import date

        today = date.today()
        now = datetime.now(timezone.utc)

        total_users = db.query(func.count(User.id)).scalar()
        total_events = db.query(func.count(Event.id)).filter(
            Event.deleted_at.is_(None)
        ).scalar()
        total_registrations = db.query(func.count(Registration.id)).scalar()

        revenue = db.query(func.sum(Registration.total_amount)).filter(
            Registration.status == "confirmed"
        ).scalar()

        active_events = db.query(func.count(Event.id)).filter(
            Event.status == "published",
            Event.deleted_at.is_(None),
        ).scalar()

        existing = db.query(PlatformAnalytics).filter(
            PlatformAnalytics.date == today
        ).first()

        if existing:
            existing.total_users = total_users
            existing.total_events = total_events
            existing.total_registrations = total_registrations
            existing.total_revenue = float(revenue or 0)
            existing.active_events = active_events
            existing.computed_at = now
        else:
            snapshot = PlatformAnalytics(
                date=today,
                total_users=total_users,
                total_events=total_events,
                total_registrations=total_registrations,
                total_revenue=float(revenue or 0),
                active_events=active_events,
                computed_at=now,
            )
            db.add(snapshot)

        db.commit()
        logger.info(f"Platform analytics computed for {today}")

    except Exception as e:
        db.rollback()
        logger.error(f"Platform analytics failed: {e}")
        raise
    finally:
        db.close()