import pytest
from datetime import datetime, timedelta
from tests.conftest import (
    make_user, make_organizer, make_admin, make_event,
    make_registration, auth_headers,
)
from app.models.review import Review
from app.models.registration import Registration


def make_past_event(db, owner, **kwargs):
    past = datetime.utcnow() - timedelta(days=1)
    return make_event(
        db,
        owner=owner,
        start=past - timedelta(hours=2),
        end=past,
        status=kwargs.pop("status", "published"),
        **kwargs,
    )


def make_confirmed_registration(db, user, event):
    reg = Registration(
        event_id=event.id,
        user_id=user.id,
        quantity=1,
        total_amount=0,
        status="confirmed",
        registered_at=datetime.utcnow(),
    )
    db.add(reg)
    db.commit()
    db.refresh(reg)
    return reg


# ─── POST /api/reviews ────────────────────────────────────

def test_create_review_success(client, db):
    organizer = make_organizer(db)
    user = make_user(db, email="attendee@test.com")
    event = make_past_event(db, owner=organizer)
    make_confirmed_registration(db, user, event)

    resp = client.post(
        "/api/reviews",
        json={"event_id": event.id, "rating": 5, "comment": "Great event", "is_anonymous": False},
        headers=auth_headers(user),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["rating"] == 5
    assert data["event_id"] == event.id


def test_create_review_event_not_ended(client, db):
    organizer = make_organizer(db)
    user = make_user(db, email="attendee@test.com")
    future = datetime.utcnow() + timedelta(days=30)
    event = make_event(
        db, owner=organizer, status="published",
        start=future, end=future + timedelta(hours=8),
    )
    make_confirmed_registration(db, user, event)

    resp = client.post(
        "/api/reviews",
        json={"event_id": event.id, "rating": 4, "comment": "Too soon", "is_anonymous": False},
        headers=auth_headers(user),
    )
    assert resp.status_code == 400


def test_create_review_no_registration(client, db):
    organizer = make_organizer(db)
    user = make_user(db, email="attendee@test.com")
    event = make_past_event(db, owner=organizer)

    resp = client.post(
        "/api/reviews",
        json={"event_id": event.id, "rating": 3, "comment": "Was okay", "is_anonymous": False},
        headers=auth_headers(user),
    )
    assert resp.status_code == 403


def test_update_existing_review(client, db):
    organizer = make_organizer(db)
    user = make_user(db, email="attendee@test.com")
    event = make_past_event(db, owner=organizer)
    make_confirmed_registration(db, user, event)

    client.post(
        "/api/reviews",
        json={"event_id": event.id, "rating": 3, "comment": "Okay", "is_anonymous": False},
        headers=auth_headers(user),
    )
    resp = client.post(
        "/api/reviews",
        json={"event_id": event.id, "rating": 5, "comment": "Actually great", "is_anonymous": False},
        headers=auth_headers(user),
    )
    assert resp.status_code == 201
    assert resp.json()["rating"] == 5
    assert resp.json()["comment"] == "Actually great"


def test_create_review_anonymous_hides_user(client, db):
    organizer = make_organizer(db)
    user = make_user(db, email="attendee@test.com")
    event = make_past_event(db, owner=organizer)
    make_confirmed_registration(db, user, event)

    resp = client.post(
        "/api/reviews",
        json={"event_id": event.id, "rating": 4, "comment": "Nice", "is_anonymous": True},
        headers=auth_headers(user),
    )
    assert resp.status_code == 201
    assert resp.json()["user_id"] is None


def test_create_review_unauthenticated(client, db):
    organizer = make_organizer(db)
    event = make_past_event(db, owner=organizer)

    resp = client.post(
        "/api/reviews",
        json={"event_id": event.id, "rating": 4, "comment": "Nice", "is_anonymous": False},
    )
    assert resp.status_code == 401


# ─── GET /api/events/{event_id}/reviews ──────────────────

def test_list_reviews_public_event(client, db):
    organizer = make_organizer(db)
    user = make_user(db, email="attendee@test.com")
    other = make_user(db, email="other@test.com")
    event = make_past_event(db, owner=organizer)
    event.feedback_visibility = "public"
    db.commit()

    review = Review(
        event_id=event.id, user_id=user.id,
        rating=4, comment="Good", is_anonymous=False, sentiment=None,
    )
    db.add(review)
    db.commit()

    resp = client.get(f"/api/events/{event.id}/reviews", headers=auth_headers(other))
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_list_reviews_organizer_only_forbidden_for_attendee(client, db):
    organizer = make_organizer(db)
    other = make_user(db, email="other@test.com")
    event = make_past_event(db, owner=organizer)
    # feedback_visibility defaults to organizer_only

    resp = client.get(f"/api/events/{event.id}/reviews", headers=auth_headers(other))
    assert resp.status_code == 403


def test_list_reviews_organizer_can_see_own_event(client, db):
    organizer = make_organizer(db)
    user = make_user(db, email="attendee@test.com")
    event = make_past_event(db, owner=organizer)

    review = Review(
        event_id=event.id, user_id=user.id,
        rating=5, comment="Loved it", is_anonymous=False, sentiment=None,
    )
    db.add(review)
    db.commit()

    resp = client.get(f"/api/events/{event.id}/reviews", headers=auth_headers(organizer))
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_list_reviews_admin_can_see_any(client, db):
    admin = make_admin(db)
    organizer = make_organizer(db, email="org@test.com")
    user = make_user(db, email="attendee@test.com")
    event = make_past_event(db, owner=organizer)

    review = Review(
        event_id=event.id, user_id=user.id,
        rating=3, comment="Meh", is_anonymous=False, sentiment=None,
    )
    db.add(review)
    db.commit()

    resp = client.get(f"/api/events/{event.id}/reviews", headers=auth_headers(admin))
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_list_reviews_anonymous_hides_user_id(client, db):
    organizer = make_organizer(db)
    user = make_user(db, email="attendee@test.com")
    event = make_past_event(db, owner=organizer)

    review = Review(
        event_id=event.id, user_id=user.id,
        rating=4, comment="Great", is_anonymous=True, sentiment=None,
    )
    db.add(review)
    db.commit()

    resp = client.get(f"/api/events/{event.id}/reviews", headers=auth_headers(organizer))
    assert resp.status_code == 200
    assert resp.json()[0]["user_id"] is None


# ─── GET /api/events/{event_id}/reviews/me ───────────────

def test_get_my_review(client, db):
    organizer = make_organizer(db)
    user = make_user(db, email="attendee@test.com")
    event = make_past_event(db, owner=organizer)

    review = Review(
        event_id=event.id, user_id=user.id,
        rating=5, comment="Perfect", is_anonymous=False, sentiment=None,
    )
    db.add(review)
    db.commit()

    resp = client.get(f"/api/events/{event.id}/reviews/me", headers=auth_headers(user))
    assert resp.status_code == 200
    assert resp.json()["rating"] == 5


def test_get_my_review_not_found(client, db):
    organizer = make_organizer(db)
    user = make_user(db, email="attendee@test.com")
    event = make_past_event(db, owner=organizer)

    resp = client.get(f"/api/events/{event.id}/reviews/me", headers=auth_headers(user))
    assert resp.status_code == 404


# ─── DELETE /api/reviews/{review_id} ─────────────────────

def test_delete_review_success(client, db):
    organizer = make_organizer(db)
    user = make_user(db, email="attendee@test.com")
    event = make_past_event(db, owner=organizer)

    review = Review(
        event_id=event.id, user_id=user.id,
        rating=4, comment="Fine", is_anonymous=False, sentiment=None,
    )
    db.add(review)
    db.commit()

    resp = client.delete(f"/api/reviews/{review.id}", headers=auth_headers(user))
    assert resp.status_code == 204


def test_delete_review_wrong_user(client, db):
    organizer = make_organizer(db)
    user = make_user(db, email="author@test.com")
    other = make_user(db, email="other@test.com")
    event = make_past_event(db, owner=organizer)

    review = Review(
        event_id=event.id, user_id=user.id,
        rating=4, comment="Fine", is_anonymous=False, sentiment=None,
    )
    db.add(review)
    db.commit()

    resp = client.delete(f"/api/reviews/{review.id}", headers=auth_headers(other))
    assert resp.status_code == 403


def test_delete_review_not_found(client, db):
    user = make_user(db)
    resp = client.delete("/api/reviews/99999", headers=auth_headers(user))
    assert resp.status_code == 404
