import pytest
from decimal import Decimal
from tests.conftest import make_user, make_organizer, make_admin, make_event, make_registration, auth_headers
from app.models.analytics import PlatformAnalytics, EventAnalytics
from app.models.review import Review
from datetime import date, datetime


# ─── GET /api/admin/users ─────────────────────────────────

def test_list_users_as_admin(client, db):
    admin = make_admin(db)
    make_user(db, email="user1@test.com")
    make_user(db, email="user2@test.com")

    resp = client.get("/api/admin/users", headers=auth_headers(admin))
    assert resp.status_code == 200
    assert len(resp.json()) >= 2


def test_list_users_unauthenticated(client):
    resp = client.get("/api/admin/users")
    assert resp.status_code == 401


def test_list_users_as_non_admin(client, db):
    user = make_user(db)
    resp = client.get("/api/admin/users", headers=auth_headers(user))
    assert resp.status_code == 403


def test_list_users_search_by_email(client, db):
    admin = make_admin(db)
    make_user(db, email="findme@test.com")
    make_user(db, email="other@test.com")

    resp = client.get("/api/admin/users?search=findme", headers=auth_headers(admin))
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["email"] == "findme@test.com"


def test_list_users_search_by_name(client, db):
    admin = make_admin(db)
    user = make_user(db, email="john@test.com")
    user.first_name = "John"
    db.commit()

    resp = client.get("/api/admin/users?search=John", headers=auth_headers(admin))
    assert resp.status_code == 200
    assert any(u["email"] == "john@test.com" for u in resp.json())


def test_list_users_filter_by_role_attendee(client, db):
    admin = make_admin(db)
    make_user(db, email="attendee@test.com")
    make_organizer(db, email="organizer@test.com")

    resp = client.get("/api/admin/users?role=attendee", headers=auth_headers(admin))
    assert resp.status_code == 200
    assert all(not u["is_organizer"] for u in resp.json())


def test_list_users_filter_by_role_organizer(client, db):
    admin = make_admin(db)
    make_organizer(db, email="org@test.com")

    resp = client.get("/api/admin/users?role=organizer", headers=auth_headers(admin))
    assert resp.status_code == 200
    assert all(u["is_organizer"] for u in resp.json())


def test_list_users_filter_by_role_admin(client, db):
    admin = make_admin(db)
    make_user(db, email="regular@test.com")

    resp = client.get("/api/admin/users?role=admin", headers=auth_headers(admin))
    assert resp.status_code == 200
    assert all(u["is_admin"] for u in resp.json())


def test_list_users_invalid_role_filter(client, db):
    admin = make_admin(db)
    resp = client.get("/api/admin/users?role=superuser", headers=auth_headers(admin))
    assert resp.status_code == 400


# ─── GET /api/admin/users/{id} ───────────────────────────

def test_get_user_by_id(client, db):
    admin = make_admin(db)
    user = make_user(db, email="target@test.com")

    resp = client.get(f"/api/admin/users/{user.id}", headers=auth_headers(admin))
    assert resp.status_code == 200
    assert resp.json()["email"] == "target@test.com"


def test_get_user_by_id_not_found(client, db):
    admin = make_admin(db)
    resp = client.get("/api/admin/users/99999", headers=auth_headers(admin))
    assert resp.status_code == 404


def test_get_user_by_id_non_admin(client, db):
    user = make_user(db, email="user@test.com")
    other = make_user(db, email="other@test.com")
    resp = client.get(f"/api/admin/users/{other.id}", headers=auth_headers(user))
    assert resp.status_code == 403


# ─── PATCH /api/admin/users/{id}/deactivate ──────────────

def test_deactivate_user(client, db):
    admin = make_admin(db)
    user = make_user(db, email="active@test.com")

    resp = client.patch(f"/api/admin/users/{user.id}/deactivate", headers=auth_headers(admin))
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False


def test_deactivate_own_account(client, db):
    admin = make_admin(db)
    resp = client.patch(f"/api/admin/users/{admin.id}/deactivate", headers=auth_headers(admin))
    assert resp.status_code == 400


def test_deactivate_user_not_found(client, db):
    admin = make_admin(db)
    resp = client.patch("/api/admin/users/99999/deactivate", headers=auth_headers(admin))
    assert resp.status_code == 404


def test_deactivate_user_non_admin(client, db):
    user = make_user(db, email="user@test.com")
    other = make_user(db, email="other@test.com")
    resp = client.patch(f"/api/admin/users/{other.id}/deactivate", headers=auth_headers(user))
    assert resp.status_code == 403


# ─── PATCH /api/admin/users/{id}/activate ────────────────

def test_activate_user(client, db):
    admin = make_admin(db)
    user = make_user(db, email="inactive@test.com")
    user.is_active = False
    db.commit()

    resp = client.patch(f"/api/admin/users/{user.id}/activate", headers=auth_headers(admin))
    assert resp.status_code == 200
    assert resp.json()["is_active"] is True


def test_activate_user_not_found(client, db):
    admin = make_admin(db)
    resp = client.patch("/api/admin/users/99999/activate", headers=auth_headers(admin))
    assert resp.status_code == 404


def test_activate_user_non_admin(client, db):
    user = make_user(db, email="user@test.com")
    other = make_user(db, email="other@test.com")
    resp = client.patch(f"/api/admin/users/{other.id}/activate", headers=auth_headers(user))
    assert resp.status_code == 403


# ─── DELETE /api/admin/users/{id} ────────────────────────

def test_delete_user_success(client, db):
    admin = make_admin(db)
    user = make_user(db, email="deleteme@test.com")

    resp = client.delete(f"/api/admin/users/{user.id}", headers=auth_headers(admin))
    assert resp.status_code == 204


def test_delete_user_with_events(client, db):
    admin = make_admin(db)
    organizer = make_organizer(db, email="org@test.com")
    make_event(db, owner=organizer)

    resp = client.delete(f"/api/admin/users/{organizer.id}", headers=auth_headers(admin))
    assert resp.status_code == 400


def test_delete_user_with_registrations(client, db):
    admin = make_admin(db)
    organizer = make_organizer(db, email="org2@test.com")
    user = make_user(db, email="reg@test.com")
    event = make_event(db, owner=organizer, status="published")
    make_registration(db, user=user, event=event)

    resp = client.delete(f"/api/admin/users/{user.id}", headers=auth_headers(admin))
    assert resp.status_code == 400


def test_delete_user_not_found(client, db):
    admin = make_admin(db)
    resp = client.delete("/api/admin/users/99999", headers=auth_headers(admin))
    assert resp.status_code == 404


def test_delete_user_non_admin(client, db):
    user = make_user(db, email="user@test.com")
    other = make_user(db, email="other@test.com")
    resp = client.delete(f"/api/admin/users/{other.id}", headers=auth_headers(user))
    assert resp.status_code == 403


# ─── GET /api/admin/events ───────────────────────────────

def test_list_events_as_admin(client, db):
    admin = make_admin(db)
    organizer = make_organizer(db, email="org@test.com")
    make_event(db, owner=organizer, status="published")
    make_event(db, owner=organizer, status="draft", title="Draft Event")

    resp = client.get("/api/admin/events", headers=auth_headers(admin))
    assert resp.status_code == 200
    assert len(resp.json()) == 2


def test_list_events_filter_by_status(client, db):
    admin = make_admin(db)
    organizer = make_organizer(db, email="org@test.com")
    make_event(db, owner=organizer, status="published")
    make_event(db, owner=organizer, status="draft", title="Draft Event")

    resp = client.get("/api/admin/events?status=published", headers=auth_headers(admin))
    assert resp.status_code == 200
    data = resp.json()
    assert all(e["status"] == "published" for e in data)


def test_list_events_unauthenticated(client):
    resp = client.get("/api/admin/events")
    assert resp.status_code == 401


def test_list_events_non_admin(client, db):
    user = make_user(db)
    resp = client.get("/api/admin/events", headers=auth_headers(user))
    assert resp.status_code == 403


# ─── PATCH /api/admin/events/{id}/unpublish ──────────────

def test_force_unpublish_event(client, db):
    admin = make_admin(db)
    organizer = make_organizer(db, email="org@test.com")
    event = make_event(db, owner=organizer, status="published")

    resp = client.patch(f"/api/admin/events/{event.id}/unpublish", headers=auth_headers(admin))
    assert resp.status_code == 200
    assert resp.json()["status"] == "draft"


def test_force_unpublish_event_not_found(client, db):
    admin = make_admin(db)
    resp = client.patch("/api/admin/events/99999/unpublish", headers=auth_headers(admin))
    assert resp.status_code == 404


def test_force_unpublish_event_non_admin(client, db):
    user = make_user(db)
    organizer = make_organizer(db, email="org@test.com")
    event = make_event(db, owner=organizer, status="published")
    resp = client.patch(f"/api/admin/events/{event.id}/unpublish", headers=auth_headers(user))
    assert resp.status_code == 403


# ─── DELETE /api/admin/events/{id} ───────────────────────

def test_force_delete_event(client, db):
    admin = make_admin(db)
    organizer = make_organizer(db, email="org@test.com")
    event = make_event(db, owner=organizer)

    resp = client.delete(f"/api/admin/events/{event.id}", headers=auth_headers(admin))
    assert resp.status_code == 204


def test_force_delete_event_not_found(client, db):
    admin = make_admin(db)
    resp = client.delete("/api/admin/events/99999", headers=auth_headers(admin))
    assert resp.status_code == 404


def test_force_delete_event_non_admin(client, db):
    user = make_user(db)
    organizer = make_organizer(db, email="org@test.com")
    event = make_event(db, owner=organizer)
    resp = client.delete(f"/api/admin/events/{event.id}", headers=auth_headers(user))
    assert resp.status_code == 403


# ─── GET /api/admin/analytics ────────────────────────────

def test_get_platform_analytics_empty(client, db):
    admin = make_admin(db)
    resp = client.get("/api/admin/analytics", headers=auth_headers(admin))
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_users"] == 0
    assert data["total_events"] == 0
    assert float(data["total_revenue"]) == 0.0


def test_get_platform_analytics_with_data(client, db):
    admin = make_admin(db)
    analytics = PlatformAnalytics(
        date=date.today(),
        total_users=100,
        new_users=10,
        total_events=50,
        new_events=5,
        total_registrations=200,
        total_revenue=5000.00,
        active_events=20,
        computed_at=datetime.now()
    )
    db.add(analytics)
    db.commit()

    resp = client.get("/api/admin/analytics", headers=auth_headers(admin))
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_users"] == 100
    assert data["total_events"] == 50
    assert data["active_events"] == 20


def test_get_platform_analytics_unauthenticated(client):
    resp = client.get("/api/admin/analytics")
    assert resp.status_code == 401


def test_get_platform_analytics_non_admin(client, db):
    user = make_user(db)
    resp = client.get("/api/admin/analytics", headers=auth_headers(user))
    assert resp.status_code == 403


# ─── Fix 1: owner_email populated in list ────────────────

def test_list_events_owner_email_populated(client, db):
    admin = make_admin(db)
    organizer = make_organizer(db, email="org@test.com")
    make_event(db, owner=organizer, status="published")

    resp = client.get("/api/admin/events", headers=auth_headers(admin))
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["owner_email"] == "org@test.com"


def test_list_events_owner_email_matches_owner(client, db):
    admin = make_admin(db)
    org1 = make_organizer(db, email="org1@test.com")
    org2 = make_organizer(db, email="org2@test.com")
    make_event(db, owner=org1, title="Event 1")
    make_event(db, owner=org2, title="Event 2")

    resp = client.get("/api/admin/events", headers=auth_headers(admin))
    assert resp.status_code == 200
    emails = {e["title"]: e["owner_email"] for e in resp.json()}
    assert emails["Event 1"] == "org1@test.com"
    assert emails["Event 2"] == "org2@test.com"


# ─── Fix 2: total_registrations / total_revenue in list ──

def test_list_events_analytics_null_when_no_data(client, db):
    admin = make_admin(db)
    organizer = make_organizer(db, email="org@test.com")
    make_event(db, owner=organizer, status="published")

    resp = client.get("/api/admin/events", headers=auth_headers(admin))
    assert resp.status_code == 200
    data = resp.json()[0]
    assert data["total_registrations"] is None
    assert data["total_revenue"] is None


def test_list_events_analytics_populated_when_data_exists(client, db):
    admin = make_admin(db)
    organizer = make_organizer(db, email="org@test.com")
    event = make_event(db, owner=organizer, status="published")

    analytics = EventAnalytics(
        event_id=event.id,
        total_registrations=42,
        confirmed_registrations=40,
        cancelled_registrations=2,
        total_checked_in=35,
        attendance_rate=Decimal("87.50"),
        total_revenue=Decimal("1200.00"),
        average_rating=Decimal("4.50"),
        total_reviews=10,
        positive_sentiment_pct=Decimal("80.00"),
        negative_sentiment_pct=Decimal("10.00"),
        neutral_sentiment_pct=Decimal("10.00"),
    )
    db.add(analytics)
    db.commit()

    resp = client.get("/api/admin/events", headers=auth_headers(admin))
    assert resp.status_code == 200
    data = resp.json()[0]
    assert data["total_registrations"] == 42
    assert float(data["total_revenue"]) == 1200.00


# ─── Fix 3: admin can access event registrations ─────────

def test_admin_can_view_event_registrations(client, db):
    admin = make_admin(db)
    organizer = make_organizer(db, email="org@test.com")
    user = make_user(db, email="attendee@test.com")
    event = make_event(db, owner=organizer, status="published")
    make_registration(db, user=user, event=event)

    resp = client.get(f"/api/events/{event.id}/registrations", headers=auth_headers(admin))
    assert resp.status_code == 200
    assert len(resp.json()["items"]) == 1


def test_non_owner_non_admin_blocked_from_registrations(client, db):
    organizer = make_organizer(db, email="org@test.com")
    other = make_user(db, email="other@test.com")
    event = make_event(db, owner=organizer, status="published")

    resp = client.get(f"/api/events/{event.id}/registrations", headers=auth_headers(other))
    assert resp.status_code == 403


# ─── Fix 4: GET /api/admin/events/{id} ───────────────────

def test_admin_get_event_detail(client, db):
    admin = make_admin(db)
    organizer = make_organizer(db, email="org@test.com")
    event = make_event(db, owner=organizer, status="draft")

    resp = client.get(f"/api/admin/events/{event.id}", headers=auth_headers(admin))
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == event.id
    assert data["owner_email"] == "org@test.com"
    assert data["owner_first_name"] == "Org"
    assert data["owner_last_name"] == "User"


def test_admin_get_event_detail_includes_draft(client, db):
    admin = make_admin(db)
    organizer = make_organizer(db, email="org@test.com")
    event = make_event(db, owner=organizer, status="draft")

    resp = client.get(f"/api/admin/events/{event.id}", headers=auth_headers(admin))
    assert resp.status_code == 200
    assert resp.json()["status"] == "draft"


def test_admin_get_event_detail_not_found(client, db):
    admin = make_admin(db)
    resp = client.get("/api/admin/events/99999", headers=auth_headers(admin))
    assert resp.status_code == 404


def test_admin_get_event_detail_non_admin(client, db):
    user = make_user(db)
    organizer = make_organizer(db, email="org@test.com")
    event = make_event(db, owner=organizer)

    resp = client.get(f"/api/admin/events/{event.id}", headers=auth_headers(user))
    assert resp.status_code == 403


# ─── Fix 5: admin bypasses feedback_visibility ───────────

def test_admin_can_view_organizer_only_reviews(client, db):
    admin = make_admin(db)
    organizer = make_organizer(db, email="org@test.com")
    user = make_user(db, email="attendee@test.com")
    event = make_event(db, owner=organizer, status="published")

    review = Review(
        event_id=event.id,
        user_id=user.id,
        rating=5,
        comment="Great event",
        is_anonymous=False,
        sentiment=None,
    )
    db.add(review)
    db.commit()

    resp = client.get(f"/api/events/{event.id}/reviews", headers=auth_headers(admin))
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_non_owner_blocked_from_organizer_only_reviews(client, db):
    organizer = make_organizer(db, email="org@test.com")
    other = make_user(db, email="other@test.com")
    event = make_event(db, owner=organizer, status="published")

    resp = client.get(f"/api/events/{event.id}/reviews", headers=auth_headers(other))
    assert resp.status_code == 403


# ─── Fix 6: GET /api/admin/events/{id}/analytics ─────────

def test_admin_get_event_analytics(client, db):
    admin = make_admin(db)
    organizer = make_organizer(db, email="org@test.com")
    event = make_event(db, owner=organizer, status="published")

    analytics = EventAnalytics(
        event_id=event.id,
        total_registrations=50,
        confirmed_registrations=45,
        cancelled_registrations=5,
        total_checked_in=40,
        attendance_rate=Decimal("88.89"),
        total_revenue=Decimal("2500.00"),
        average_rating=Decimal("4.20"),
        total_reviews=15,
        positive_sentiment_pct=Decimal("75.00"),
        negative_sentiment_pct=Decimal("15.00"),
        neutral_sentiment_pct=Decimal("10.00"),
    )
    db.add(analytics)
    db.commit()

    resp = client.get(f"/api/admin/events/{event.id}/analytics", headers=auth_headers(admin))
    assert resp.status_code == 200
    data = resp.json()
    assert data["event_id"] == event.id
    assert data["total_registrations"] == 50
    assert float(data["total_revenue"]) == 2500.00
    assert float(data["average_rating"]) == 4.20


def test_admin_get_event_analytics_not_yet_computed(client, db):
    admin = make_admin(db)
    organizer = make_organizer(db, email="org@test.com")
    event = make_event(db, owner=organizer, status="published")

    resp = client.get(f"/api/admin/events/{event.id}/analytics", headers=auth_headers(admin))
    assert resp.status_code == 404


def test_admin_get_event_analytics_event_not_found(client, db):
    admin = make_admin(db)
    resp = client.get("/api/admin/events/99999/analytics", headers=auth_headers(admin))
    assert resp.status_code == 404


def test_admin_get_event_analytics_non_admin(client, db):
    user = make_user(db)
    organizer = make_organizer(db, email="org@test.com")
    event = make_event(db, owner=organizer)

    resp = client.get(f"/api/admin/events/{event.id}/analytics", headers=auth_headers(user))
    assert resp.status_code == 403
