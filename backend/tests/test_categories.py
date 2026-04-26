import pytest
from tests.conftest import make_user, make_organizer, make_admin, make_category, auth_headers


def test_list_categories_empty(client):
    resp = client.get("/api/categories")
    assert resp.status_code == 200
    assert resp.json() == []


def test_list_categories(client, db):
    make_category(db, name="Music")
    make_category(db, name="Tech")
    resp = client.get("/api/categories")
    assert resp.status_code == 200
    names = [c["name"] for c in resp.json()]
    assert "Music" in names
    assert "Tech" in names


def test_list_categories_excludes_soft_deleted(client, db):
    from datetime import datetime
    cat = make_category(db, name="Deleted")
    cat.deleted_at = datetime.now()
    db.commit()
    resp = client.get("/api/categories")
    assert resp.status_code == 200
    names = [c["name"] for c in resp.json()]
    assert "Deleted" not in names


def test_create_category_as_admin(client, db):
    admin = make_admin(db)
    resp = client.post(
        "/api/categories?name=Science&description=Science+events",
        headers=auth_headers(admin),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Science"
    assert data["description"] == "Science events"


def test_create_category_as_non_admin(client, db):
    user = make_user(db)
    resp = client.post(
        "/api/categories?name=Nope",
        headers=auth_headers(user),
    )
    assert resp.status_code == 403


def test_create_category_no_auth(client):
    resp = client.post("/api/categories?name=Anon")
    assert resp.status_code == 401


def test_create_category_used_in_event(client, db):
    from tests.conftest import make_event
    admin = make_admin(db)
    org = make_organizer(db)
    # Create category via admin
    create_resp = client.post(
        "/api/categories?name=Arts",
        headers=auth_headers(admin),
    )
    assert create_resp.status_code == 201
    cat_id = create_resp.json()["id"]

    # Use it in an event
    event_resp = client.post("/api/events", json={
        "title": "Art Show",
        "description": "An arts event",
        "location_type": "physical",
        "physical_address": "Gallery",
        "start_datetime": "2025-12-01T09:00:00",
        "end_datetime": "2025-12-01T17:00:00",
        "category_ids": [cat_id],
    }, headers=auth_headers(org))
    assert event_resp.status_code == 201
    assert cat_id in event_resp.json()["category_ids"]
