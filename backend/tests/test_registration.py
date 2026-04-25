import pytest
from decimal import Decimal
from datetime import datetime
from tests.conftest import (
    make_organizer, make_user, make_event, make_ticket_tier,
    make_promo_code, make_registration, auth_headers,
)


def _pub_event(db, org, **kwargs):
    return make_event(db, org, status="published", **kwargs)


# ─── Create Registration ─────────────────────────────────

def test_create_registration_automatic(client, db):
    org = make_organizer(db)
    attendee = make_user(db, email="attendee@test.com")
    event = _pub_event(db, org, registration_type="automatic")
    resp = client.post("/api/registrations", json={
        "event_id": event.id,
    }, headers=auth_headers(attendee))
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "confirmed"
    assert data["event_id"] == event.id
    assert data["user_id"] == attendee.id


def test_create_registration_manual(client, db):
    org = make_organizer(db)
    attendee = make_user(db, email="attendee@test.com")
    event = _pub_event(db, org, registration_type="manual")
    resp = client.post("/api/registrations", json={
        "event_id": event.id,
    }, headers=auth_headers(attendee))
    assert resp.status_code == 201
    assert resp.json()["status"] == "pending"


def test_create_registration_draft_event(client, db):
    org = make_organizer(db)
    attendee = make_user(db, email="attendee@test.com")
    event = make_event(db, org, status="draft")
    resp = client.post("/api/registrations", json={
        "event_id": event.id,
    }, headers=auth_headers(attendee))
    assert resp.status_code == 400


def test_create_registration_duplicate(client, db):
    org = make_organizer(db)
    attendee = make_user(db, email="attendee@test.com")
    event = _pub_event(db, org)
    client.post("/api/registrations", json={"event_id": event.id}, headers=auth_headers(attendee))
    resp = client.post("/api/registrations", json={"event_id": event.id}, headers=auth_headers(attendee))
    assert resp.status_code == 400


def test_create_registration_with_ticket_tier(client, db):
    org = make_organizer(db)
    attendee = make_user(db, email="attendee@test.com")
    event = _pub_event(db, org)
    tier = make_ticket_tier(db, event, price=Decimal("25.00"), quantity=50)
    resp = client.post("/api/registrations", json={
        "event_id": event.id,
        "ticket_tier_id": tier.id,
    }, headers=auth_headers(attendee))
    assert resp.status_code == 201
    data = resp.json()
    assert float(data["total_amount"]) == 25.00
    assert data["ticket_tier_id"] == tier.id


def test_create_registration_with_percentage_promo(client, db):
    org = make_organizer(db)
    attendee = make_user(db, email="attendee@test.com")
    event = _pub_event(db, org)
    tier = make_ticket_tier(db, event, price=Decimal("100.00"))
    make_promo_code(db, event, code="PCT20", discount_type="percentage", discount_value=Decimal("20.00"))
    resp = client.post("/api/registrations", json={
        "event_id": event.id,
        "ticket_tier_id": tier.id,
        "promo_code": "PCT20",
    }, headers=auth_headers(attendee))
    assert resp.status_code == 201
    assert float(resp.json()["total_amount"]) == 80.00  # 20% off 100


def test_create_registration_with_fixed_promo(client, db):
    org = make_organizer(db)
    attendee = make_user(db, email="attendee@test.com")
    event = _pub_event(db, org)
    tier = make_ticket_tier(db, event, price=Decimal("50.00"))
    make_promo_code(db, event, code="FLAT10", discount_type="fixed", discount_value=Decimal("10.00"))
    resp = client.post("/api/registrations", json={
        "event_id": event.id,
        "ticket_tier_id": tier.id,
        "promo_code": "FLAT10",
    }, headers=auth_headers(attendee))
    assert resp.status_code == 201
    assert float(resp.json()["total_amount"]) == 40.00  # $10 off $50


def test_create_registration_promo_increments_uses(client, db):
    org = make_organizer(db)
    attendee = make_user(db, email="attendee@test.com")
    event = _pub_event(db, org)
    tier = make_ticket_tier(db, event, price=Decimal("50.00"))
    promo = make_promo_code(db, event, code="TRACKME", discount_type="fixed", discount_value=Decimal("5.00"))
    assert promo.uses_count == 0
    client.post("/api/registrations", json={
        "event_id": event.id,
        "ticket_tier_id": tier.id,
        "promo_code": "TRACKME",
    }, headers=auth_headers(attendee))
    db.refresh(promo)
    assert promo.uses_count == 1


def test_create_registration_invalid_promo(client, db):
    org = make_organizer(db)
    attendee = make_user(db, email="attendee@test.com")
    event = _pub_event(db, org)
    tier = make_ticket_tier(db, event, price=Decimal("50.00"))
    resp = client.post("/api/registrations", json={
        "event_id": event.id,
        "ticket_tier_id": tier.id,
        "promo_code": "BADCODE",
    }, headers=auth_headers(attendee))
    assert resp.status_code == 400


def test_registration_full_event_goes_to_waitlist(client, db):
    org = make_organizer(db)
    first = make_user(db, email="first@test.com")
    second = make_user(db, email="second@test.com")
    event = _pub_event(db, org, capacity=1)
    # Fill the event
    client.post("/api/registrations", json={"event_id": event.id}, headers=auth_headers(first))
    # Second user should go to waitlist
    resp = client.post("/api/registrations", json={"event_id": event.id}, headers=auth_headers(second))
    assert resp.status_code == 200
    data = resp.json()
    assert "position" in data
    assert data["status"] == "waiting"


def test_registration_creates_ticket_on_confirm(client, db):
    org = make_organizer(db)
    attendee = make_user(db, email="attendee@test.com")
    event = _pub_event(db, org, registration_type="automatic")
    resp = client.post("/api/registrations", json={
        "event_id": event.id,
    }, headers=auth_headers(attendee))
    assert resp.status_code == 201
    reg_id = resp.json()["id"]
    # Check tickets were created
    tickets_resp = client.get(f"/api/registrations/{reg_id}/tickets", headers=auth_headers(attendee))
    assert tickets_resp.status_code == 200
    assert len(tickets_resp.json()) == 1


# ─── Get Registrations ────────────────────────────────────

def test_get_my_registrations(client, db):
    org = make_organizer(db)
    attendee = make_user(db, email="attendee@test.com")
    event = _pub_event(db, org)
    make_registration(db, attendee, event)
    resp = client.get("/api/registrations/me", headers=auth_headers(attendee))
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_get_registration_by_id(client, db):
    org = make_organizer(db)
    attendee = make_user(db, email="attendee@test.com")
    event = _pub_event(db, org)
    reg = make_registration(db, attendee, event)
    resp = client.get(f"/api/registrations/{reg.id}", headers=auth_headers(attendee))
    assert resp.status_code == 200
    assert resp.json()["id"] == reg.id


def test_get_registration_by_id_wrong_user(client, db):
    org = make_organizer(db)
    attendee = make_user(db, email="a@test.com")
    other = make_user(db, email="b@test.com")
    event = _pub_event(db, org)
    reg = make_registration(db, attendee, event)
    resp = client.get(f"/api/registrations/{reg.id}", headers=auth_headers(other))
    assert resp.status_code == 403


def test_get_registration_not_found(client, db):
    user = make_user(db)
    resp = client.get("/api/registrations/9999", headers=auth_headers(user))
    assert resp.status_code == 404


# ─── Cancel Registration ─────────────────────────────────

def test_cancel_registration(client, db):
    org = make_organizer(db)
    attendee = make_user(db, email="attendee@test.com")
    event = _pub_event(db, org)
    reg = make_registration(db, attendee, event)
    resp = client.request("DELETE", f"/api/registrations/{reg.id}", json={
        "cancellation_reason": "Can't make it",
    }, headers=auth_headers(attendee))
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "cancelled"
    assert data["cancellation_reason"] == "Can't make it"


def test_cancel_already_cancelled_registration(client, db):
    org = make_organizer(db)
    attendee = make_user(db, email="attendee@test.com")
    event = _pub_event(db, org)
    reg = make_registration(db, attendee, event, status="cancelled")
    resp = client.request("DELETE", f"/api/registrations/{reg.id}", json={}, headers=auth_headers(attendee))
    assert resp.status_code == 400


def test_cancel_registration_invalidates_tickets(client, db):
    from app.models.ticket import Ticket
    org = make_organizer(db)
    attendee = make_user(db, email="attendee@test.com")
    event = _pub_event(db, org)
    reg = make_registration(db, attendee, event, status="confirmed")
    client.request("DELETE", f"/api/registrations/{reg.id}", json={}, headers=auth_headers(attendee))
    # All tickets should be invalid
    tickets = db.query(Ticket).filter(Ticket.registration_id == reg.id).all()
    assert all(not t.is_valid for t in tickets)


# ─── Approve / Reject ────────────────────────────────────

def test_approve_registration(client, db):
    org = make_organizer(db)
    attendee = make_user(db, email="attendee@test.com")
    event = _pub_event(db, org, registration_type="manual")
    reg = make_registration(db, attendee, event, status="pending")
    resp = client.patch(f"/api/registrations/{reg.id}/approve", headers=auth_headers(org))
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "confirmed"
    assert data["approved_by"] == org.id


def test_approve_non_pending_registration(client, db):
    org = make_organizer(db)
    attendee = make_user(db, email="attendee@test.com")
    event = _pub_event(db, org)
    reg = make_registration(db, attendee, event, status="confirmed")
    resp = client.patch(f"/api/registrations/{reg.id}/approve", headers=auth_headers(org))
    assert resp.status_code == 400


def test_reject_registration(client, db):
    org = make_organizer(db)
    attendee = make_user(db, email="attendee@test.com")
    event = _pub_event(db, org, registration_type="manual")
    reg = make_registration(db, attendee, event, status="pending")
    resp = client.patch(f"/api/registrations/{reg.id}/reject", json={
        "cancellation_reason": "Sorry, full.",
    }, headers=auth_headers(org))
    assert resp.status_code == 200
    assert resp.json()["status"] == "rejected"


def test_reject_non_pending_registration(client, db):
    org = make_organizer(db)
    attendee = make_user(db, email="attendee@test.com")
    event = _pub_event(db, org)
    reg = make_registration(db, attendee, event, status="confirmed")
    resp = client.patch(f"/api/registrations/{reg.id}/reject", json={}, headers=auth_headers(org))
    assert resp.status_code == 400


def test_approve_wrong_organizer(client, db):
    org = make_organizer(db)
    other_org = make_organizer(db, email="other@test.com")
    attendee = make_user(db, email="attendee@test.com")
    event = _pub_event(db, org, registration_type="manual")
    reg = make_registration(db, attendee, event, status="pending")
    resp = client.patch(f"/api/registrations/{reg.id}/approve", headers=auth_headers(other_org))
    assert resp.status_code == 403


# ─── Event Registrations (Organizer) ─────────────────────

def test_get_event_registrations(client, db):
    org = make_organizer(db)
    a1 = make_user(db, email="a1@test.com")
    a2 = make_user(db, email="a2@test.com")
    event = _pub_event(db, org)
    make_registration(db, a1, event)
    make_registration(db, a2, event)
    resp = client.get(f"/api/events/{event.id}/registrations", headers=auth_headers(org))
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    assert len(data["items"]) == 2


def test_get_event_registrations_paginated(client, db):
    org = make_organizer(db)
    event = _pub_event(db, org)
    for i in range(5):
        u = make_user(db, email=f"user{i}@test.com")
        make_registration(db, u, event)
    resp = client.get(f"/api/events/{event.id}/registrations?skip=0&limit=2", headers=auth_headers(org))
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 5
    assert len(data["items"]) == 2


def test_get_event_registrations_non_owner(client, db):
    org = make_organizer(db)
    other = make_user(db, email="other@test.com")
    event = _pub_event(db, org)
    resp = client.get(f"/api/events/{event.id}/registrations", headers=auth_headers(other))
    assert resp.status_code == 403


# ─── Registration Tickets ────────────────────────────────

def test_get_registration_tickets(client, db):
    org = make_organizer(db)
    attendee = make_user(db, email="attendee@test.com")
    event = _pub_event(db, org)
    reg = make_registration(db, attendee, event, status="confirmed")
    resp = client.get(f"/api/registrations/{reg.id}/tickets", headers=auth_headers(attendee))
    assert resp.status_code == 200
    tickets = resp.json()
    assert len(tickets) == 1
    assert tickets[0]["is_valid"] is True
    assert "qr_code" in tickets[0]


def test_get_registration_tickets_wrong_user(client, db):
    org = make_organizer(db)
    attendee = make_user(db, email="a@test.com")
    other = make_user(db, email="b@test.com")
    event = _pub_event(db, org)
    reg = make_registration(db, attendee, event, status="confirmed")
    resp = client.get(f"/api/registrations/{reg.id}/tickets", headers=auth_headers(other))
    assert resp.status_code == 403
