import uuid
import pytest
from datetime import datetime
from tests.conftest import (
    make_organizer, make_user, make_event, make_ticket_tier,
    make_registration, make_checkin, auth_headers,
)
from app.models.ticket import Ticket


def _setup(db):
    """Returns (organizer, attendee, published_event, registration, ticket)."""
    org = make_organizer(db)
    attendee = make_user(db, email="attendee@test.com")
    event = make_event(db, org, status="published")
    reg = make_registration(db, attendee, event, status="confirmed")
    ticket = db.query(Ticket).filter(Ticket.registration_id == reg.id).first()
    return org, attendee, event, reg, ticket


# ─── Manual Check-In ─────────────────────────────────────

def test_manual_checkin(client, db):
    org, attendee, event, reg, ticket = _setup(db)
    resp = client.post("/api/checkin/manual", json={
        "event_id": event.id,
        "registration_id": reg.id,
    }, headers=auth_headers(org))
    assert resp.status_code == 200
    data = resp.json()
    assert data["event_id"] == event.id
    assert data["registration_id"] == reg.id
    assert data["is_manual"] is True
    assert data["checked_in_by"] == org.id


def test_manual_checkin_already_checked_in(client, db):
    org, attendee, event, reg, ticket = _setup(db)
    # First check-in
    client.post("/api/checkin/manual", json={
        "event_id": event.id,
        "registration_id": reg.id,
    }, headers=auth_headers(org))
    # Second check-in attempt
    resp = client.post("/api/checkin/manual", json={
        "event_id": event.id,
        "registration_id": reg.id,
    }, headers=auth_headers(org))
    assert resp.status_code == 400


def test_manual_checkin_not_confirmed_registration(client, db):
    org = make_organizer(db)
    attendee = make_user(db, email="attendee@test.com")
    event = make_event(db, org, status="published")
    reg = make_registration(db, attendee, event, status="pending")
    resp = client.post("/api/checkin/manual", json={
        "event_id": event.id,
        "registration_id": reg.id,
    }, headers=auth_headers(org))
    assert resp.status_code == 400


def test_manual_checkin_no_valid_ticket(client, db):
    org = make_organizer(db)
    attendee = make_user(db, email="attendee@test.com")
    event = make_event(db, org, status="published")
    # Create confirmed registration without ticket
    from app.models.registration import Registration
    from decimal import Decimal
    reg = Registration(
        event_id=event.id,
        user_id=attendee.id,
        quantity=1,
        total_amount=Decimal("0"),
        status="confirmed",
        registered_at=datetime.now(),
    )
    db.add(reg)
    db.commit()
    db.refresh(reg)
    resp = client.post("/api/checkin/manual", json={
        "event_id": event.id,
        "registration_id": reg.id,
    }, headers=auth_headers(org))
    assert resp.status_code == 400


def test_manual_checkin_non_organizer_forbidden(client, db):
    org = make_organizer(db)
    attendee = make_user(db, email="attendee@test.com")
    event = make_event(db, org, status="published")
    reg = make_registration(db, attendee, event, status="confirmed")
    # Attendee tries to check in someone else
    another = make_user(db, email="another@test.com")
    resp = client.post("/api/checkin/manual", json={
        "event_id": event.id,
        "registration_id": reg.id,
    }, headers=auth_headers(another))
    assert resp.status_code == 403


# ─── QR Check-In ─────────────────────────────────────────

def test_qr_checkin(client, db):
    org, attendee, event, reg, ticket = _setup(db)
    resp = client.post("/api/checkin/qr", json={
        "event_id": event.id,
        "qr_code": ticket.qr_code,
    }, headers=auth_headers(org))
    assert resp.status_code == 200
    data = resp.json()
    assert data["ticket_id"] == ticket.id
    assert data["is_manual"] is False


def test_qr_checkin_invalid_code(client, db):
    org, attendee, event, reg, ticket = _setup(db)
    resp = client.post("/api/checkin/qr", json={
        "event_id": event.id,
        "qr_code": "invalid-qr-code-123",
    }, headers=auth_headers(org))
    assert resp.status_code == 404


def test_qr_checkin_already_checked_in(client, db):
    org, attendee, event, reg, ticket = _setup(db)
    client.post("/api/checkin/qr", json={
        "event_id": event.id,
        "qr_code": ticket.qr_code,
    }, headers=auth_headers(org))
    resp = client.post("/api/checkin/qr", json={
        "event_id": event.id,
        "qr_code": ticket.qr_code,
    }, headers=auth_headers(org))
    assert resp.status_code == 400


def test_qr_checkin_invalid_ticket(client, db):
    org, attendee, event, reg, ticket = _setup(db)
    ticket.is_valid = False
    db.commit()
    resp = client.post("/api/checkin/qr", json={
        "event_id": event.id,
        "qr_code": ticket.qr_code,
    }, headers=auth_headers(org))
    assert resp.status_code == 400


# ─── List Check-ins ───────────────────────────────────────

def test_list_checkins(client, db):
    org, attendee, event, reg, ticket = _setup(db)
    make_checkin(db, reg, ticket, event, attendee, org)
    resp = client.get(f"/api/checkin/{event.id}", headers=auth_headers(org))
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert len(data["items"]) == 1


def test_list_checkins_pagination(client, db):
    org = make_organizer(db)
    event = make_event(db, org, status="published")
    for i in range(5):
        u = make_user(db, email=f"u{i}@test.com")
        reg = make_registration(db, u, event, status="confirmed")
        ticket = db.query(Ticket).filter(Ticket.registration_id == reg.id).first()
        make_checkin(db, reg, ticket, event, u, org)
    resp = client.get(f"/api/checkin/{event.id}?skip=0&limit=3", headers=auth_headers(org))
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 5
    assert len(data["items"]) == 3


def test_list_checkins_non_organizer(client, db):
    org = make_organizer(db)
    attendee = make_user(db, email="a@test.com")
    event = make_event(db, org, status="published")
    resp = client.get(f"/api/checkin/{event.id}", headers=auth_headers(attendee))
    assert resp.status_code == 403


# ─── Check-in Stats ───────────────────────────────────────

def test_checkin_stats(client, db):
    org, attendee, event, reg, ticket = _setup(db)
    # Before check-in
    resp = client.get(f"/api/checkin/{event.id}/stats", headers=auth_headers(org))
    assert resp.status_code == 200
    data = resp.json()
    assert data["event_id"] == event.id
    assert data["total_registered"] == 1
    assert data["total_checked_in"] == 0
    assert data["attendance_rate"] == 0.0
    assert data["remaining"] == 1


def test_checkin_stats_after_checkin(client, db):
    org, attendee, event, reg, ticket = _setup(db)
    make_checkin(db, reg, ticket, event, attendee, org)
    resp = client.get(f"/api/checkin/{event.id}/stats", headers=auth_headers(org))
    data = resp.json()
    assert data["total_checked_in"] == 1
    assert data["attendance_rate"] == 100.0
    assert data["remaining"] == 0


# ─── Offline Sync ─────────────────────────────────────────

def test_offline_sync_success(client, db):
    org, attendee, event, reg, ticket = _setup(db)
    resp = client.post("/api/checkin/offline/sync", json={
        "items": [{
            "qr_code": ticket.qr_code,
            "event_id": event.id,
            "scanned_at": "2025-12-01T10:30:00",
        }],
    }, headers=auth_headers(org))
    assert resp.status_code == 200
    data = resp.json()
    assert data["synced"] == 1
    assert data["conflicts"] == 0
    assert data["details"][0]["status"] == "synced"


def test_offline_sync_conflict_already_checked_in(client, db):
    org, attendee, event, reg, ticket = _setup(db)
    # Pre-check-in the ticket
    make_checkin(db, reg, ticket, event, attendee, org)
    resp = client.post("/api/checkin/offline/sync", json={
        "items": [{
            "qr_code": ticket.qr_code,
            "event_id": event.id,
            "scanned_at": "2025-12-01T10:30:00",
        }],
    }, headers=auth_headers(org))
    assert resp.status_code == 200
    data = resp.json()
    assert data["synced"] == 0
    assert data["conflicts"] == 1
    assert "Already checked in" in data["details"][0]["reason"]


def test_offline_sync_conflict_invalid_ticket(client, db):
    org, attendee, event, reg, ticket = _setup(db)
    ticket.is_valid = False
    db.commit()
    resp = client.post("/api/checkin/offline/sync", json={
        "items": [{
            "qr_code": ticket.qr_code,
            "event_id": event.id,
            "scanned_at": "2025-12-01T10:30:00",
        }],
    }, headers=auth_headers(org))
    assert resp.status_code == 200
    data = resp.json()
    assert data["synced"] == 0
    assert data["conflicts"] == 1


def test_offline_sync_unknown_qr(client, db):
    org = make_organizer(db)
    event = make_event(db, org, status="published")
    resp = client.post("/api/checkin/offline/sync", json={
        "items": [{
            "qr_code": "unknown-qr-code",
            "event_id": event.id,
            "scanned_at": "2025-12-01T10:30:00",
        }],
    }, headers=auth_headers(org))
    assert resp.status_code == 200
    # ticket not found means it goes to conflict tracking but NOT added to queue
    # The conflict is counted in details
    data = resp.json()
    assert data["details"][0]["status"] == "conflict"
