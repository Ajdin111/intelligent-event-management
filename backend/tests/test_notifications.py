import pytest
from datetime import datetime, timedelta
from tests.conftest import make_user, auth_headers
from app.models.notification import Notification, NotificationPreferences


# ─── Helpers ─────────────────────────────────────────────

def make_notification(
    db,
    user,
    title="Test Notification",
    message="Test message",
    type="registration_confirmation",
    is_read=False,
    expires_at=None,
):
    notification = Notification(
        user_id=user.id,
        title=title,
        message=message,
        type=type,
        is_read=is_read,
        expires_at=expires_at,
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification


# ─── GET /api/notifications ───────────────────────────────

def test_list_notifications_empty(client, db):
    user = make_user(db)
    resp = client.get("/api/notifications/", headers=auth_headers(user))
    assert resp.status_code == 200
    assert resp.json() == []


def test_list_notifications_returns_own_only(client, db):
    user = make_user(db, email="user1@test.com")
    other = make_user(db, email="user2@test.com")
    make_notification(db, user, title="Mine")
    make_notification(db, other, title="Not mine")

    resp = client.get("/api/notifications/", headers=auth_headers(user))
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["title"] == "Mine"


def test_list_notifications_excludes_expired(client, db):
    user = make_user(db)
    make_notification(db, user, title="Active", expires_at=None)
    make_notification(
        db, user,
        title="Expired",
        expires_at=datetime.now() - timedelta(days=1)
    )

    resp = client.get("/api/notifications/", headers=auth_headers(user))
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["title"] == "Active"


def test_list_notifications_includes_no_expiry(client, db):
    user = make_user(db)
    make_notification(db, user, title="No expiry", expires_at=None)

    resp = client.get("/api/notifications/", headers=auth_headers(user))
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_list_notifications_ordered_newest_first(client, db):
    from datetime import timedelta
    user = make_user(db)
    n1 = make_notification(db, user, title="First")
    
    # force n2 to have a later created_at
    n2 = Notification(
        user_id=user.id,
        title="Second",
        message="Test message",
        type="registration_confirmation",
        is_read=False,
        created_at=datetime.now() + timedelta(seconds=1),
    )
    db.add(n2)
    db.commit()
    db.refresh(n2)

    resp = client.get("/api/notifications/", headers=auth_headers(user))
    data = resp.json()
    assert data[0]["id"] == n2.id
    assert data[1]["id"] == n1.id


def test_list_notifications_unauthenticated(client):
    resp = client.get("/api/notifications/")
    assert resp.status_code == 401


# ─── GET /api/notifications/unread-count ─────────────────

def test_unread_count_zero(client, db):
    user = make_user(db)
    resp = client.get("/api/notifications/unread-count", headers=auth_headers(user))
    assert resp.status_code == 200
    assert resp.json()["unread_count"] == 0


def test_unread_count_correct(client, db):
    user = make_user(db)
    make_notification(db, user, is_read=False)
    make_notification(db, user, is_read=False)
    make_notification(db, user, is_read=True)

    resp = client.get("/api/notifications/unread-count", headers=auth_headers(user))
    assert resp.status_code == 200
    assert resp.json()["unread_count"] == 2


def test_unread_count_excludes_expired(client, db):
    user = make_user(db)
    make_notification(db, user, is_read=False, expires_at=None)
    make_notification(
        db, user,
        is_read=False,
        expires_at=datetime.now() - timedelta(days=1)
    )

    resp = client.get("/api/notifications/unread-count", headers=auth_headers(user))
    assert resp.json()["unread_count"] == 1


def test_unread_count_unauthenticated(client):
    resp = client.get("/api/notifications/unread-count")
    assert resp.status_code == 401


# ─── PATCH /api/notifications/{id}/read ──────────────────

def test_mark_as_read_success(client, db):
    user = make_user(db)
    n = make_notification(db, user, is_read=False)

    resp = client.patch(
        f"/api/notifications/{n.id}/read",
        headers=auth_headers(user)
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_read"] is True
    assert data["read_at"] is not None


def test_mark_as_read_already_read(client, db):
    user = make_user(db)
    n = make_notification(db, user, is_read=True)

    resp = client.patch(
        f"/api/notifications/{n.id}/read",
        headers=auth_headers(user)
    )
    assert resp.status_code == 200
    assert resp.json()["is_read"] is True


def test_mark_as_read_not_found(client, db):
    user = make_user(db)
    resp = client.patch(
        "/api/notifications/99999/read",
        headers=auth_headers(user)
    )
    assert resp.status_code == 404


def test_mark_as_read_other_users_notification(client, db):
    user = make_user(db, email="user1@test.com")
    other = make_user(db, email="user2@test.com")
    n = make_notification(db, other)

    resp = client.patch(
        f"/api/notifications/{n.id}/read",
        headers=auth_headers(user)
    )
    assert resp.status_code == 404


def test_mark_as_read_unauthenticated(client, db):
    user = make_user(db)
    n = make_notification(db, user)
    resp = client.patch(f"/api/notifications/{n.id}/read")
    assert resp.status_code == 401


# ─── PATCH /api/notifications/read-all ───────────────────

def test_mark_all_as_read_success(client, db):
    user = make_user(db)
    make_notification(db, user, is_read=False)
    make_notification(db, user, is_read=False)
    make_notification(db, user, is_read=False)

    resp = client.patch(
        "/api/notifications/read-all",
        headers=auth_headers(user)
    )
    assert resp.status_code == 200
    assert resp.json()["detail"] == "All notifications marked as read"

    count_resp = client.get(
        "/api/notifications/unread-count",
        headers=auth_headers(user)
    )
    assert count_resp.json()["unread_count"] == 0


def test_mark_all_as_read_only_affects_own(client, db):
    user = make_user(db, email="user1@test.com")
    other = make_user(db, email="user2@test.com")
    make_notification(db, other, is_read=False)

    client.patch("/api/notifications/read-all", headers=auth_headers(user))

    count_resp = client.get(
        "/api/notifications/unread-count",
        headers=auth_headers(other)
    )
    assert count_resp.json()["unread_count"] == 1


def test_mark_all_as_read_empty(client, db):
    user = make_user(db)
    resp = client.patch(
        "/api/notifications/read-all",
        headers=auth_headers(user)
    )
    assert resp.status_code == 200


def test_mark_all_as_read_unauthenticated(client):
    resp = client.patch("/api/notifications/read-all")
    assert resp.status_code == 401


# ─── DELETE /api/notifications/{id} ──────────────────────

def test_delete_notification_success(client, db):
    user = make_user(db)
    n = make_notification(db, user)

    resp = client.delete(
        f"/api/notifications/{n.id}",
        headers=auth_headers(user)
    )
    assert resp.status_code == 204

    deleted = db.query(Notification).filter(Notification.id == n.id).first()
    assert deleted is None


def test_delete_notification_not_found(client, db):
    user = make_user(db)
    resp = client.delete(
        "/api/notifications/99999",
        headers=auth_headers(user)
    )
    assert resp.status_code == 404


def test_delete_other_users_notification(client, db):
    user = make_user(db, email="user1@test.com")
    other = make_user(db, email="user2@test.com")
    n = make_notification(db, other)

    resp = client.delete(
        f"/api/notifications/{n.id}",
        headers=auth_headers(user)
    )
    assert resp.status_code == 404

    still_exists = db.query(Notification).filter(Notification.id == n.id).first()
    assert still_exists is not None


def test_delete_notification_unauthenticated(client, db):
    user = make_user(db)
    n = make_notification(db, user)
    resp = client.delete(f"/api/notifications/{n.id}")
    assert resp.status_code == 401


# ─── GET /api/notifications/preferences ──────────────────

def test_get_preferences_creates_defaults(client, db):
    user = make_user(db)
    resp = client.get(
        "/api/notifications/preferences",
        headers=auth_headers(user)
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["registration_confirmation"] is True
    assert data["event_reminders"] is True
    assert data["email_enabled"] is True
    assert data["in_app_enabled"] is True
    assert data["user_id"] == user.id


def test_get_preferences_returns_existing(client, db):
    user = make_user(db)
    prefs = NotificationPreferences(
        user_id=user.id,
        email_enabled=False,
        event_reminders=False,
    )
    db.add(prefs)
    db.commit()

    resp = client.get(
        "/api/notifications/preferences",
        headers=auth_headers(user)
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["email_enabled"] is False
    assert data["event_reminders"] is False


def test_get_preferences_unauthenticated(client):
    resp = client.get("/api/notifications/preferences")
    assert resp.status_code == 401


# ─── PATCH /api/notifications/preferences ────────────────

def test_update_preferences_single_field(client, db):
    user = make_user(db)
    resp = client.patch(
        "/api/notifications/preferences",
        headers=auth_headers(user),
        json={"email_enabled": False}
    )
    assert resp.status_code == 200
    assert resp.json()["email_enabled"] is False
    assert resp.json()["in_app_enabled"] is True


def test_update_preferences_multiple_fields(client, db):
    user = make_user(db)
    resp = client.patch(
        "/api/notifications/preferences",
        headers=auth_headers(user),
        json={
            "email_enabled": False,
            "event_reminders": False,
            "feedback_requests": False,
        }
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["email_enabled"] is False
    assert data["event_reminders"] is False
    assert data["feedback_requests"] is False
    assert data["registration_confirmation"] is True


def test_update_preferences_creates_if_not_exists(client, db):
    user = make_user(db)
    resp = client.patch(
        "/api/notifications/preferences",
        headers=auth_headers(user),
        json={"in_app_enabled": False}
    )
    assert resp.status_code == 200
    assert resp.json()["in_app_enabled"] is False


def test_update_preferences_empty_body(client, db):
    user = make_user(db)
    resp = client.patch(
        "/api/notifications/preferences",
        headers=auth_headers(user),
        json={}
    )
    assert resp.status_code == 200
    assert resp.json()["email_enabled"] is True


def test_update_preferences_unauthenticated(client):
    resp = client.patch(
        "/api/notifications/preferences",
        json={"email_enabled": False}
    )
    assert resp.status_code == 401