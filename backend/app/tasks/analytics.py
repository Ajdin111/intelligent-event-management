import logging
from app.core.celery_app import celery_app
from datetime import datetime, date

from app.db.session import get_db_context

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=120)
def compute_event_analytics(self, event_id: int):
    try:
        with get_db_context() as db:
            from app.models.event import Event
            from app.models.registration import Registration
            from app.models.checkin import Checkin
            from app.models.review import Review
            from app.models.analytics import EventAnalytics, EventAnalyticsHistory
            from sqlalchemy import func

            event = db.query(Event).filter(Event.id == event_id).first()
            if not event:
                return

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

            checked_in = db.query(func.count(Checkin.id)).filter(
                Checkin.event_id == event_id
            ).scalar()

            attendance_rate = (checked_in / confirmed * 100) if confirmed > 0 else 0.0

            revenue_result = db.query(func.sum(Registration.total_amount)).filter(
                Registration.event_id == event_id,
                Registration.status == "confirmed",
            ).scalar()
            total_revenue = float(revenue_result or 0)

            review_stats = db.query(
                func.count(Review.id),
                func.avg(Review.rating),
            ).filter(Review.event_id == event_id).first()

            total_reviews = review_stats[0] or 0
            avg_rating = float(review_stats[1] or 0)

            sentiment_counts = {}
            for sentiment in ("positive", "negative", "neutral"):
                sentiment_counts[sentiment] = db.query(func.count(Review.id)).filter(
                    Review.event_id == event_id,
                    Review.sentiment == sentiment,
                ).scalar()

            positive_pct = (sentiment_counts["positive"] / total_reviews * 100) if total_reviews > 0 else 0
            negative_pct = (sentiment_counts["negative"] / total_reviews * 100) if total_reviews > 0 else 0
            neutral_pct = (sentiment_counts["neutral"] / total_reviews * 100) if total_reviews > 0 else 0

            now = datetime.now()

            analytics = db.query(EventAnalytics).filter(
                EventAnalytics.event_id == event_id
            ).first()

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
                db.add(EventAnalytics(
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
                ))

            db.add(EventAnalyticsHistory(
                event_id=event_id,
                snapshot_date=now.date(),
                total_registrations=total,
                confirmed_registrations=confirmed,
                total_checked_in=checked_in,
                total_revenue=total_revenue,
                attendance_rate=attendance_rate,
                average_rating=avg_rating,
                computed_at=now,
            ))
            db.commit()
            logger.info(f"Analytics computed for event {event_id}")

    except Exception as exc:
        logger.error(f"Analytics task failed for event {event_id}: {exc}")
        raise self.retry(exc=exc)


@celery_app.task
def compute_platform_analytics():
    """Daily platform-wide analytics snapshot — uses yesterday's totals as baseline."""
    with get_db_context() as db:
        from app.models.user import User
        from app.models.event import Event
        from app.models.registration import Registration
        from app.models.analytics import PlatformAnalytics
        from sqlalchemy import func
        from datetime import timedelta

        today = date.today()
        now = datetime.now()

        yesterday_row = db.query(PlatformAnalytics).filter(
            PlatformAnalytics.date == today - timedelta(days=1)
        ).first()

        if yesterday_row:
            # Incremental: only count records created since yesterday's snapshot
            since = datetime.combine(today - timedelta(days=1), datetime.min.time())

            new_users = db.query(func.count(User.id)).filter(User.created_at >= since).scalar() or 0
            new_events = db.query(func.count(Event.id)).filter(
                Event.created_at >= since,
                Event.deleted_at.is_(None),
            ).scalar() or 0
            new_registrations = db.query(func.count(Registration.id)).filter(
                Registration.registered_at >= since,
            ).scalar() or 0
            new_revenue = db.query(func.sum(Registration.total_amount)).filter(
                Registration.status == "confirmed",
                Registration.registered_at >= since,
            ).scalar() or 0

            total_users = yesterday_row.total_users + new_users
            total_events = yesterday_row.total_events + new_events
            total_registrations = yesterday_row.total_registrations + new_registrations
            total_revenue = float(yesterday_row.total_revenue or 0) + float(new_revenue)
        else:
            # First run — full computation
            new_users = db.query(func.count(User.id)).scalar() or 0
            new_events = db.query(func.count(Event.id)).filter(Event.deleted_at.is_(None)).scalar() or 0
            new_registrations = db.query(func.count(Registration.id)).scalar() or 0
            total_users = new_users
            total_events = new_events
            total_registrations = new_registrations
            total_revenue = float(
                db.query(func.sum(Registration.total_amount)).filter(
                    Registration.status == "confirmed"
                ).scalar() or 0
            )

        active_events = db.query(func.count(Event.id)).filter(
            Event.status == "published",
            Event.deleted_at.is_(None),
        ).scalar() or 0

        existing = db.query(PlatformAnalytics).filter(PlatformAnalytics.date == today).first()

        if existing:
            existing.total_users = total_users
            existing.new_users = new_users
            existing.total_events = total_events
            existing.new_events = new_events
            existing.total_registrations = total_registrations
            existing.total_revenue = total_revenue
            existing.active_events = active_events
            existing.computed_at = now
        else:
            db.add(PlatformAnalytics(
                date=today,
                total_users=total_users,
                new_users=new_users,
                total_events=total_events,
                new_events=new_events,
                total_registrations=total_registrations,
                total_revenue=total_revenue,
                active_events=active_events,
                computed_at=now,
            ))

        db.commit()
        logger.info(f"Platform analytics computed for {today}")
