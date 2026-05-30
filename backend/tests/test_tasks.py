import pytest
from contextlib import contextmanager
from datetime import datetime, timedelta
from decimal import Decimal
from unittest.mock import patch

from tests.conftest import make_user, make_organizer, make_event, make_registration


def db_ctx(session):
    @contextmanager
    def _ctx():
        yield session
    return _ctx


# ─── compute_event_analytics ─────────────────────────────

def test_compute_event_analytics_creates_row(db):
    from app.tasks.analytics import compute_event_analytics
    from app.models.analytics import EventAnalytics, EventAnalyticsHistory

    organizer = make_organizer(db)
    event = make_event(db, owner=organizer, status="published")

    with patch("app.tasks.analytics.get_db_context", db_ctx(db)):
        compute_event_analytics(event.id)

    analytics = db.query(EventAnalytics).filter(EventAnalytics.event_id == event.id).first()
    assert analytics is not None
    assert analytics.total_registrations == 0

    history = db.query(EventAnalyticsHistory).filter(EventAnalyticsHistory.event_id == event.id).first()
    assert history is not None


def test_compute_event_analytics_counts_registrations(db):
    from app.tasks.analytics import compute_event_analytics
    from app.models.analytics import EventAnalytics

    organizer = make_organizer(db)
    user1 = make_user(db, email="u1@test.com")
    user2 = make_user(db, email="u2@test.com")
    event = make_event(db, owner=organizer, status="published")
    make_registration(db, user=user1, event=event)
    make_registration(db, user=user2, event=event)

    with patch("app.tasks.analytics.get_db_context", db_ctx(db)):
        compute_event_analytics(event.id)

    analytics = db.query(EventAnalytics).filter(EventAnalytics.event_id == event.id).first()
    assert analytics.total_registrations == 2
    assert analytics.confirmed_registrations == 2


def test_compute_event_analytics_updates_existing_row(db):
    from app.tasks.analytics import compute_event_analytics
    from app.models.analytics import EventAnalytics

    organizer = make_organizer(db)
    event = make_event(db, owner=organizer, status="published")

    with patch("app.tasks.analytics.get_db_context", db_ctx(db)):
        compute_event_analytics(event.id)

    user = make_user(db, email="late@test.com")
    make_registration(db, user=user, event=event)

    with patch("app.tasks.analytics.get_db_context", db_ctx(db)):
        compute_event_analytics(event.id)

    rows = db.query(EventAnalytics).filter(EventAnalytics.event_id == event.id).all()
    assert len(rows) == 1
    assert rows[0].total_registrations == 1


def test_compute_event_analytics_noop_for_missing_event(db):
    from app.tasks.analytics import compute_event_analytics
    from app.models.analytics import EventAnalytics

    with patch("app.tasks.analytics.get_db_context", db_ctx(db)):
        compute_event_analytics(99999)

    assert db.query(EventAnalytics).count() == 0


# ─── compute_platform_analytics ──────────────────────────

def test_compute_platform_analytics_first_run(db):
    from app.tasks.analytics import compute_platform_analytics
    from app.models.analytics import PlatformAnalytics

    organizer = make_organizer(db)
    make_event(db, owner=organizer, status="published")
    user = make_user(db, email="u@test.com")

    with patch("app.tasks.analytics.get_db_context", db_ctx(db)):
        compute_platform_analytics()

    row = db.query(PlatformAnalytics).first()
    assert row is not None
    assert row.total_users >= 1
    assert row.total_events >= 1
    assert row.active_events >= 1


def test_compute_platform_analytics_incremental(db):
    from app.tasks.analytics import compute_platform_analytics
    from app.models.analytics import PlatformAnalytics
    from datetime import date, timedelta

    yesterday = PlatformAnalytics(
        date=date.today() - timedelta(days=1),
        total_users=10,
        new_users=2,
        total_events=5,
        new_events=1,
        total_registrations=20,
        total_revenue=500.0,
        active_events=3,
        computed_at=datetime.now(),
    )
    db.add(yesterday)
    db.commit()

    with patch("app.tasks.analytics.get_db_context", db_ctx(db)):
        compute_platform_analytics()

    today_row = db.query(PlatformAnalytics).filter(
        PlatformAnalytics.date == date.today()
    ).first()
    assert today_row is not None
    assert today_row.total_users >= 10


def test_compute_platform_analytics_idempotent(db):
    from app.tasks.analytics import compute_platform_analytics
    from app.models.analytics import PlatformAnalytics
    from datetime import date

    with patch("app.tasks.analytics.get_db_context", db_ctx(db)):
        compute_platform_analytics()
        compute_platform_analytics()

    assert db.query(PlatformAnalytics).filter(PlatformAnalytics.date == date.today()).count() == 1


# ─── cleanup_expired_notifications ───────────────────────

def test_cleanup_expired_notifications_deletes_old(db):
    from app.tasks.notifications import cleanup_expired_notifications
    from app.models.notification import Notification

    user = make_user(db)
    old = Notification(
        user_id=user.id,
        title="Old",
        message="Old notification",
        type="general",
        created_at=datetime.utcnow() - timedelta(days=100),
        expires_at=datetime.utcnow() - timedelta(days=10),
    )
    recent = Notification(
        user_id=user.id,
        title="Recent",
        message="Recent notification",
        type="general",
        created_at=datetime.utcnow() - timedelta(days=1),
        expires_at=datetime.utcnow() + timedelta(days=89),
    )
    db.add_all([old, recent])
    db.commit()

    with patch("app.tasks.notifications.get_db_context", db_ctx(db)):
        deleted = cleanup_expired_notifications()

    assert deleted == 1
    assert db.query(Notification).count() == 1
    assert db.query(Notification).first().title == "Recent"


def test_cleanup_expired_notifications_empty(db):
    from app.tasks.notifications import cleanup_expired_notifications

    with patch("app.tasks.notifications.get_db_context", db_ctx(db)):
        deleted = cleanup_expired_notifications()

    assert deleted == 0


# ─── create_in_app_notification ──────────────────────────

def test_create_in_app_notification_creates_row(db):
    from app.tasks.notifications import create_in_app_notification
    from app.models.notification import Notification

    user = make_user(db)

    with patch("app.tasks.notifications.get_db_context", db_ctx(db)):
        create_in_app_notification(
            user_id=user.id,
            title="Hello",
            message="You have a notification",
            notification_type="general",
            event_id=None,
        )

    notif = db.query(Notification).filter(Notification.user_id == user.id).first()
    assert notif is not None
    assert notif.title == "Hello"


def test_create_in_app_notification_respects_opt_out(db):
    from app.tasks.notifications import create_in_app_notification
    from app.models.notification import Notification, NotificationPreferences

    user = make_user(db)
    prefs = NotificationPreferences(user_id=user.id, in_app_enabled=False)
    db.add(prefs)
    db.commit()

    with patch("app.tasks.notifications.get_db_context", db_ctx(db)):
        create_in_app_notification(
            user_id=user.id,
            title="Ignored",
            message="Should not be created",
            notification_type="general",
        )

    assert db.query(Notification).filter(Notification.user_id == user.id).count() == 0


def test_create_in_app_notification_with_event_id(db):
    from app.tasks.notifications import create_in_app_notification
    from app.models.notification import Notification

    organizer = make_organizer(db)
    event = make_event(db, owner=organizer)
    user = make_user(db, email="u@test.com")

    with patch("app.tasks.notifications.get_db_context", db_ctx(db)):
        create_in_app_notification(
            user_id=user.id,
            title="Event notification",
            message="Something happened",
            notification_type="event_update",
            event_id=event.id,
        )

    notif = db.query(Notification).filter(Notification.user_id == user.id).first()
    assert notif.event_id == event.id
