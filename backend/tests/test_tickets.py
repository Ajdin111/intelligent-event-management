import pytest
from decimal import Decimal
from datetime import datetime
from tests.conftest import (
    make_organizer, make_user, make_event, make_ticket_tier,
    make_promo_code, make_registration, auth_headers,
)


# ─── Ticket Tiers ────────────────────────────────────────

def test_create_ticket_tier(client, db):
    org = make_organizer(db)
    event = make_event(db, org)
    resp = client.post(f"/api/events/{event.id}/ticket-tiers", json={
        "name": "VIP",
        "price": "50.00",
        "quantity": 100,
        "sale_start": "2024-01-01T00:00:00",
        "sale_end": "2026-12-31T23:59:59",
        "is_active": True,
    }, headers=auth_headers(org))
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "VIP"
    assert float(data["price"]) == 50.00
    assert data["quantity"] == 100
    assert data["quantity_sold"] == 0
    assert data["quantity_available"] == 100
    assert data["is_sold_out"] is False


def test_create_ticket_tier_negative_price(client, db):
    org = make_organizer(db)
    event = make_event(db, org)
    resp = client.post(f"/api/events/{event.id}/ticket-tiers", json={
        "name": "Invalid",
        "price": "-5.00",
        "quantity": 100,
        "sale_start": "2024-01-01T00:00:00",
        "sale_end": "2026-12-31T23:59:59",
    }, headers=auth_headers(org))
    assert resp.status_code == 400


def test_create_ticket_tier_zero_quantity(client, db):
    org = make_organizer(db)
    event = make_event(db, org)
    resp = client.post(f"/api/events/{event.id}/ticket-tiers", json={
        "name": "Zero",
        "price": "10.00",
        "quantity": 0,
        "sale_start": "2024-01-01T00:00:00",
        "sale_end": "2026-12-31T23:59:59",
    }, headers=auth_headers(org))
    assert resp.status_code == 400


def test_create_ticket_tier_end_before_start(client, db):
    org = make_organizer(db)
    event = make_event(db, org)
    resp = client.post(f"/api/events/{event.id}/ticket-tiers", json={
        "name": "Bad Dates",
        "price": "10.00",
        "quantity": 50,
        "sale_start": "2026-12-31T00:00:00",
        "sale_end": "2024-01-01T00:00:00",
    }, headers=auth_headers(org))
    assert resp.status_code == 400


def test_create_ticket_tier_wrong_user(client, db):
    org = make_organizer(db)
    other = make_organizer(db, email="other@test.com")
    event = make_event(db, org)
    resp = client.post(f"/api/events/{event.id}/ticket-tiers", json={
        "name": "Stolen",
        "price": "10.00",
        "quantity": 50,
        "sale_start": "2024-01-01T00:00:00",
        "sale_end": "2026-12-31T23:59:59",
    }, headers=auth_headers(other))
    assert resp.status_code == 403


def test_list_ticket_tiers(client, db):
    org = make_organizer(db)
    event = make_event(db, org)
    make_ticket_tier(db, event, name="Early Bird", price=Decimal("20.00"))
    make_ticket_tier(db, event, name="Regular", price=Decimal("40.00"))
    resp = client.get(f"/api/events/{event.id}/ticket-tiers")
    assert resp.status_code == 200
    names = [t["name"] for t in resp.json()]
    assert "Early Bird" in names
    assert "Regular" in names


def test_update_ticket_tier(client, db):
    org = make_organizer(db)
    event = make_event(db, org)
    tier = make_ticket_tier(db, event)
    resp = client.patch(f"/api/ticket-tiers/{tier.id}", json={
        "name": "Premium",
        "price": "99.00",
    }, headers=auth_headers(org))
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Premium"
    assert float(data["price"]) == 99.00


def test_update_ticket_tier_quantity_below_sold(client, db):
    org = make_organizer(db)
    event = make_event(db, org)
    tier = make_ticket_tier(db, event, quantity=100, quantity_sold=50)
    resp = client.patch(f"/api/ticket-tiers/{tier.id}", json={
        "quantity": 30,  # below quantity_sold=50
    }, headers=auth_headers(org))
    assert resp.status_code == 400


def test_delete_ticket_tier(client, db):
    org = make_organizer(db)
    event = make_event(db, org)
    tier = make_ticket_tier(db, event)
    resp = client.delete(f"/api/ticket-tiers/{tier.id}", headers=auth_headers(org))
    assert resp.status_code == 204


def test_delete_ticket_tier_with_sold_tickets(client, db):
    org = make_organizer(db)
    event = make_event(db, org)
    tier = make_ticket_tier(db, event, quantity_sold=5)
    resp = client.delete(f"/api/ticket-tiers/{tier.id}", headers=auth_headers(org))
    assert resp.status_code == 400


# ─── Promo Codes ─────────────────────────────────────────

def test_create_promo_code_percentage(client, db):
    org = make_organizer(db)
    event = make_event(db, org)
    resp = client.post(f"/api/events/{event.id}/promo-codes", json={
        "code": "SAVE20",
        "discount_type": "percentage",
        "discount_value": "20.00",
        "max_uses": 100,
        "valid_from": "2024-01-01T00:00:00",
        "valid_until": "2026-12-31T23:59:59",
        "is_active": True,
    }, headers=auth_headers(org))
    assert resp.status_code == 201
    data = resp.json()
    assert data["code"] == "SAVE20"
    assert data["discount_type"] == "percentage"
    assert float(data["discount_value"]) == 20.00
    assert data["is_valid"] is True


def test_create_promo_code_fixed(client, db):
    org = make_organizer(db)
    event = make_event(db, org)
    resp = client.post(f"/api/events/{event.id}/promo-codes", json={
        "code": "FLAT5",
        "discount_type": "fixed",
        "discount_value": "5.00",
        "max_uses": 50,
        "valid_from": "2024-01-01T00:00:00",
        "valid_until": "2026-12-31T23:59:59",
    }, headers=auth_headers(org))
    assert resp.status_code == 201
    assert resp.json()["discount_type"] == "fixed"


def test_create_promo_code_duplicate(client, db):
    org = make_organizer(db)
    event = make_event(db, org)
    payload = {
        "code": "DUPE",
        "discount_type": "percentage",
        "discount_value": "10.00",
        "max_uses": 10,
        "valid_from": "2024-01-01T00:00:00",
        "valid_until": "2026-12-31T23:59:59",
    }
    client.post(f"/api/events/{event.id}/promo-codes", json=payload, headers=auth_headers(org))
    resp = client.post(f"/api/events/{event.id}/promo-codes", json=payload, headers=auth_headers(org))
    assert resp.status_code == 400


def test_create_promo_code_invalid_percentage(client, db):
    org = make_organizer(db)
    event = make_event(db, org)
    resp = client.post(f"/api/events/{event.id}/promo-codes", json={
        "code": "TOOMUCH",
        "discount_type": "percentage",
        "discount_value": "150.00",  # > 100%
        "max_uses": 10,
        "valid_from": "2024-01-01T00:00:00",
        "valid_until": "2026-12-31T23:59:59",
    }, headers=auth_headers(org))
    assert resp.status_code == 400


def test_list_promo_codes(client, db):
    org = make_organizer(db)
    event = make_event(db, org)
    make_promo_code(db, event, code="CODE1")
    make_promo_code(db, event, code="CODE2")
    resp = client.get(f"/api/events/{event.id}/promo-codes", headers=auth_headers(org))
    assert resp.status_code == 200
    assert len(resp.json()) == 2


def test_delete_promo_code(client, db):
    org = make_organizer(db)
    event = make_event(db, org)
    promo = make_promo_code(db, event, code="TODELETE")
    resp = client.delete(f"/api/promo-codes/{promo.id}", headers=auth_headers(org))
    assert resp.status_code == 204


def test_update_promo_code(client, db):
    org = make_organizer(db)
    event = make_event(db, org)
    promo = make_promo_code(db, event, code="UPDATEME", max_uses=10)
    resp = client.patch(f"/api/promo-codes/{promo.id}", json={
        "max_uses": 200,
    }, headers=auth_headers(org))
    assert resp.status_code == 200
    assert resp.json()["max_uses"] == 200


# ─── Promo Code Validation ───────────────────────────────

def test_validate_promo_percentage(client, db):
    org = make_organizer(db)
    event = make_event(db, org)
    tier = make_ticket_tier(db, event, price=Decimal("100.00"))
    make_promo_code(db, event, code="PCT10", discount_type="percentage", discount_value=Decimal("10.00"))
    resp = client.post(f"/api/events/{event.id}/promo-codes/validate", json={
        "code": "PCT10",
        "ticket_tier_id": tier.id,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_valid"] is True
    assert float(data["final_price"]) == 90.00  # 10% off 100


def test_validate_promo_fixed(client, db):
    org = make_organizer(db)
    event = make_event(db, org)
    tier = make_ticket_tier(db, event, price=Decimal("50.00"))
    make_promo_code(db, event, code="FIXED5", discount_type="fixed", discount_value=Decimal("5.00"))
    resp = client.post(f"/api/events/{event.id}/promo-codes/validate", json={
        "code": "FIXED5",
        "ticket_tier_id": tier.id,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_valid"] is True
    assert float(data["final_price"]) == 45.00


def test_validate_promo_nonexistent(client, db):
    org = make_organizer(db)
    event = make_event(db, org)
    tier = make_ticket_tier(db, event)
    resp = client.post(f"/api/events/{event.id}/promo-codes/validate", json={
        "code": "NOSUCHCODE",
        "ticket_tier_id": tier.id,
    })
    assert resp.status_code == 200
    assert resp.json()["is_valid"] is False


def test_validate_promo_expired(client, db):
    org = make_organizer(db)
    event = make_event(db, org)
    tier = make_ticket_tier(db, event, price=Decimal("50.00"))
    make_promo_code(
        db, event, code="EXPIRED",
        valid_from=datetime(2020, 1, 1),
        valid_until=datetime(2021, 1, 1),  # in the past
    )
    resp = client.post(f"/api/events/{event.id}/promo-codes/validate", json={
        "code": "EXPIRED",
        "ticket_tier_id": tier.id,
    })
    assert resp.status_code == 200
    assert resp.json()["is_valid"] is False


def test_validate_promo_max_uses_reached(client, db):
    org = make_organizer(db)
    event = make_event(db, org)
    tier = make_ticket_tier(db, event, price=Decimal("50.00"))
    make_promo_code(db, event, code="MAXED", max_uses=5, uses_count=5)
    resp = client.post(f"/api/events/{event.id}/promo-codes/validate", json={
        "code": "MAXED",
        "ticket_tier_id": tier.id,
    })
    assert resp.status_code == 200
    assert resp.json()["is_valid"] is False
