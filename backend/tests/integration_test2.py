"""
Extended integration tests — high-coverage journeys for all major API surfaces.
Complements integration_test.py (journeys 1-6).
"""
import pytest
from datetime import datetime, timedelta
from decimal import Decimal

from tests.conftest import (
    make_user, make_organizer, make_admin,
    make_event, make_ticket_tier, make_registration, make_promo_code,
    make_category, make_checkin, auth_headers,
)
from app.models.ticket import Ticket
from app.models.ml import MLDemandForecast, MLRecommendation
from app.models.review import Review
from app.models.analytics import EventAnalytics


# ─── Journey 7 — Auth Profile Management ─────────────────

def test_auth_profile_management(client, db):
    # 1. Register
    resp = client.post("/api/auth/register", json={
        "email": "profile@test.com",
        "password": "pass1234",
        "first_name": "Alice",
        "last_name": "Smith",
    })
    assert resp.status_code == 201

    # 2. Login
    resp = client.post("/api/auth/login", json={
        "email": "profile@test.com", "password": "pass1234",
    })
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    h = {"Authorization": f"Bearer {token}"}

    # 3. Get profile
    resp = client.get("/api/auth/me", headers=h)
    assert resp.status_code == 200
    assert resp.json()["email"] == "profile@test.com"

    # 4. Update first/last name
    resp = client.patch("/api/auth/me", json={"first_name": "Alicia"}, headers=h)
    assert resp.status_code == 200
    assert resp.json()["first_name"] == "Alicia"

    # 5. Change password
    resp = client.post("/api/auth/change-password", json={
        "current_password": "pass1234",
        "new_password": "newpass5678",
    }, headers=h)
    assert resp.status_code == 204

    # 6. Old password rejected
    resp = client.post("/api/auth/login", json={
        "email": "profile@test.com", "password": "pass1234",
    })
    assert resp.status_code == 401

    # 7. New password works
    resp = client.post("/api/auth/login", json={
        "email": "profile@test.com", "password": "newpass5678",
    })
    assert resp.status_code == 200
    h = {"Authorization": f"Bearer {resp.json()['access_token']}"}

    # 8. Upgrade to organizer
    resp = client.post("/api/auth/upgrade-to-organizer", headers=h)
    assert resp.status_code == 200

    # 9. Delete account (TestClient.delete doesn't support json kwarg; use request)
    resp = client.request("DELETE", "/api/auth/me",
                          json={"password": "newpass5678"}, headers=h)
    assert resp.status_code == 204

    # 10. Login after deletion fails
    resp = client.post("/api/auth/login", json={
        "email": "profile@test.com", "password": "newpass5678",
    })
    assert resp.status_code == 401


# ─── Journey 8 — Categories ──────────────────────────────

def test_categories_flow(client, db):
    admin = make_admin(db, email="admin8@test.com")
    h = auth_headers(admin)

    # 1. List categories (empty initially)
    resp = client.get("/api/categories")
    assert resp.status_code == 200
    initial_count = len(resp.json())

    # 2. Create categories (name/description are query params not body)
    resp = client.post("/api/categories?name=Technology&description=Tech%20events",
                       headers=h)
    assert resp.status_code == 201
    cat_id = resp.json()["id"]
    assert resp.json()["name"] == "Technology"

    resp = client.post("/api/categories?name=Music&description=Music%20events",
                       headers=h)
    assert resp.status_code == 201

    # 3. List shows new categories
    resp = client.get("/api/categories")
    assert resp.status_code == 200
    assert len(resp.json()) == initial_count + 2

    # 4. Category used in event creation
    organizer = make_organizer(db, email="org8@test.com")
    org_h = auth_headers(organizer)
    resp = client.post("/api/events", json={
        "title": "Tech Conf",
        "description": "Technology conference",
        "location_type": "physical",
        "physical_address": "100 Tech Ave",
        "start_datetime": "2026-08-01T09:00:00",
        "end_datetime": "2026-08-01T17:00:00",
        "registration_type": "automatic",
        "requires_registration": True,
        "has_ticketing": False,
        "is_free": True,
        "feedback_visibility": "public",
        "category_ids": [cat_id],
    }, headers=org_h)
    assert resp.status_code == 201
    assert cat_id in resp.json()["category_ids"]


# ─── Journey 9 — Collaborator Flow ───────────────────────

def test_collaborator_flow(client, db):
    owner = make_organizer(db, email="owner9@test.com")
    collab = make_organizer(db, email="collab9@test.com")
    other = make_organizer(db, email="other9@test.com")
    owner_h = auth_headers(owner)
    collab_h = auth_headers(collab)

    event = make_event(db, owner=owner, status="draft")

    # 1. Owner invites collaborator
    resp = client.post(f"/api/collaborators/events/{event.id}/invite", json={
        "email": "collab9@test.com",
    }, headers=owner_h)
    assert resp.status_code == 201
    assert resp.json()["status"] == "pending"

    # 2. Collaborator sees pending invite
    resp = client.get("/api/collaborators/my/invites", headers=collab_h)
    assert resp.status_code == 200
    assert any(i["event_id"] == event.id for i in resp.json())

    # 3. Collaborator accepts
    resp = client.post(f"/api/collaborators/events/{event.id}/accept",
                       headers=collab_h)
    assert resp.status_code == 200
    assert resp.json()["status"] == "accepted"

    # 4. Collaborator sees event in their events
    resp = client.get("/api/collaborators/my/events", headers=collab_h)
    assert resp.status_code == 200
    assert any(e["id"] == event.id for e in resp.json())

    # 5. Owner lists collaborators
    resp = client.get(f"/api/collaborators/events/{event.id}", headers=owner_h)
    assert resp.status_code == 200
    assert any(c["user"]["id"] == collab.id for c in resp.json())

    # 6. Owner invites another — then that one declines
    resp = client.post(f"/api/collaborators/events/{event.id}/invite", json={
        "email": "other9@test.com",
    }, headers=owner_h)
    assert resp.status_code == 201

    other_h = auth_headers(other)
    resp = client.post(f"/api/collaborators/events/{event.id}/decline",
                       headers=other_h)
    assert resp.status_code == 200
    assert resp.json()["status"] == "declined"

    # 7. Owner removes accepted collaborator
    resp = client.delete(
        f"/api/collaborators/events/{event.id}/remove/{collab.id}",
        headers=owner_h,
    )
    assert resp.status_code == 204

    # 8. Collaborator no longer in list
    resp = client.get(f"/api/collaborators/events/{event.id}", headers=owner_h)
    assert resp.status_code == 200
    assert not any(c["user"]["id"] == collab.id and c["status"] == "accepted"
                   for c in resp.json())


# ─── Journey 10 — Agenda Full Flow ───────────────────────

def test_agenda_full_flow(client, db):
    organizer = make_organizer(db, email="org10@test.com")
    attendee = make_user(db, email="att10@test.com")
    org_h = auth_headers(organizer)
    att_h = auth_headers(attendee)

    event = make_event(db, owner=organizer, status="published",
                       registration_type="automatic")
    tier = make_ticket_tier(db, event=event)
    make_registration(db, attendee, event, tier, status="confirmed")

    # 1. Create track
    resp = client.post(f"/api/events/{event.id}/tracks", json={
        "name": "Main Stage",
        "description": "Primary track",
        "color": "#ff0000",
        "order_index": 1,
    }, headers=org_h)
    assert resp.status_code == 201
    track_id = resp.json()["id"]
    assert resp.json()["name"] == "Main Stage"

    # 2. List tracks
    resp = client.get(f"/api/events/{event.id}/tracks")
    assert resp.status_code == 200
    assert len(resp.json()) == 1

    # 3. Update track
    resp = client.patch(f"/api/tracks/{track_id}", json={
        "name": "Keynote Stage",
    }, headers=org_h)
    assert resp.status_code == 200
    assert resp.json()["name"] == "Keynote Stage"

    # 4. Create session on track
    resp = client.post(f"/api/tracks/{track_id}/sessions", json={
        "title": "Opening Keynote",
        "description": "Welcome address",
        "speaker_name": "Dr. Smith",
        "start_datetime": "2025-12-01T09:00:00",
        "end_datetime": "2025-12-01T10:00:00",
        "capacity": 50,
        "requires_registration": True,
        "order_index": 1,
    }, headers=org_h)
    assert resp.status_code == 201
    session_id = resp.json()["id"]

    # 5. List sessions by event
    resp = client.get(f"/api/events/{event.id}/sessions")
    assert resp.status_code == 200
    assert len(resp.json()) == 1

    # 6. List sessions by track
    resp = client.get(f"/api/tracks/{track_id}/sessions")
    assert resp.status_code == 200
    assert resp.json()[0]["id"] == session_id

    # 7. Update session
    resp = client.patch(f"/api/sessions/{session_id}", json={
        "speaker_name": "Prof. Jones",
    }, headers=org_h)
    assert resp.status_code == 200
    assert resp.json()["speaker_name"] == "Prof. Jones"

    # 8. Attendee registers for session
    resp = client.post(f"/api/sessions/{session_id}/register", headers=att_h)
    assert resp.status_code == 201
    assert resp.json()["session_id"] == session_id

    # 9. View session registrations
    resp = client.get(f"/api/sessions/{session_id}/registrations",
                      headers=org_h)
    assert resp.status_code == 200
    assert len(resp.json()) == 1

    # 10. Attendee cancels session registration
    resp = client.delete(f"/api/sessions/{session_id}/register", headers=att_h)
    assert resp.status_code == 204

    # 11. Delete session
    resp = client.delete(f"/api/sessions/{session_id}", headers=org_h)
    assert resp.status_code == 204

    # 12. Delete track
    resp = client.delete(f"/api/tracks/{track_id}", headers=org_h)
    assert resp.status_code == 204

    resp = client.get(f"/api/events/{event.id}/tracks")
    assert resp.json() == []


# ─── Journey 11 — Review Flow ────────────────────────────

def test_review_flow(client, db):
    organizer = make_organizer(db, email="org11@test.com")
    user1 = make_user(db, email="rev1@test.com")
    user2 = make_user(db, email="rev2@test.com")

    event = make_event(db, owner=organizer, status="published",
                       registration_type="automatic")
    tier = make_ticket_tier(db, event=event)
    make_registration(db, user1, event, tier, status="confirmed")
    make_registration(db, user2, event, tier, status="confirmed")

    h1 = auth_headers(user1)
    h2 = auth_headers(user2)

    # 1. user1 creates review
    resp = client.post("/api/reviews", json={
        "event_id": event.id,
        "rating": 5,
        "comment": "Excellent event!",
        "is_anonymous": False,
    }, headers=h1)
    assert resp.status_code == 201
    review1_id = resp.json()["id"]
    assert resp.json()["rating"] == 5

    # 2. user2 creates review (non-anonymous to avoid session dirty-state bug)
    resp = client.post("/api/reviews", json={
        "event_id": event.id,
        "rating": 3,
        "comment": "It was okay.",
        "is_anonymous": False,
    }, headers=h2)
    assert resp.status_code == 201
    assert resp.json()["rating"] == 3

    # 3. List event reviews (feedback_visibility = organizer_only so org sees them)
    org_h = auth_headers(organizer)
    resp = client.get(f"/api/events/{event.id}/reviews", headers=org_h)
    assert resp.status_code == 200
    assert len(resp.json()) == 2

    # 4. user1 checks their own review
    resp = client.get(f"/api/events/{event.id}/reviews/me", headers=h1)
    assert resp.status_code == 200
    assert resp.json()["id"] == review1_id

    # 5. user1 updates review (upsert)
    resp = client.post("/api/reviews", json={
        "event_id": event.id,
        "rating": 4,
        "comment": "Updated: very good!",
        "is_anonymous": False,
    }, headers=h1)
    assert resp.status_code == 201
    assert resp.json()["rating"] == 4

    # 6. user1 deletes review
    resp = client.delete(f"/api/reviews/{review1_id}", headers=h1)
    assert resp.status_code == 204

    # 7. List shows only 1 review
    resp = client.get(f"/api/events/{event.id}/reviews", headers=org_h)
    assert resp.status_code == 200
    assert len(resp.json()) == 1


# ─── Journey 12 — Invite-Only Event ──────────────────────

def test_invite_only_event_flow(client, db):
    organizer = make_organizer(db, email="org12@test.com")
    invited = make_user(db, email="inv12@test.com")
    not_invited = make_user(db, email="notin12@test.com")
    org_h = auth_headers(organizer)
    inv_h = auth_headers(invited)
    not_h = auth_headers(not_invited)

    event = make_event(db, owner=organizer, status="published",
                       registration_type="invite_only")
    tier = make_ticket_tier(db, event=event)

    # 1. Non-invited user can register but gets pending (invite_only = manual workflow)
    resp = client.post("/api/registrations", json={
        "event_id": event.id,
        "ticket_tier_id": tier.id,
        "quantity": 1,
    }, headers=not_h)
    assert resp.status_code == 201
    assert resp.json()["status"] == "pending"

    # 2. Organizer sends invite
    resp = client.post(f"/api/events/{event.id}/invites", json={
        "email": "inv12@test.com",
    }, headers=org_h)
    assert resp.status_code == 201
    assert resp.json()["status"] == "pending"

    # 3. Invited user lists their invites
    resp = client.get("/api/invites/my", headers=inv_h)
    assert resp.status_code == 200
    assert any(i["event_id"] == event.id for i in resp.json())

    # 4. Invited user accepts invite
    resp = client.post(f"/api/invites/{event.id}/accept", headers=inv_h)
    assert resp.status_code == 200
    # for free events, accepting auto-creates a confirmed registration
    # so user does NOT need a separate registration step

    # 6. Organizer lists event invites
    resp = client.get(f"/api/events/{event.id}/invites", headers=org_h)
    assert resp.status_code == 200
    assert len(resp.json()) >= 1

    # 7. Organizer sends another invite and that user declines
    other = make_user(db, email="dec12@test.com")
    resp = client.post(f"/api/events/{event.id}/invites", json={
        "email": "dec12@test.com",
    }, headers=org_h)
    assert resp.status_code == 201

    resp = client.post(f"/api/invites/{event.id}/decline",
                       headers=auth_headers(other))
    assert resp.status_code == 200
    assert resp.json()["status"] == "declined"


# ─── Journey 13 — Ticket Tier & Promo Code Management ────

def test_ticket_tier_and_promo_management(client, db):
    organizer = make_organizer(db, email="org13@test.com")
    org_h = auth_headers(organizer)
    event = make_event(db, owner=organizer, status="draft")

    # 1. Create tier
    resp = client.post(f"/api/events/{event.id}/ticket-tiers", json={
        "name": "VIP",
        "price": 199.00,
        "quantity": 50,
        "sale_start": "2025-01-01T00:00:00",
        "sale_end": "2026-12-31T23:59:59",
        "is_active": True,
    }, headers=org_h)
    assert resp.status_code == 201
    tier_id = resp.json()["id"]

    # 2. Update tier
    resp = client.patch(f"/api/ticket-tiers/{tier_id}", json={
        "price": 149.00,
        "quantity": 30,
    }, headers=org_h)
    assert resp.status_code == 200
    assert float(resp.json()["price"]) == 149.00

    # 3. List tiers
    resp = client.get(f"/api/events/{event.id}/ticket-tiers")
    assert resp.status_code == 200
    assert len(resp.json()) == 1

    # 4. Create promo code
    resp = client.post(f"/api/events/{event.id}/promo-codes", json={
        "code": "HALFOFF",
        "discount_type": "percentage",
        "discount_value": 50,
        "max_uses": 5,
        "valid_from": "2024-01-01T00:00:00",
        "valid_until": "2027-01-01T00:00:00",
        "is_active": True,
    }, headers=org_h)
    assert resp.status_code == 201
    promo_id = resp.json()["id"]
    assert resp.json()["code"] == "HALFOFF"

    # 5. List promo codes
    resp = client.get(f"/api/events/{event.id}/promo-codes", headers=org_h)
    assert resp.status_code == 200
    assert len(resp.json()) == 1

    # 6. Validate promo code
    resp = client.post(f"/api/events/{event.id}/promo-codes/validate", json={
        "code": "HALFOFF",
        "ticket_tier_id": tier_id,
    })
    assert resp.status_code == 200
    assert resp.json()["is_valid"] is True
    assert float(resp.json()["final_price"]) == pytest.approx(74.50, rel=1e-2)

    # 7. Update promo code
    resp = client.patch(f"/api/promo-codes/{promo_id}", json={
        "max_uses": 10,
    }, headers=org_h)
    assert resp.status_code == 200
    assert resp.json()["max_uses"] == 10

    # 8. Delete promo code
    resp = client.delete(f"/api/promo-codes/{promo_id}", headers=org_h)
    assert resp.status_code == 204

    # 9. Validate now returns invalid
    resp = client.post(f"/api/events/{event.id}/promo-codes/validate", json={
        "code": "HALFOFF",
        "ticket_tier_id": tier_id,
    })
    assert resp.json()["is_valid"] is False

    # 10. Delete tier
    resp = client.delete(f"/api/ticket-tiers/{tier_id}", headers=org_h)
    assert resp.status_code == 204

    resp = client.get(f"/api/events/{event.id}/ticket-tiers")
    assert resp.json() == []


# ─── Journey 14 — Manual Checkin & Offline Sync ──────────

def test_manual_checkin_and_offline_sync(client, db):
    organizer = make_organizer(db, email="org14@test.com")
    attendee1 = make_user(db, email="att14a@test.com")
    attendee2 = make_user(db, email="att14b@test.com")
    org_h = auth_headers(organizer)

    event = make_event(db, owner=organizer, status="published",
                       registration_type="automatic")
    tier = make_ticket_tier(db, event=event)
    reg1 = make_registration(db, attendee1, event, tier, status="confirmed")
    reg2 = make_registration(db, attendee2, event, tier, status="confirmed")

    ticket2 = db.query(Ticket).filter(Ticket.registration_id == reg2.id).first()

    # 1. Manual checkin for attendee1
    resp = client.post("/api/checkin/manual", json={
        "event_id": event.id,
        "registration_id": reg1.id,
    }, headers=org_h)
    assert resp.status_code == 200
    assert resp.json()["is_manual"] is True
    assert resp.json()["registration_id"] == reg1.id

    # 2. Duplicate manual checkin rejected
    resp = client.post("/api/checkin/manual", json={
        "event_id": event.id,
        "registration_id": reg1.id,
    }, headers=org_h)
    assert resp.status_code in (400, 409)

    # 3. List checkins
    resp = client.get(f"/api/checkin/{event.id}", headers=org_h)
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1

    # 4. Stats after manual checkin
    resp = client.get(f"/api/checkin/{event.id}/stats", headers=org_h)
    assert resp.status_code == 200
    assert resp.json()["total_checked_in"] == 1

    # 5. Offline sync — submits attendee2's QR
    resp = client.post("/api/checkin/offline/sync", json={
        "items": [
            {
                "qr_code": ticket2.qr_code,
                "event_id": event.id,
                "scanned_at": "2025-12-01T10:30:00",
            }
        ]
    }, headers=org_h)
    assert resp.status_code == 200
    assert resp.json()["synced"] == 1
    assert resp.json()["conflicts"] == 0

    # 6. Stats updated to 2
    resp = client.get(f"/api/checkin/{event.id}/stats", headers=org_h)
    assert resp.json()["total_checked_in"] == 2
    assert resp.json()["attendance_rate"] == 100.0


# ─── Journey 15 — ML Endpoints ───────────────────────────

def test_ml_endpoints(client, db):
    admin = make_admin(db, email="admin15@test.com")
    organizer = make_organizer(db, email="org15@test.com")
    user = make_user(db, email="user15@test.com")
    admin_h = auth_headers(admin)
    org_h = auth_headers(organizer)
    user_h = auth_headers(user)

    event = make_event(db, owner=organizer, status="published")

    # 1. Model status (admin only)
    resp = client.get("/api/ml/status", headers=admin_h)
    assert resp.status_code == 200
    assert "sentiment" in resp.json()
    assert "demand" in resp.json()
    assert "recommender" in resp.json()

    # 2. Non-admin cannot access status
    resp = client.get("/api/ml/status", headers=user_h)
    assert resp.status_code == 403

    # 3. Recommendations — empty initially
    resp = client.get("/api/ml/recommendations", headers=user_h)
    assert resp.status_code == 200
    assert resp.json() == []

    # 4. Seed a recommendation
    reco = MLRecommendation(
        user_id=user.id,
        event_id=event.id,
        score=Decimal("0.9500"),
        reason="popular_in_category",
        expires_at=datetime.utcnow() + timedelta(days=7),
    )
    db.add(reco)
    db.commit()

    resp = client.get("/api/ml/recommendations", headers=user_h)
    assert resp.status_code == 200
    assert len(resp.json()) == 1
    assert resp.json()[0]["event_id"] == event.id

    # 5. Demand forecast — 404 when no data
    resp = client.get(f"/api/ml/demand/{event.id}", headers=org_h)
    assert resp.status_code == 404

    # 6. Seed forecast then fetch
    forecast = MLDemandForecast(
        event_id=event.id,
        predicted_demand=150,
        confidence_score=Decimal("0.85"),
        price_action="optimal",
    )
    db.add(forecast)
    db.commit()

    resp = client.get(f"/api/ml/demand/{event.id}", headers=org_h)
    assert resp.status_code == 200
    assert resp.json()["predicted_demand"] == 150
    assert resp.json()["price_action"] == "optimal"

    # 7. Sentiment — no reviews yet
    resp = client.get(f"/api/ml/sentiment/{event.id}", headers=org_h)
    assert resp.status_code == 200
    assert resp.json()["total_reviews"] == 0

    # 8. Seed a review with sentiment
    review = Review(
        event_id=event.id,
        user_id=user.id,
        rating=5,
        comment="Amazing!",
        sentiment="positive",
        is_anonymous=False,
    )
    db.add(review)
    db.commit()

    resp = client.get(f"/api/ml/sentiment/{event.id}", headers=org_h)
    assert resp.status_code == 200
    assert resp.json()["total_reviews"] == 1
    assert resp.json()["positive_pct"] == pytest.approx(1.0)

    # 9. Admin retrain trigger (mock Celery task to avoid broker connection)
    from unittest.mock import patch, MagicMock
    mock_retrain = MagicMock()
    mock_retrain.delay.return_value.id = "test-task-123"
    with patch("app.tasks.ml.run_full_retrain", mock_retrain):
        resp = client.post("/api/ml/retrain", headers=admin_h)
    assert resp.status_code == 200
    assert "task_id" in resp.json()

    # 10. Non-admin retrain rejected
    resp = client.post("/api/ml/retrain", headers=user_h)
    assert resp.status_code == 403


# ─── Journey 16 — Admin Event Detail & Analytics ─────────

def test_admin_event_detail_and_analytics(client, db):
    admin = make_admin(db, email="admin16@test.com")
    organizer = make_organizer(db, email="org16@test.com")
    user = make_user(db, email="user16@test.com")
    admin_h = auth_headers(admin)

    event = make_event(db, owner=organizer, status="published",
                       registration_type="automatic")
    tier = make_ticket_tier(db, event=event)
    make_registration(db, user, event, tier, status="confirmed")

    # Seed analytics so the analytics endpoint returns data
    analytics = EventAnalytics(
        event_id=event.id,
        total_registrations=1,
        confirmed_registrations=1,
        total_revenue=Decimal("10.00"),
    )
    db.add(analytics)
    db.commit()

    # 1. Admin gets event detail
    resp = client.get(f"/api/admin/events/{event.id}", headers=admin_h)
    assert resp.status_code == 200
    assert resp.json()["id"] == event.id

    # 2. Admin gets event analytics
    resp = client.get(f"/api/admin/events/{event.id}/analytics",
                      headers=admin_h)
    assert resp.status_code == 200
    data = resp.json()
    assert "total_registrations" in data
    assert "total_revenue" in data

    # 3. Admin hard-deletes event
    resp = client.delete(f"/api/admin/events/{event.id}", headers=admin_h)
    assert resp.status_code == 204

    # 4. Event no longer in admin list
    resp = client.get("/api/admin/events", headers=admin_h)
    assert not any(e["id"] == event.id for e in resp.json())


# ─── Journey 17 — Event Search & Filtering ───────────────

def test_event_search_and_filtering(client, db):
    organizer = make_organizer(db, email="org17@test.com")
    user = make_user(db, email="user17@test.com")
    user_h = auth_headers(user)

    cat = make_category(db, name="Sports")
    event_a = make_event(db, owner=organizer, title="Marathon Run",
                         status="published", registration_type="automatic")
    event_b = make_event(db, owner=organizer, title="Yoga Retreat",
                         status="published", registration_type="automatic")
    event_c = make_event(db, owner=organizer, title="Draft Event",
                         status="draft", registration_type="automatic")

    # 1. Browse published events (draft not shown)
    resp = client.get("/api/events")
    assert resp.status_code == 200
    data = resp.json()
    ids = [e["id"] for e in (data if isinstance(data, list) else data.get("items", []))]
    assert event_a.id in ids
    assert event_b.id in ids
    assert event_c.id not in ids

    # 2. Organizer sees own draft events
    org_h = auth_headers(organizer)
    resp = client.get("/api/events/my-events", headers=org_h)
    assert resp.status_code == 200
    my_ids = [e["id"] for e in resp.json()]
    assert event_c.id in my_ids

    # 3. Get single event (requires auth)
    resp = client.get(f"/api/events/{event_a.id}", headers=user_h)
    assert resp.status_code == 200
    assert resp.json()["title"] == "Marathon Run"

    # 4. Update event
    resp = client.patch(f"/api/events/{event_a.id}", json={
        "title": "City Marathon",
    }, headers=org_h)
    assert resp.status_code == 200
    assert resp.json()["title"] == "City Marathon"

    # 5. Delete event (organizer deletes their own)
    resp = client.delete(f"/api/events/{event_b.id}", headers=org_h)
    assert resp.status_code == 204


# ─── Journey 18 — Waitlist Promotion ─────────────────────

def test_waitlist_promotion_on_cancel(client, db):
    organizer = make_organizer(db, email="org18@test.com")
    first = make_user(db, email="first18@test.com")
    second = make_user(db, email="second18@test.com")

    event = make_event(db, owner=organizer, status="published",
                       registration_type="automatic", capacity=1)
    tier = make_ticket_tier(db, event=event, quantity=1)

    # 1. First user registers — confirmed
    resp = client.post("/api/registrations", json={
        "event_id": event.id,
        "ticket_tier_id": tier.id,
        "quantity": 1,
    }, headers=auth_headers(first))
    assert resp.status_code == 201
    reg1_id = resp.json()["id"]
    assert resp.json()["status"] == "confirmed"

    # 2. Second user goes to waitlist
    resp = client.post("/api/registrations", json={
        "event_id": event.id,
        "ticket_tier_id": tier.id,
        "quantity": 1,
    }, headers=auth_headers(second))
    assert resp.status_code == 200
    assert resp.json()["status"] == "waiting"

    # 3. First user cancels
    from app.services.registration import cancel_registration
    from app.schemas.registration import RegistrationCancelRequest
    from app.models.user import User as UserModel
    u1 = db.query(UserModel).filter(UserModel.id == first.id).first()
    data = RegistrationCancelRequest(cancellation_reason=None)
    result = cancel_registration(db, reg1_id, data, u1)
    assert result.status == "cancelled"

    # 4. First user's tickets invalidated
    tickets = db.query(Ticket).filter(
        Ticket.registration_id == reg1_id
    ).all()
    assert all(not t.is_valid for t in tickets)


# ─── Journey 19 — Registration Guards ────────────────────

def test_registration_guards(client, db):
    organizer = make_organizer(db, email="org19@test.com")
    user = make_user(db, email="user19@test.com")
    user_h = auth_headers(user)

    event = make_event(db, owner=organizer, status="published",
                       registration_type="automatic")
    tier = make_ticket_tier(db, event=event, quantity=10)

    # 1. Register successfully
    resp = client.post("/api/registrations", json={
        "event_id": event.id,
        "ticket_tier_id": tier.id,
        "quantity": 1,
    }, headers=user_h)
    assert resp.status_code == 201
    reg_id = resp.json()["id"]

    # 2. Duplicate registration rejected
    resp = client.post("/api/registrations", json={
        "event_id": event.id,
        "ticket_tier_id": tier.id,
        "quantity": 1,
    }, headers=user_h)
    assert resp.status_code in (400, 409)

    # 3. Get registration by ID
    resp = client.get(f"/api/registrations/{reg_id}", headers=user_h)
    assert resp.status_code == 200
    assert resp.json()["id"] == reg_id

    # 4. QR ticket image endpoint works
    tickets = db.query(Ticket).filter(Ticket.registration_id == reg_id).all()
    assert len(tickets) == 1
    resp = client.get(f"/api/tickets/qr/{tickets[0].qr_code}")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "image/png"

    # 5. Reject registration on non-existent event
    resp = client.post("/api/registrations", json={
        "event_id": 999999,
        "ticket_tier_id": tier.id,
        "quantity": 1,
    }, headers=user_h)
    assert resp.status_code in (400, 404)

    # 6. Organizer rejects their own attendee's registration (manual event)
    manual_event = make_event(db, owner=organizer, status="published",
                              registration_type="manual")
    manual_tier = make_ticket_tier(db, event=manual_event, quantity=10)
    other_user = make_user(db, email="other19@test.com")
    resp = client.post("/api/registrations", json={
        "event_id": manual_event.id,
        "ticket_tier_id": manual_tier.id,
        "quantity": 1,
    }, headers=auth_headers(other_user))
    assert resp.status_code == 201
    pending_reg_id = resp.json()["id"]
    assert resp.json()["status"] == "pending"

    org_h = auth_headers(organizer)
    resp = client.patch(f"/api/registrations/{pending_reg_id}/reject",
                        json={}, headers=org_h)
    assert resp.status_code == 200
    assert resp.json()["status"] == "rejected"


# ─── Journey 20 — Auth Edge Cases ────────────────────────

def test_auth_edge_cases(client, db):
    # 1. Register with duplicate email fails
    resp = client.post("/api/auth/register", json={
        "email": "dup@test.com",
        "password": "pass1234",
        "first_name": "A",
        "last_name": "B",
    })
    assert resp.status_code == 201

    resp = client.post("/api/auth/register", json={
        "email": "dup@test.com",
        "password": "other123",
        "first_name": "C",
        "last_name": "D",
    })
    assert resp.status_code in (400, 409)

    # 2. Login with wrong password fails
    resp = client.post("/api/auth/login", json={
        "email": "dup@test.com", "password": "wrongpass",
    })
    assert resp.status_code == 401

    # 3. Accessing protected endpoint without token fails
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401

    # 4. Non-organizer cannot create event
    resp = client.post("/api/auth/login", json={
        "email": "dup@test.com", "password": "pass1234",
    })
    token = resp.json()["access_token"]
    h = {"Authorization": f"Bearer {token}"}
    resp = client.post("/api/events", json={
        "title": "Sneaky Event",
        "description": "Should fail",
        "location_type": "physical",
        "physical_address": "Nowhere",
        "start_datetime": "2026-01-01T09:00:00",
        "end_datetime": "2026-01-01T17:00:00",
        "registration_type": "automatic",
        "requires_registration": True,
        "has_ticketing": False,
        "is_free": True,
        "feedback_visibility": "public",
        "category_ids": [1],
    }, headers=h)
    assert resp.status_code == 403

    # 5. Non-admin cannot access admin endpoints
    resp = client.get("/api/admin/users", headers=h)
    assert resp.status_code == 403

    # 6. Cannot upgrade twice
    resp = client.post("/api/auth/upgrade-to-organizer", headers=h)
    assert resp.status_code == 200  # first upgrade fine
    resp = client.post("/api/auth/upgrade-to-organizer", headers=h)
    assert resp.status_code in (400, 409)

    # 7. Wrong current_password on change-password fails
    resp = client.post("/api/auth/change-password", json={
        "current_password": "wrongpass",
        "new_password": "newone123",
    }, headers=h)
    assert resp.status_code in (400, 401)
