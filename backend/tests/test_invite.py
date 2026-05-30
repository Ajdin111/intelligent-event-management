import secrets
import pytest
from datetime import datetime, timedelta
from tests.conftest import make_user, make_organizer, make_event, auth_headers
from app.models.registration import Invite


def make_invite(db, event, invitee_email, inviter, status="pending", expires_days=7):
    invite = Invite(
        event_id=event.id,
        invited_by=inviter.id,
        email=invitee_email,
        token=secrets.token_urlsafe(32),
        status=status,
        expires_at=datetime.utcnow() + timedelta(days=expires_days),
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)
    return invite


# ─── POST /api/events/{event_id}/invites ─────────────────

def test_send_invite_success(client, db):
    organizer = make_organizer(db)
    invitee = make_user(db, email="invitee@test.com")
    event = make_event(db, owner=organizer, status="published")

    resp = client.post(
        f"/api/events/{event.id}/invites",
        json={"email": "invitee@test.com"},
        headers=auth_headers(organizer),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["email"] == "invitee@test.com"
    assert data["status"] == "pending"


def test_send_invite_not_owner_forbidden(client, db):
    organizer = make_organizer(db)
    other = make_user(db, email="other@test.com")
    make_user(db, email="invitee@test.com")
    event = make_event(db, owner=organizer, status="published")

    resp = client.post(
        f"/api/events/{event.id}/invites",
        json={"email": "invitee@test.com"},
        headers=auth_headers(other),
    )
    assert resp.status_code == 403


def test_send_invite_user_not_found(client, db):
    organizer = make_organizer(db)
    event = make_event(db, owner=organizer, status="published")

    resp = client.post(
        f"/api/events/{event.id}/invites",
        json={"email": "nobody@test.com"},
        headers=auth_headers(organizer),
    )
    assert resp.status_code == 404


def test_send_invite_self(client, db):
    organizer = make_organizer(db)
    event = make_event(db, owner=organizer, status="published")

    resp = client.post(
        f"/api/events/{event.id}/invites",
        json={"email": organizer.email},
        headers=auth_headers(organizer),
    )
    assert resp.status_code == 400


def test_send_invite_already_pending(client, db):
    organizer = make_organizer(db)
    invitee = make_user(db, email="invitee@test.com")
    event = make_event(db, owner=organizer, status="published")
    make_invite(db, event, invitee.email, organizer, status="pending")

    resp = client.post(
        f"/api/events/{event.id}/invites",
        json={"email": invitee.email},
        headers=auth_headers(organizer),
    )
    assert resp.status_code == 400


def test_send_invite_already_accepted(client, db):
    organizer = make_organizer(db)
    invitee = make_user(db, email="invitee@test.com")
    event = make_event(db, owner=organizer, status="published")
    make_invite(db, event, invitee.email, organizer, status="accepted")

    resp = client.post(
        f"/api/events/{event.id}/invites",
        json={"email": invitee.email},
        headers=auth_headers(organizer),
    )
    assert resp.status_code == 400


def test_send_invite_resend_after_declined(client, db):
    organizer = make_organizer(db)
    invitee = make_user(db, email="invitee@test.com")
    event = make_event(db, owner=organizer, status="published")
    make_invite(db, event, invitee.email, organizer, status="declined")

    resp = client.post(
        f"/api/events/{event.id}/invites",
        json={"email": invitee.email},
        headers=auth_headers(organizer),
    )
    assert resp.status_code == 201
    assert resp.json()["status"] == "pending"


def test_send_invite_unauthenticated(client, db):
    organizer = make_organizer(db)
    event = make_event(db, owner=organizer, status="published")

    resp = client.post(
        f"/api/events/{event.id}/invites",
        json={"email": "anyone@test.com"},
    )
    assert resp.status_code == 401


# ─── GET /api/events/{event_id}/invites ──────────────────

def test_list_event_invites_owner(client, db):
    organizer = make_organizer(db)
    invitee = make_user(db, email="invitee@test.com")
    event = make_event(db, owner=organizer, status="published")
    make_invite(db, event, invitee.email, organizer)

    resp = client.get(f"/api/events/{event.id}/invites", headers=auth_headers(organizer))
    assert resp.status_code == 200
    assert len(resp.json()) == 1
    assert resp.json()[0]["email"] == invitee.email


def test_list_event_invites_forbidden_non_owner(client, db):
    organizer = make_organizer(db)
    other = make_user(db, email="other@test.com")
    event = make_event(db, owner=organizer, status="published")

    resp = client.get(f"/api/events/{event.id}/invites", headers=auth_headers(other))
    assert resp.status_code == 403


# ─── GET /api/invites/my ─────────────────────────────────

def test_list_my_invites(client, db):
    organizer = make_organizer(db)
    invitee = make_user(db, email="invitee@test.com")
    event = make_event(db, owner=organizer, status="published")
    make_invite(db, event, invitee.email, organizer, status="pending")

    resp = client.get("/api/invites/my", headers=auth_headers(invitee))
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_list_my_invites_only_returns_pending(client, db):
    organizer = make_organizer(db)
    invitee = make_user(db, email="invitee@test.com")
    event1 = make_event(db, owner=organizer, title="Event 1", status="published")
    event2 = make_event(db, owner=organizer, title="Event 2", status="published")
    make_invite(db, event1, invitee.email, organizer, status="pending")
    make_invite(db, event2, invitee.email, organizer, status="accepted")

    resp = client.get("/api/invites/my", headers=auth_headers(invitee))
    assert resp.status_code == 200
    assert len(resp.json()) == 1


# ─── POST /api/invites/{event_id}/accept ─────────────────

def test_accept_invite_success_free_event(client, db):
    organizer = make_organizer(db)
    invitee = make_user(db, email="invitee@test.com")
    event = make_event(db, owner=organizer, status="published")
    make_invite(db, event, invitee.email, organizer)

    resp = client.post(f"/api/invites/{event.id}/accept", headers=auth_headers(invitee))
    assert resp.status_code == 200
    data = resp.json()
    assert data["invite"]["status"] == "accepted"
    assert data["requires_payment"] is False


def test_accept_invite_not_found(client, db):
    invitee = make_user(db, email="invitee@test.com")
    organizer = make_organizer(db)
    event = make_event(db, owner=organizer, status="published")

    resp = client.post(f"/api/invites/{event.id}/accept", headers=auth_headers(invitee))
    assert resp.status_code == 404


def test_accept_invite_already_accepted(client, db):
    organizer = make_organizer(db)
    invitee = make_user(db, email="invitee@test.com")
    event = make_event(db, owner=organizer, status="published")
    make_invite(db, event, invitee.email, organizer, status="accepted")

    resp = client.post(f"/api/invites/{event.id}/accept", headers=auth_headers(invitee))
    assert resp.status_code == 400


def test_accept_invite_already_declined(client, db):
    organizer = make_organizer(db)
    invitee = make_user(db, email="invitee@test.com")
    event = make_event(db, owner=organizer, status="published")
    make_invite(db, event, invitee.email, organizer, status="declined")

    resp = client.post(f"/api/invites/{event.id}/accept", headers=auth_headers(invitee))
    assert resp.status_code == 400


def test_accept_invite_expired(client, db):
    organizer = make_organizer(db)
    invitee = make_user(db, email="invitee@test.com")
    event = make_event(db, owner=organizer, status="published")
    make_invite(db, event, invitee.email, organizer, expires_days=-1)

    resp = client.post(f"/api/invites/{event.id}/accept", headers=auth_headers(invitee))
    assert resp.status_code == 400


# ─── POST /api/invites/{event_id}/decline ────────────────

def test_decline_invite_success(client, db):
    organizer = make_organizer(db)
    invitee = make_user(db, email="invitee@test.com")
    event = make_event(db, owner=organizer, status="published")
    make_invite(db, event, invitee.email, organizer)

    resp = client.post(f"/api/invites/{event.id}/decline", headers=auth_headers(invitee))
    assert resp.status_code == 200
    assert resp.json()["status"] == "declined"


def test_decline_invite_not_found(client, db):
    invitee = make_user(db, email="invitee@test.com")
    organizer = make_organizer(db)
    event = make_event(db, owner=organizer, status="published")

    resp = client.post(f"/api/invites/{event.id}/decline", headers=auth_headers(invitee))
    assert resp.status_code == 404


def test_decline_invite_not_pending(client, db):
    organizer = make_organizer(db)
    invitee = make_user(db, email="invitee@test.com")
    event = make_event(db, owner=organizer, status="published")
    make_invite(db, event, invitee.email, organizer, status="accepted")

    resp = client.post(f"/api/invites/{event.id}/decline", headers=auth_headers(invitee))
    assert resp.status_code == 400
