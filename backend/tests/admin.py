import pytest
from tests.conftest import make_user, make_organizer, make_admin, make_event, make_registration, auth_headers
from app.models.analytics import PlatformAnalytics
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