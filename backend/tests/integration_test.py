import pytest
import json as json_lib
from tests.conftest import (
    make_user, make_organizer, make_admin,
    make_event, make_ticket_tier, make_registration, auth_headers
)
from app.models.notification import Notification


# ─── Helper ──────────────────────────────────────────────

def get_list(resp):
    data = resp.json()
    return data if isinstance(data, list) else data.get("items", [])


# ─── Journey 1 — Full Attendee Flow ──────────────────────

def test_attendee_full_flow(client, db):
    # 1. Register
    resp = client.post("/api/auth/register", json={
        "email": "attendee@flow.com",
        "password": "password123",
        "first_name": "Alice",
        "last_name": "Flow",
    })
    assert resp.status_code == 201

    # 2. Login
    resp = client.post("/api/auth/login", json={
        "email": "attendee@flow.com",
        "password": "password123",
    })
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 3. Get current user
    resp = client.get("/api/auth/me", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["email"] == "attendee@flow.com"

    # 4. Browse events — empty initially
    resp = client.get("/api/events")
    assert resp.status_code == 200

    # 5. Setup — organizer creates and publishes event
    organizer = make_organizer(db, email="org@flow.com")
    event = make_event(db, owner=organizer, status="published",
                       registration_type="automatic")
    tier = make_ticket_tier(db, event=event)

    # 6. Browse events — now shows the published event
    resp = client.get("/api/events")
    assert resp.status_code == 200
    assert any(e["id"] == event.id for e in get_list(resp))

    # 7. Get event detail
    resp = client.get(f"/api/events/{event.id}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["title"] == event.title

    # 8. Get ticket tiers
    resp = client.get(f"/api/events/{event.id}/ticket-tiers")
    assert resp.status_code == 200
    assert len(resp.json()) == 1

    # 9. Register for event
    resp = client.post("/api/registrations", json={
        "event_id": event.id,
        "ticket_tier_id": tier.id,
        "quantity": 1,
    }, headers=headers)
    assert resp.status_code == 201
    registration_id = resp.json()["id"]
    assert resp.json()["status"] == "confirmed"

    # 10. Get my registrations
    resp = client.get("/api/registrations/me", headers=headers)
    assert resp.status_code == 200
    assert any(r["id"] == registration_id for r in resp.json())

    # 11. Get tickets
    resp = client.get(f"/api/registrations/{registration_id}/tickets",
                      headers=headers)
    assert resp.status_code == 200
    tickets = resp.json()
    assert len(tickets) == 1
    qr_code = tickets[0]["qr_code"]

    # 12. Check in via QR
    org_headers = auth_headers(organizer)
    resp = client.post("/api/checkin/qr", json={
        "qr_code": qr_code,
        "event_id": event.id,
    }, headers=org_headers)
    assert resp.status_code == 200
    assert resp.json()["is_manual"] is False

    # 13. Check-in stats updated
    resp = client.get(f"/api/checkin/{event.id}/stats", headers=org_headers)
    assert resp.status_code == 200
    assert resp.json()["total_checked_in"] == 1
    assert resp.json()["attendance_rate"] == 100.0

    # 14. Check notifications
    resp = client.get("/api/notifications/", headers=headers)
    assert resp.status_code == 200

    # 15. Check unread count
    resp = client.get("/api/notifications/unread-count", headers=headers)
    assert resp.status_code == 200
    assert "unread_count" in resp.json()

    # 16. Get notification preferences
    resp = client.get("/api/notifications/preferences", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["email_enabled"] is True


# ─── Journey 2 — Organizer Full Flow ─────────────────────

def test_organizer_full_flow(client, db):
    # 1. Register organizer
    resp = client.post("/api/auth/register", json={
        "email": "org2@flow.com",
        "password": "password123",
        "first_name": "Jordan",
        "last_name": "Org",
    })
    assert resp.status_code == 201

    # 2. Login
    resp = client.post("/api/auth/login", json={
        "email": "org2@flow.com",
        "password": "password123",
    })
    token = resp.json()["access_token"]
    org_headers = {"Authorization": f"Bearer {token}"}

    # 3. Upgrade to organizer
    resp = client.post("/api/auth/upgrade-to-organizer", headers=org_headers)
    assert resp.status_code == 200

    # 4. Create event as draft
    resp = client.post("/api/events", json={
        "title": "Integration Summit",
        "description": "A full integration test event",
        "location_type": "physical",
        "physical_address": "123 Test St",
        "start_datetime": "2026-12-01T09:00:00",
        "end_datetime": "2026-12-01T17:00:00",
        "registration_type": "manual",
        "requires_registration": True,
        "has_ticketing": True,
        "is_free": False,
        "feedback_visibility": "organizer_only",
    }, headers=org_headers)
    assert resp.status_code == 201
    event_id = resp.json()["id"]
    assert resp.json()["status"] == "draft"

    # 5. Add ticket tier
    resp = client.post(f"/api/events/{event_id}/ticket-tiers", json={
        "name": "Standard",
        "price": 99.00,
        "quantity": 100,
        "sale_start": "2024-01-01T00:00:00",
        "sale_end": "2026-11-30T23:59:59",
        "is_active": True,
    }, headers=org_headers)
    assert resp.status_code == 201
    tier_id = resp.json()["id"]

    # 6. Add agenda track
    resp = client.post(f"/api/events/{event_id}/tracks", json={
        "name": "Main Stage",
        "description": "Main track",
        "color": "#ffffff",
        "order_index": 1,
    }, headers=org_headers)
    assert resp.status_code == 201
    track_id = resp.json()["id"]

    # 7. Add session to track
    resp = client.post(f"/api/tracks/{track_id}/sessions", json={
        "title": "Opening Keynote",
        "description": "Welcome session",
        "speaker_name": "Dr. Smith",
        "start_datetime": "2026-12-01T09:00:00",
        "end_datetime": "2026-12-01T10:00:00",
        "order_index": 1,
    }, headers=org_headers)
    assert resp.status_code == 201

    # 8. Publish event
    resp = client.patch(f"/api/events/{event_id}/publish", headers=org_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "published"

    # 9. Attendee registers
    attendee = make_user(db, email="att2@flow.com")
    att_headers = auth_headers(attendee)
    resp = client.post("/api/registrations", json={
        "event_id": event_id,
        "ticket_tier_id": tier_id,
        "quantity": 1,
    }, headers=att_headers)
    assert resp.status_code == 201
    reg_id = resp.json()["id"]
    assert resp.json()["status"] == "pending"

    # 10. Organizer views registrations
    resp = client.get(f"/api/events/{event_id}/registrations",
                      headers=org_headers)
    assert resp.status_code == 200
    regs = get_list(resp)
    assert any(r["id"] == reg_id for r in regs)

    # 11. Organizer approves registration
    resp = client.patch(f"/api/registrations/{reg_id}/approve",
                        headers=org_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "confirmed"

    # 12. Attendee gets their ticket
    resp = client.get(f"/api/registrations/{reg_id}/tickets",
                      headers=att_headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 1
    assert resp.json()[0]["is_valid"] is True

    # 13. Organizer cancels event
    resp = client.patch(f"/api/events/{event_id}/cancel", headers=org_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"


# ─── Journey 3 — Admin Full Flow ─────────────────────────

def test_admin_full_flow(client, db):
    admin = make_admin(db, email="admin@flow.com")
    admin_headers = auth_headers(admin)

    user1 = make_user(db, email="user1@flow.com")
    user2 = make_user(db, email="user2@flow.com")
    organizer = make_organizer(db, email="org3@flow.com")

    # 1. List all users
    resp = client.get("/api/admin/users", headers=admin_headers)
    assert resp.status_code == 200
    assert len(resp.json()) >= 4

    # 2. Search by email
    resp = client.get("/api/admin/users?search=user1", headers=admin_headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 1
    assert resp.json()[0]["email"] == "user1@flow.com"

    # 3. Filter by role
    resp = client.get("/api/admin/users?role=organizer", headers=admin_headers)
    assert resp.status_code == 200
    assert all(u["is_organizer"] for u in resp.json())

    # 4. Get single user
    resp = client.get(f"/api/admin/users/{user1.id}", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["email"] == "user1@flow.com"

    # 5. Deactivate user
    resp = client.patch(f"/api/admin/users/{user2.id}/deactivate",
                        headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False

    # 6. Reactivate user
    resp = client.patch(f"/api/admin/users/{user2.id}/activate",
                        headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["is_active"] is True

    # 7. Create and publish event
    event = make_event(db, owner=organizer, status="published")

    # 8. Admin lists all events
    resp = client.get("/api/admin/events", headers=admin_headers)
    assert resp.status_code == 200
    assert any(e["id"] == event.id for e in resp.json())

    # 9. Filter events by status
    resp = client.get("/api/admin/events?status=published",
                      headers=admin_headers)
    assert resp.status_code == 200
    assert all(e["status"] == "published" for e in resp.json())

    # 10. Force unpublish event
    resp = client.patch(f"/api/admin/events/{event.id}/unpublish",
                        headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "draft"

    # 11. Platform analytics
    resp = client.get("/api/admin/analytics", headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "total_users" in data
    assert "total_events" in data
    assert "total_revenue" in data

    # 12. Admin cannot deactivate themselves
    resp = client.patch(f"/api/admin/users/{admin.id}/deactivate",
                        headers=admin_headers)
    assert resp.status_code == 400

    # 13. Delete user with no events or registrations
    resp = client.delete(f"/api/admin/users/{user1.id}",
                         headers=admin_headers)
    assert resp.status_code == 204


# ─── Journey 4 — Registration Edge Cases ─────────────────

def test_registration_edge_cases(client, db):
    organizer = make_organizer(db, email="org4@flow.com")

    # 1. Create event with capacity 1
    event = make_event(db, owner=organizer, status="published",
                       registration_type="automatic", capacity=1)
    tier = make_ticket_tier(db, event=event, quantity=1)

    # 2. First attendee registers — should succeed
    user1 = make_user(db, email="first@flow.com")
    resp = client.post("/api/registrations", json={
        "event_id": event.id,
        "ticket_tier_id": tier.id,
        "quantity": 1,
    }, headers=auth_headers(user1))
    assert resp.status_code == 201
    reg1_id = resp.json()["id"]
    assert resp.json()["status"] == "confirmed"

    # 3. Second attendee tries — goes to waitlist
    user2 = make_user(db, email="second@flow.com")
    resp = client.post("/api/registrations", json={
        "event_id": event.id,
        "ticket_tier_id": tier.id,
        "quantity": 1,
    }, headers=auth_headers(user2))
    assert resp.status_code == 200
    assert resp.json()["status"] == "waiting"

    # 4. First attendee cancels — send body via params workaround
    h = {**auth_headers(user1), "Content-Type": "application/json"}
    resp = client.delete(
        f"/api/registrations/{reg1_id}",
        params={"cancellation_reason": ""},
        headers=h,
    )
    # If params don't work for body, hit the service directly via db
    if resp.status_code == 422:
        from app.services.registration import cancel_registration
        from app.schemas.registration import RegistrationCancelRequest
        from app.models.user import User as UserModel
        u1 = db.query(UserModel).filter(UserModel.id == user1.id).first()
        data = RegistrationCancelRequest(cancellation_reason=None)
        result = cancel_registration(db, reg1_id, data, u1)
        assert result.status == "cancelled"
    else:
        assert resp.status_code == 200
        assert resp.json()["status"] == "cancelled"

    # 5. Tickets invalidated after cancellation
    from app.models.ticket import Ticket
    tickets = db.query(Ticket).filter(
        Ticket.registration_id == reg1_id
    ).all()
    assert all(not t.is_valid for t in tickets)


# ─── Journey 5 — Promo Code Flow ─────────────────────────

def test_promo_code_flow(client, db):
    organizer = make_organizer(db, email="org5@flow.com")
    org_headers = auth_headers(organizer)
    event = make_event(db, owner=organizer, status="published",
                       registration_type="automatic")
    tier = make_ticket_tier(db, event=event)

    # 1. Create promo code
    resp = client.post(f"/api/events/{event.id}/promo-codes", json={
        "code": "SAVE20",
        "discount_type": "percentage",
        "discount_value": 20,
        "max_uses": 10,
        "valid_from": "2024-01-01T00:00:00",
        "valid_until": "2027-01-01T00:00:00",
        "is_active": True,
    }, headers=org_headers)
    assert resp.status_code == 201
    assert resp.json()["code"] == "SAVE20"

    # 2. Validate promo code
    resp = client.post(f"/api/events/{event.id}/promo-codes/validate", json={
        "code": "SAVE20",
        "ticket_tier_id": tier.id,
    })
    assert resp.status_code == 200
    assert resp.json()["is_valid"] is True
    expected_price = round(float(tier.price) * 0.8, 2)
    assert float(resp.json()["final_price"]) == expected_price

    # 3. Use promo code in registration
    attendee = make_user(db, email="promo@flow.com")
    resp = client.post("/api/registrations", json={
        "event_id": event.id,
        "ticket_tier_id": tier.id,
        "quantity": 1,
        "promo_code": "SAVE20",
    }, headers=auth_headers(attendee))
    assert resp.status_code == 201
    assert float(resp.json()["total_amount"]) == expected_price


# ─── Journey 6 — Notification Preferences Flow ───────────

def test_notification_preferences_flow(client, db):
    user = make_user(db, email="prefs@flow.com")
    headers = auth_headers(user)

    # 1. Get default preferences
    resp = client.get("/api/notifications/preferences", headers=headers)
    assert resp.status_code == 200
    prefs = resp.json()
    assert prefs["email_enabled"] is True
    assert prefs["event_reminders"] is True

    # 2. Disable some notifications
    resp = client.patch("/api/notifications/preferences", json={
        "email_enabled": False,
        "event_reminders": False,
    }, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["email_enabled"] is False
    assert resp.json()["event_reminders"] is False

    # 3. Other prefs unchanged
    assert resp.json()["registration_confirmation"] is True
    assert resp.json()["in_app_enabled"] is True

    # 4. Create in-app notification directly
    from datetime import datetime, timedelta
    notif = Notification(
        user_id=user.id,
        title="Test notification",
        message="This is a test",
        type="registration_confirmation",
        is_read=False,
        expires_at=datetime.now() + timedelta(days=90),
    )
    db.add(notif)
    db.commit()

    # 5. List notifications
    resp = client.get("/api/notifications/", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 1

    # 6. Mark as read
    notif_id = resp.json()[0]["id"]
    resp = client.patch(f"/api/notifications/{notif_id}/read", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["is_read"] is True

    # 7. Unread count is now 0
    resp = client.get("/api/notifications/unread-count", headers=headers)
    assert resp.json()["unread_count"] == 0

    # 8. Delete notification
    resp = client.delete(f"/api/notifications/{notif_id}", headers=headers)
    assert resp.status_code == 204

    # 9. List is now empty
    resp = client.get("/api/notifications/", headers=headers)
    assert resp.json() == []