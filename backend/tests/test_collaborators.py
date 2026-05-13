import pytest
from unittest.mock import patch
from app.models.event import EventCollaborator
from tests.conftest import (
    make_organizer, make_user, make_event, auth_headers,
)


# ─── Helpers ──────────────────────────────────────────────

def make_collab_entry(db, event, user, status="pending"):
    entry = EventCollaborator(
        event_id=event.id,
        user_id=user.id,
        added_by=event.owner_id,
        status=status,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@pytest.fixture(autouse=True)
def mock_collab_email():
    with patch("app.tasks.email.send_collaborator_invite.delay"):
        yield


# ─── Invite ───────────────────────────────────────────────

def test_invite_organizer_succeeds(client, db):
    owner  = make_organizer(db, email="owner@test.com")
    target = make_organizer(db, email="target@test.com")
    event  = make_event(db, owner)

    resp = client.post(
        f"/api/collaborators/events/{event.id}/invite",
        json={"email": "target@test.com"},
        headers=auth_headers(owner),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["user_id"] == target.id
    assert data["event_id"] == event.id
    assert data["status"] == "pending"


def test_invite_non_organizer_fails(client, db):
    owner  = make_organizer(db, email="owner@test.com")
    target = make_user(db, email="attendee@test.com")
    event  = make_event(db, owner)

    resp = client.post(
        f"/api/collaborators/events/{event.id}/invite",
        json={"email": "attendee@test.com"},
        headers=auth_headers(owner),
    )
    assert resp.status_code == 400


def test_invite_nonexistent_email_fails(client, db):
    owner = make_organizer(db)
    event = make_event(db, owner)

    resp = client.post(
        f"/api/collaborators/events/{event.id}/invite",
        json={"email": "nobody@nowhere.com"},
        headers=auth_headers(owner),
    )
    assert resp.status_code == 404


def test_invite_yourself_fails(client, db):
    owner = make_organizer(db, email="owner@test.com")
    event = make_event(db, owner)

    resp = client.post(
        f"/api/collaborators/events/{event.id}/invite",
        json={"email": "owner@test.com"},
        headers=auth_headers(owner),
    )
    assert resp.status_code == 400


def test_invite_already_pending_fails(client, db):
    owner  = make_organizer(db, email="owner@test.com")
    target = make_organizer(db, email="target@test.com")
    event  = make_event(db, owner)
    make_collab_entry(db, event, target, status="pending")

    resp = client.post(
        f"/api/collaborators/events/{event.id}/invite",
        json={"email": "target@test.com"},
        headers=auth_headers(owner),
    )
    assert resp.status_code == 400


def test_invite_already_accepted_fails(client, db):
    owner  = make_organizer(db, email="owner@test.com")
    target = make_organizer(db, email="target@test.com")
    event  = make_event(db, owner)
    make_collab_entry(db, event, target, status="accepted")

    resp = client.post(
        f"/api/collaborators/events/{event.id}/invite",
        json={"email": "target@test.com"},
        headers=auth_headers(owner),
    )
    assert resp.status_code == 400


def test_reinvite_after_decline_resets_to_pending(client, db):
    owner  = make_organizer(db, email="owner@test.com")
    target = make_organizer(db, email="target@test.com")
    event  = make_event(db, owner)
    make_collab_entry(db, event, target, status="declined")

    resp = client.post(
        f"/api/collaborators/events/{event.id}/invite",
        json={"email": "target@test.com"},
        headers=auth_headers(owner),
    )
    assert resp.status_code == 201
    assert resp.json()["status"] == "pending"


def test_non_owner_cannot_invite(client, db):
    owner   = make_organizer(db, email="owner@test.com")
    other   = make_organizer(db, email="other@test.com")
    target  = make_organizer(db, email="target@test.com")
    event   = make_event(db, owner)

    resp = client.post(
        f"/api/collaborators/events/{event.id}/invite",
        json={"email": "target@test.com"},
        headers=auth_headers(other),
    )
    assert resp.status_code == 403


def test_invite_requires_auth(client, db):
    owner = make_organizer(db)
    event = make_event(db, owner)

    resp = client.post(
        f"/api/collaborators/events/{event.id}/invite",
        json={"email": "someone@test.com"},
    )
    assert resp.status_code == 401


# ─── Accept ───────────────────────────────────────────────

def test_accept_invite(client, db):
    owner  = make_organizer(db, email="owner@test.com")
    target = make_organizer(db, email="target@test.com")
    event  = make_event(db, owner)
    make_collab_entry(db, event, target, status="pending")

    resp = client.post(
        f"/api/collaborators/events/{event.id}/accept",
        headers=auth_headers(target),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "accepted"


def test_accept_already_accepted_fails(client, db):
    owner  = make_organizer(db, email="owner@test.com")
    target = make_organizer(db, email="target@test.com")
    event  = make_event(db, owner)
    make_collab_entry(db, event, target, status="accepted")

    resp = client.post(
        f"/api/collaborators/events/{event.id}/accept",
        headers=auth_headers(target),
    )
    assert resp.status_code == 400


def test_accept_declined_invite_fails(client, db):
    owner  = make_organizer(db, email="owner@test.com")
    target = make_organizer(db, email="target@test.com")
    event  = make_event(db, owner)
    make_collab_entry(db, event, target, status="declined")

    resp = client.post(
        f"/api/collaborators/events/{event.id}/accept",
        headers=auth_headers(target),
    )
    assert resp.status_code == 400


def test_accept_nonexistent_invite_fails(client, db):
    owner  = make_organizer(db, email="owner@test.com")
    target = make_organizer(db, email="target@test.com")
    event  = make_event(db, owner)

    resp = client.post(
        f"/api/collaborators/events/{event.id}/accept",
        headers=auth_headers(target),
    )
    assert resp.status_code == 404


# ─── Decline ──────────────────────────────────────────────

def test_decline_invite(client, db):
    owner  = make_organizer(db, email="owner@test.com")
    target = make_organizer(db, email="target@test.com")
    event  = make_event(db, owner)
    make_collab_entry(db, event, target, status="pending")

    resp = client.post(
        f"/api/collaborators/events/{event.id}/decline",
        headers=auth_headers(target),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "declined"


def test_decline_already_declined_fails(client, db):
    owner  = make_organizer(db, email="owner@test.com")
    target = make_organizer(db, email="target@test.com")
    event  = make_event(db, owner)
    make_collab_entry(db, event, target, status="declined")

    resp = client.post(
        f"/api/collaborators/events/{event.id}/decline",
        headers=auth_headers(target),
    )
    assert resp.status_code == 400


def test_decline_accepted_invite_fails(client, db):
    owner  = make_organizer(db, email="owner@test.com")
    target = make_organizer(db, email="target@test.com")
    event  = make_event(db, owner)
    make_collab_entry(db, event, target, status="accepted")

    resp = client.post(
        f"/api/collaborators/events/{event.id}/decline",
        headers=auth_headers(target),
    )
    assert resp.status_code == 400


# ─── List ─────────────────────────────────────────────────

def test_list_collaborators_as_owner(client, db):
    owner  = make_organizer(db, email="owner@test.com")
    target = make_organizer(db, email="target@test.com")
    event  = make_event(db, owner)
    make_collab_entry(db, event, target, status="pending")

    resp = client.get(
        f"/api/collaborators/events/{event.id}",
        headers=auth_headers(owner),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["user"]["email"] == "target@test.com"
    assert data[0]["status"] == "pending"


def test_list_collaborators_non_owner_forbidden(client, db):
    owner = make_organizer(db, email="owner@test.com")
    other = make_organizer(db, email="other@test.com")
    event = make_event(db, owner)

    resp = client.get(
        f"/api/collaborators/events/{event.id}",
        headers=auth_headers(other),
    )
    assert resp.status_code == 403


def test_list_collaborators_empty(client, db):
    owner = make_organizer(db)
    event = make_event(db, owner)

    resp = client.get(
        f"/api/collaborators/events/{event.id}",
        headers=auth_headers(owner),
    )
    assert resp.status_code == 200
    assert resp.json() == []


# ─── Remove ───────────────────────────────────────────────

def test_remove_collaborator(client, db):
    owner  = make_organizer(db, email="owner@test.com")
    target = make_organizer(db, email="target@test.com")
    event  = make_event(db, owner)
    make_collab_entry(db, event, target)

    resp = client.delete(
        f"/api/collaborators/events/{event.id}/remove/{target.id}",
        headers=auth_headers(owner),
    )
    assert resp.status_code == 204

    # confirm gone
    resp2 = client.get(
        f"/api/collaborators/events/{event.id}",
        headers=auth_headers(owner),
    )
    assert resp2.json() == []


def test_remove_nonexistent_collaborator_fails(client, db):
    owner  = make_organizer(db, email="owner@test.com")
    target = make_organizer(db, email="target@test.com")
    event  = make_event(db, owner)

    resp = client.delete(
        f"/api/collaborators/events/{event.id}/remove/{target.id}",
        headers=auth_headers(owner),
    )
    assert resp.status_code == 404


def test_non_owner_cannot_remove(client, db):
    owner  = make_organizer(db, email="owner@test.com")
    collab = make_organizer(db, email="collab@test.com")
    other  = make_organizer(db, email="other@test.com")
    event  = make_event(db, owner)
    make_collab_entry(db, event, collab, status="accepted")

    resp = client.delete(
        f"/api/collaborators/events/{event.id}/remove/{collab.id}",
        headers=auth_headers(other),
    )
    assert resp.status_code == 403


# ─── My Collaborating Events ──────────────────────────────

def test_accepted_collaborator_sees_event(client, db):
    owner  = make_organizer(db, email="owner@test.com")
    target = make_organizer(db, email="target@test.com")
    event  = make_event(db, owner, title="Collab Event")
    make_collab_entry(db, event, target, status="accepted")

    resp = client.get(
        "/api/collaborators/my/events",
        headers=auth_headers(target),
    )
    assert resp.status_code == 200
    ids = [e["id"] for e in resp.json()]
    assert event.id in ids


def test_pending_invite_not_in_collaborating_events(client, db):
    owner  = make_organizer(db, email="owner@test.com")
    target = make_organizer(db, email="target@test.com")
    event  = make_event(db, owner)
    make_collab_entry(db, event, target, status="pending")

    resp = client.get(
        "/api/collaborators/my/events",
        headers=auth_headers(target),
    )
    assert resp.status_code == 200
    assert resp.json() == []


def test_declined_invite_not_in_collaborating_events(client, db):
    owner  = make_organizer(db, email="owner@test.com")
    target = make_organizer(db, email="target@test.com")
    event  = make_event(db, owner)
    make_collab_entry(db, event, target, status="declined")

    resp = client.get(
        "/api/collaborators/my/events",
        headers=auth_headers(target),
    )
    assert resp.status_code == 200
    assert resp.json() == []


def test_collaborating_events_empty_for_new_user(client, db):
    target = make_organizer(db)

    resp = client.get(
        "/api/collaborators/my/events",
        headers=auth_headers(target),
    )
    assert resp.status_code == 200
    assert resp.json() == []
