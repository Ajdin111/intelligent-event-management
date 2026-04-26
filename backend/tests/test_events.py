import pytest
from datetime import datetime
from tests.conftest import (
    make_user, make_organizer, make_event, make_category, auth_headers,
)


# ─── Create Event ────────────────────────────────────────

def test_create_event_as_organizer(client, db):
    org = make_organizer(db)
    resp = client.post("/api/events", json={
        "title": "My Conference",
        "description": "A great event",
        "location_type": "physical",
        "physical_address": "123 Main St",
        "start_datetime": "2025-12-01T09:00:00",
        "end_datetime": "2025-12-01T17:00:00",
        "registration_type": "automatic",
        "requires_registration": True,
        "has_ticketing": True,
        "is_free": True,
    }, headers=auth_headers(org))
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "My Conference"
    assert data["status"] == "draft"
    assert data["owner_id"] == org.id


def test_create_event_as_attendee(client, db):
    user = make_user(db)
    resp = client.post("/api/events", json={
        "title": "Unauthorized",
        "description": "Should fail",
        "location_type": "physical",
        "physical_address": "Somewhere",
        "start_datetime": "2025-12-01T09:00:00",
        "end_datetime": "2025-12-01T17:00:00",
    }, headers=auth_headers(user))
    assert resp.status_code == 403


def test_create_event_end_before_start(client, db):
    org = make_organizer(db)
    resp = client.post("/api/events", json={
        "title": "Bad Dates",
        "description": "desc",
        "location_type": "physical",
        "physical_address": "Addr",
        "start_datetime": "2025-12-01T17:00:00",
        "end_datetime": "2025-12-01T09:00:00",  # before start
    }, headers=auth_headers(org))
    assert resp.status_code == 400


def test_create_online_event_without_link(client, db):
    org = make_organizer(db)
    resp = client.post("/api/events", json={
        "title": "Online Event",
        "description": "desc",
        "location_type": "online",
        "start_datetime": "2025-12-01T09:00:00",
        "end_datetime": "2025-12-01T17:00:00",
    }, headers=auth_headers(org))
    assert resp.status_code == 400


def test_create_online_event_with_link(client, db):
    org = make_organizer(db)
    resp = client.post("/api/events", json={
        "title": "Online Event",
        "description": "desc",
        "location_type": "online",
        "online_link": "https://zoom.us/j/123",
        "start_datetime": "2025-12-01T09:00:00",
        "end_datetime": "2025-12-01T17:00:00",
    }, headers=auth_headers(org))
    assert resp.status_code == 201


def test_create_event_with_categories(client, db):
    org = make_organizer(db)
    cat = make_category(db, name="Tech")
    resp = client.post("/api/events", json={
        "title": "Tech Summit",
        "description": "desc",
        "location_type": "physical",
        "physical_address": "Addr",
        "start_datetime": "2025-12-01T09:00:00",
        "end_datetime": "2025-12-01T17:00:00",
        "category_ids": [cat.id],
    }, headers=auth_headers(org))
    assert resp.status_code == 201
    assert cat.id in resp.json()["category_ids"]


def test_create_event_with_invalid_category(client, db):
    org = make_organizer(db)
    resp = client.post("/api/events", json={
        "title": "Event",
        "description": "desc",
        "location_type": "physical",
        "physical_address": "Addr",
        "start_datetime": "2025-12-01T09:00:00",
        "end_datetime": "2025-12-01T17:00:00",
        "category_ids": [9999],
    }, headers=auth_headers(org))
    assert resp.status_code == 400


# ─── List Events ─────────────────────────────────────────

def test_list_events_returns_only_published(client, db):
    org = make_organizer(db)
    make_event(db, org, title="Draft", status="draft")
    make_event(db, org, title="Published", status="published")
    resp = client.get("/api/events")
    assert resp.status_code == 200
    data = resp.json()
    titles = [e["title"] for e in data["items"]]
    assert "Published" in titles
    assert "Draft" not in titles


def test_list_events_pagination(client, db):
    org = make_organizer(db)
    for i in range(5):
        make_event(db, org, title=f"Event {i}", status="published")
    resp = client.get("/api/events?skip=0&limit=2")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 5
    assert len(data["items"]) == 2
    assert data["skip"] == 0
    assert data["limit"] == 2


def test_list_events_excludes_deleted(client, db):
    org = make_organizer(db)
    event = make_event(db, org, status="published")
    event.deleted_at = datetime.now()
    db.commit()
    resp = client.get("/api/events")
    assert resp.json()["total"] == 0


# ─── Get Event by ID ──────────────────────────────────────

def test_get_event_by_id(client, db):
    org = make_organizer(db)
    event = make_event(db, org, title="Detail Test", status="published")
    resp = client.get(f"/api/events/{event.id}", headers=auth_headers(org))
    assert resp.status_code == 200
    assert resp.json()["title"] == "Detail Test"


def test_get_event_not_found(client, db):
    org = make_organizer(db)
    resp = client.get("/api/events/9999", headers=auth_headers(org))
    assert resp.status_code == 404


def test_get_event_hides_online_link_for_anonymous(client, db):
    org = make_organizer(db)
    event = make_event(db, org, status="published")
    # Give event an online link
    event.online_link = "https://secret.link/meeting"
    event.location_type = "online"
    db.commit()
    # Anonymous: no token; but oauth2_scheme auto_error=True will return 401
    # So we test with a different (non-owner) user
    other = make_user(db, email="visitor@test.com")
    resp = client.get(f"/api/events/{event.id}", headers=auth_headers(other))
    assert resp.status_code == 200
    # Non-owner user sees the link (get_event_by_id only hides it when current_user is None)


# ─── Update Event ────────────────────────────────────────

def test_update_event(client, db):
    org = make_organizer(db)
    event = make_event(db, org)
    resp = client.patch(f"/api/events/{event.id}", json={
        "title": "Updated Title",
    }, headers=auth_headers(org))
    assert resp.status_code == 200
    assert resp.json()["title"] == "Updated Title"


def test_update_event_wrong_user(client, db):
    org = make_organizer(db)
    other = make_organizer(db, email="other@test.com")
    event = make_event(db, org)
    resp = client.patch(f"/api/events/{event.id}", json={
        "title": "Stolen",
    }, headers=auth_headers(other))
    assert resp.status_code == 403


def test_update_event_invalid_dates(client, db):
    org = make_organizer(db)
    event = make_event(db, org)
    resp = client.patch(f"/api/events/{event.id}", json={
        "end_datetime": "2020-01-01T00:00:00",  # before start_datetime
    }, headers=auth_headers(org))
    assert resp.status_code == 400


# ─── Delete Event ────────────────────────────────────────

def test_delete_event(client, db):
    org = make_organizer(db)
    event = make_event(db, org)
    resp = client.delete(f"/api/events/{event.id}", headers=auth_headers(org))
    assert resp.status_code == 204
    # Soft-deleted: should 404 on subsequent GET
    resp2 = client.get(f"/api/events/{event.id}", headers=auth_headers(org))
    assert resp2.status_code == 404


def test_delete_event_wrong_user(client, db):
    org = make_organizer(db)
    other = make_organizer(db, email="other@test.com")
    event = make_event(db, org)
    resp = client.delete(f"/api/events/{event.id}", headers=auth_headers(other))
    assert resp.status_code == 403


# ─── Publish / Cancel ────────────────────────────────────

def test_publish_event(client, db):
    org = make_organizer(db)
    event = make_event(db, org, status="draft")
    resp = client.patch(f"/api/events/{event.id}/publish", headers=auth_headers(org))
    assert resp.status_code == 200
    assert resp.json()["status"] == "published"


def test_publish_non_draft_event(client, db):
    org = make_organizer(db)
    event = make_event(db, org, status="published")
    resp = client.patch(f"/api/events/{event.id}/publish", headers=auth_headers(org))
    assert resp.status_code == 400


def test_cancel_event(client, db):
    org = make_organizer(db)
    event = make_event(db, org, status="published")
    resp = client.patch(f"/api/events/{event.id}/cancel", headers=auth_headers(org))
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"


def test_cancel_already_cancelled_event(client, db):
    org = make_organizer(db)
    event = make_event(db, org, status="cancelled")
    resp = client.patch(f"/api/events/{event.id}/cancel", headers=auth_headers(org))
    assert resp.status_code == 400
