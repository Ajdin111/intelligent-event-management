import pytest
from tests.conftest import make_user, make_organizer, auth_headers


# ─── Register ────────────────────────────────────────────

def test_register_success(client):
    resp = client.post("/api/auth/register", json={
        "email": "new@example.com",
        "password": "strongpass1",
        "first_name": "Alice",
        "last_name": "Smith",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["email"] == "new@example.com"
    assert data["first_name"] == "Alice"
    assert "id" in data


def test_register_duplicate_email(client):
    payload = {
        "email": "dup@example.com",
        "password": "pass123",
        "first_name": "Bob",
        "last_name": "Jones",
    }
    client.post("/api/auth/register", json=payload)
    resp = client.post("/api/auth/register", json=payload)
    assert resp.status_code == 400


def test_register_invalid_email(client):
    resp = client.post("/api/auth/register", json={
        "email": "not-an-email",
        "password": "pass123",
        "first_name": "Carl",
        "last_name": "Doe",
    })
    assert resp.status_code == 422


def test_register_missing_fields(client):
    resp = client.post("/api/auth/register", json={"email": "x@x.com"})
    assert resp.status_code == 422


# ─── Login ───────────────────────────────────────────────

def test_login_success(client, db):
    make_user(db, email="login@example.com", password="mypassword")
    resp = client.post("/api/auth/login", json={
        "email": "login@example.com",
        "password": "mypassword",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_wrong_password(client, db):
    make_user(db, email="wp@example.com", password="correct")
    resp = client.post("/api/auth/login", json={
        "email": "wp@example.com",
        "password": "wrong",
    })
    assert resp.status_code == 401


def test_login_nonexistent_user(client):
    resp = client.post("/api/auth/login", json={
        "email": "ghost@example.com",
        "password": "pass",
    })
    assert resp.status_code == 401


def test_login_inactive_user(client, db):
    from app.models.user import User
    user = make_user(db, email="inactive@example.com", password="pass")
    user.is_active = False
    db.commit()
    resp = client.post("/api/auth/login", json={
        "email": "inactive@example.com",
        "password": "pass",
    })
    assert resp.status_code == 403


# ─── /me ─────────────────────────────────────────────────

def test_get_me(client, db):
    user = make_user(db, email="me@example.com")
    resp = client.get("/api/auth/me", headers=auth_headers(user))
    assert resp.status_code == 200
    assert resp.json()["email"] == "me@example.com"


def test_get_me_no_token(client):
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401


def test_get_me_invalid_token(client):
    resp = client.get("/api/auth/me", headers={"Authorization": "Bearer invalidtoken"})
    assert resp.status_code == 401


# ─── Upgrade to organizer ─────────────────────────────────

def test_upgrade_to_organizer(client, db):
    user = make_user(db, email="upg@example.com")
    resp = client.post("/api/auth/upgrade-to-organizer", headers=auth_headers(user))
    assert resp.status_code == 200
    assert resp.json()["email"] == "upg@example.com"

    # verify they can now create events
    from app.models.user import UserRole
    role = db.query(UserRole).filter(
        UserRole.user_id == user.id,
        UserRole.role == "organizer",
    ).first()
    assert role is not None


def test_upgrade_to_organizer_already_organizer(client, db):
    org = make_organizer(db, email="already@example.com")
    resp = client.post("/api/auth/upgrade-to-organizer", headers=auth_headers(org))
    assert resp.status_code == 400
