import pytest
from datetime import datetime
from tests.conftest import (
    make_organizer, make_user, make_event, make_registration,
    make_ticket_tier, auth_headers,
)


EVENT_START = datetime(2025, 12, 1, 9, 0)
EVENT_END = datetime(2025, 12, 1, 17, 0)


def _published_event(db, org):
    return make_event(db, org, status="published", start=EVENT_START, end=EVENT_END)


# ─── Tracks ──────────────────────────────────────────────

def test_create_track(client, db):
    org = make_organizer(db)
    event = _published_event(db, org)
    resp = client.post(f"/api/events/{event.id}/tracks", json={
        "name": "Main Stage",
        "color": "#FF0000",
        "order_index": 1,
    }, headers=auth_headers(org))
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Main Stage"
    assert data["event_id"] == event.id
    assert data["session_count"] == 0


def test_create_track_duplicate_name(client, db):
    org = make_organizer(db)
    event = _published_event(db, org)
    payload = {"name": "Workshop A", "order_index": 0}
    client.post(f"/api/events/{event.id}/tracks", json=payload, headers=auth_headers(org))
    resp = client.post(f"/api/events/{event.id}/tracks", json=payload, headers=auth_headers(org))
    assert resp.status_code == 400


def test_create_track_wrong_user(client, db):
    org = make_organizer(db)
    other = make_organizer(db, email="other@test.com")
    event = _published_event(db, org)
    resp = client.post(f"/api/events/{event.id}/tracks", json={
        "name": "Stolen Track",
        "order_index": 0,
    }, headers=auth_headers(other))
    assert resp.status_code == 403


def test_list_tracks(client, db):
    org = make_organizer(db)
    event = _published_event(db, org)
    client.post(f"/api/events/{event.id}/tracks", json={"name": "Track A", "order_index": 0}, headers=auth_headers(org))
    client.post(f"/api/events/{event.id}/tracks", json={"name": "Track B", "order_index": 1}, headers=auth_headers(org))
    resp = client.get(f"/api/events/{event.id}/tracks")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


def test_update_track(client, db):
    org = make_organizer(db)
    event = _published_event(db, org)
    create_resp = client.post(f"/api/events/{event.id}/tracks", json={
        "name": "Old Name", "order_index": 0,
    }, headers=auth_headers(org))
    track_id = create_resp.json()["id"]
    resp = client.patch(f"/api/tracks/{track_id}", json={
        "name": "New Name",
        "color": "#00FF00",
    }, headers=auth_headers(org))
    assert resp.status_code == 200
    assert resp.json()["name"] == "New Name"


def test_delete_track_soft(client, db):
    org = make_organizer(db)
    event = _published_event(db, org)
    create_resp = client.post(f"/api/events/{event.id}/tracks", json={
        "name": "To Delete", "order_index": 0,
    }, headers=auth_headers(org))
    track_id = create_resp.json()["id"]

    del_resp = client.delete(f"/api/tracks/{track_id}", headers=auth_headers(org))
    assert del_resp.status_code == 204

    # Soft delete: track no longer in list
    list_resp = client.get(f"/api/events/{event.id}/tracks")
    names = [t["name"] for t in list_resp.json()]
    assert "To Delete" not in names


# ─── Sessions ────────────────────────────────────────────

def _make_track(client, event_id, org, name="Main"):
    resp = client.post(f"/api/events/{event_id}/tracks", json={
        "name": name, "order_index": 0,
    }, headers=auth_headers(org))
    return resp.json()["id"]


def test_create_session(client, db):
    org = make_organizer(db)
    event = _published_event(db, org)
    track_id = _make_track(client, event.id, org)
    resp = client.post(f"/api/tracks/{track_id}/sessions", json={
        "title": "Keynote",
        "start_datetime": "2025-12-01T10:00:00",
        "end_datetime": "2025-12-01T11:00:00",
        "requires_registration": False,
    }, headers=auth_headers(org))
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Keynote"
    assert data["track_id"] == track_id
    assert data["event_id"] == event.id


def test_create_session_end_before_start(client, db):
    org = make_organizer(db)
    event = _published_event(db, org)
    track_id = _make_track(client, event.id, org)
    resp = client.post(f"/api/tracks/{track_id}/sessions", json={
        "title": "Bad Times",
        "start_datetime": "2025-12-01T12:00:00",
        "end_datetime": "2025-12-01T10:00:00",
    }, headers=auth_headers(org))
    assert resp.status_code == 400


def test_create_session_outside_event_times(client, db):
    org = make_organizer(db)
    event = _published_event(db, org)
    track_id = _make_track(client, event.id, org)
    resp = client.post(f"/api/tracks/{track_id}/sessions", json={
        "title": "Too Early",
        "start_datetime": "2025-11-30T10:00:00",  # before event start
        "end_datetime": "2025-11-30T11:00:00",
    }, headers=auth_headers(org))
    assert resp.status_code == 400


def test_create_session_with_speaker(client, db):
    org = make_organizer(db)
    event = _published_event(db, org)
    track_id = _make_track(client, event.id, org)
    resp = client.post(f"/api/tracks/{track_id}/sessions", json={
        "title": "Talk",
        "speaker_name": "Dr. Smith",
        "speaker_bio": "Expert in everything",
        "start_datetime": "2025-12-01T10:00:00",
        "end_datetime": "2025-12-01T11:00:00",
    }, headers=auth_headers(org))
    assert resp.status_code == 201
    data = resp.json()
    assert data["speaker_name"] == "Dr. Smith"


def test_session_conflict_detection(client, db):
    org = make_organizer(db)
    event = _published_event(db, org)
    track_id = _make_track(client, event.id, org)
    # First session
    client.post(f"/api/tracks/{track_id}/sessions", json={
        "title": "Session A",
        "start_datetime": "2025-12-01T10:00:00",
        "end_datetime": "2025-12-01T11:30:00",
    }, headers=auth_headers(org))
    # Overlapping session
    resp = client.post(f"/api/tracks/{track_id}/sessions", json={
        "title": "Session B",
        "start_datetime": "2025-12-01T11:00:00",  # overlaps with Session A
        "end_datetime": "2025-12-01T12:00:00",
    }, headers=auth_headers(org))
    assert resp.status_code == 201
    assert resp.json()["has_conflict"] is True


def test_list_sessions_by_event(client, db):
    org = make_organizer(db)
    event = _published_event(db, org)
    track_id = _make_track(client, event.id, org)
    client.post(f"/api/tracks/{track_id}/sessions", json={
        "title": "Session 1",
        "start_datetime": "2025-12-01T10:00:00",
        "end_datetime": "2025-12-01T11:00:00",
    }, headers=auth_headers(org))
    resp = client.get(f"/api/events/{event.id}/sessions")
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_list_sessions_by_track(client, db):
    org = make_organizer(db)
    event = _published_event(db, org)
    track_id = _make_track(client, event.id, org)
    client.post(f"/api/tracks/{track_id}/sessions", json={
        "title": "Session X",
        "start_datetime": "2025-12-01T10:00:00",
        "end_datetime": "2025-12-01T11:00:00",
    }, headers=auth_headers(org))
    resp = client.get(f"/api/tracks/{track_id}/sessions")
    assert resp.status_code == 200
    assert resp.json()[0]["title"] == "Session X"


def test_update_session(client, db):
    org = make_organizer(db)
    event = _published_event(db, org)
    track_id = _make_track(client, event.id, org)
    create_resp = client.post(f"/api/tracks/{track_id}/sessions", json={
        "title": "Original",
        "start_datetime": "2025-12-01T10:00:00",
        "end_datetime": "2025-12-01T11:00:00",
    }, headers=auth_headers(org))
    session_id = create_resp.json()["id"]
    resp = client.patch(f"/api/sessions/{session_id}", json={
        "title": "Updated Session",
    }, headers=auth_headers(org))
    assert resp.status_code == 200
    assert resp.json()["title"] == "Updated Session"


def test_delete_session_soft(client, db):
    org = make_organizer(db)
    event = _published_event(db, org)
    track_id = _make_track(client, event.id, org)
    create_resp = client.post(f"/api/tracks/{track_id}/sessions", json={
        "title": "Ephemeral",
        "start_datetime": "2025-12-01T10:00:00",
        "end_datetime": "2025-12-01T11:00:00",
    }, headers=auth_headers(org))
    session_id = create_resp.json()["id"]
    del_resp = client.delete(f"/api/sessions/{session_id}", headers=auth_headers(org))
    assert del_resp.status_code == 204
    # Should not appear in subsequent listing
    list_resp = client.get(f"/api/events/{event.id}/sessions")
    assert all(s["id"] != session_id for s in list_resp.json())


# ─── Session Registration ─────────────────────────────────

def test_register_for_session_requires_event_registration(client, db):
    org = make_organizer(db)
    attendee = make_user(db, email="attendee@test.com")
    event = _published_event(db, org)
    track_id = _make_track(client, event.id, org)
    create_resp = client.post(f"/api/tracks/{track_id}/sessions", json={
        "title": "Workshop",
        "start_datetime": "2025-12-01T10:00:00",
        "end_datetime": "2025-12-01T11:00:00",
        "requires_registration": True,
    }, headers=auth_headers(org))
    session_id = create_resp.json()["id"]
    # Attendee has no event registration → should fail
    resp = client.post(f"/api/sessions/{session_id}/register", headers=auth_headers(attendee))
    assert resp.status_code == 400


def test_register_for_session_success(client, db):
    org = make_organizer(db)
    attendee = make_user(db, email="attendee@test.com")
    event = _published_event(db, org)
    # Give attendee a confirmed event registration
    make_registration(db, attendee, event, status="confirmed")
    track_id = _make_track(client, event.id, org)
    create_resp = client.post(f"/api/tracks/{track_id}/sessions", json={
        "title": "Workshop",
        "start_datetime": "2025-12-01T10:00:00",
        "end_datetime": "2025-12-01T11:00:00",
        "requires_registration": True,
    }, headers=auth_headers(org))
    session_id = create_resp.json()["id"]
    resp = client.post(f"/api/sessions/{session_id}/register", headers=auth_headers(attendee))
    assert resp.status_code == 201
    assert resp.json()["session_id"] == session_id


def test_register_for_session_no_registration_required(client, db):
    org = make_organizer(db)
    attendee = make_user(db, email="attendee@test.com")
    event = _published_event(db, org)
    track_id = _make_track(client, event.id, org)
    create_resp = client.post(f"/api/tracks/{track_id}/sessions", json={
        "title": "Open Talk",
        "start_datetime": "2025-12-01T10:00:00",
        "end_datetime": "2025-12-01T11:00:00",
        "requires_registration": False,
    }, headers=auth_headers(org))
    session_id = create_resp.json()["id"]
    resp = client.post(f"/api/sessions/{session_id}/register", headers=auth_headers(attendee))
    assert resp.status_code == 400  # session doesn't require registration


def test_cancel_session_registration(client, db):
    org = make_organizer(db)
    attendee = make_user(db, email="attendee@test.com")
    event = _published_event(db, org)
    make_registration(db, attendee, event, status="confirmed")
    track_id = _make_track(client, event.id, org)
    create_resp = client.post(f"/api/tracks/{track_id}/sessions", json={
        "title": "Cancellable",
        "start_datetime": "2025-12-01T10:00:00",
        "end_datetime": "2025-12-01T11:00:00",
        "requires_registration": True,
    }, headers=auth_headers(org))
    session_id = create_resp.json()["id"]
    client.post(f"/api/sessions/{session_id}/register", headers=auth_headers(attendee))
    cancel_resp = client.delete(f"/api/sessions/{session_id}/register", headers=auth_headers(attendee))
    assert cancel_resp.status_code == 204
