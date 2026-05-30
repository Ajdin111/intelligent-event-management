from datetime import datetime, timedelta
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest

from tests.conftest import (
    auth_headers,
    make_admin,
    make_event,
    make_organizer,
    make_registration,
    make_ticket_tier,
    make_user,
)
from app.models.ml import MLDemandForecast, MLRecommendation
from app.models.review import Review


# ── helpers ───────────────────────────────────────────────────────────────────


def _insert_recommendation(db, user, event, score=Decimal("0.9")):
    rec = MLRecommendation(
        user_id=user.id,
        event_id=event.id,
        score=score,
        reason="popular_in_category",
        generated_at=datetime.utcnow(),
        expires_at=datetime.utcnow() + timedelta(hours=6),
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return rec


def _insert_forecast(db, event):
    forecast = MLDemandForecast(
        event_id=event.id,
        predicted_demand=80,
        confidence_score=Decimal("72.5"),
        price_action="optimal",
        price_suggestion=Decimal("25.00"),
        generated_at=datetime.utcnow(),
    )
    db.add(forecast)
    db.commit()
    db.refresh(forecast)
    return forecast


# ── 1. GET /api/ml/recommendations — empty ────────────────────────────────────


def test_recommendations_empty(client, db):
    user = make_user(db)
    resp = client.get("/api/ml/recommendations", headers=auth_headers(user))
    assert resp.status_code == 200
    assert resp.json() == []


# ── 2. GET /api/ml/recommendations — with data ────────────────────────────────


def test_recommendations_with_data(client, db):
    user = make_user(db)
    organizer = make_organizer(db)
    event = make_event(db, organizer, status="published")
    _insert_recommendation(db, user, event)

    resp = client.get("/api/ml/recommendations", headers=auth_headers(user))
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["event_id"] == event.id


# ── 3. GET /api/ml/demand/{event_id} — 404 when no forecast ──────────────────


def test_demand_404_no_forecast(client, db):
    organizer = make_organizer(db)
    event = make_event(db, organizer, status="published")

    resp = client.get(f"/api/ml/demand/{event.id}", headers=auth_headers(organizer))
    assert resp.status_code == 404
    assert resp.json()["detail"] == "No forecast available yet"


# ── 4. GET /api/ml/demand/{event_id} — 200 when forecast exists ──────────────


def test_demand_200_with_forecast(client, db):
    organizer = make_organizer(db)
    event = make_event(db, organizer, status="published")
    _insert_forecast(db, event)

    resp = client.get(f"/api/ml/demand/{event.id}", headers=auth_headers(organizer))
    assert resp.status_code == 200
    data = resp.json()
    assert data["event_id"] == event.id
    assert data["predicted_demand"] == 80


# ── 5. GET /api/ml/sentiment/{event_id} — correct percentages ────────────────


def test_sentiment_percentages(client, db):
    organizer = make_organizer(db)
    event = make_event(db, organizer, status="published")
    user = make_user(db)

    for sentiment in ["positive", "positive", "negative"]:
        review = Review(
            event_id=event.id,
            user_id=user.id,
            rating=4,
            comment="great event here",
            sentiment=sentiment,
            is_anonymous=False,
        )
        db.add(review)
    db.commit()

    resp = client.get(f"/api/ml/sentiment/{event.id}", headers=auth_headers(organizer))
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_reviews"] == 3
    assert abs(data["positive_pct"] - 2 / 3) < 0.01
    assert abs(data["negative_pct"] - 1 / 3) < 0.01
    assert data["neutral_pct"] == 0.0


# ── 6. GET /api/ml/sentiment/{event_id} — 403 when called by non-owner ───────


def test_sentiment_403_non_owner(client, db):
    organizer = make_organizer(db)
    other_user = make_user(db, email="other@test.com")
    event = make_event(db, organizer, status="published")

    resp = client.get(f"/api/ml/sentiment/{event.id}", headers=auth_headers(other_user))
    assert resp.status_code == 403


# ── 7. POST /api/ml/retrain — 403 when called by non-admin ───────────────────


def test_retrain_403_non_admin(client, db):
    user = make_user(db)
    resp = client.post("/api/ml/retrain", headers=auth_headers(user))
    assert resp.status_code == 403


# ── 8. POST /api/ml/retrain — 200 when called by admin ───────────────────────


def test_retrain_200_admin(client, db):
    admin = make_admin(db)
    with patch("app.tasks.ml.run_full_retrain") as mock_task:
        mock_result = MagicMock()
        mock_result.id = "test-task-id-123"
        mock_task.delay.return_value = mock_result

        resp = client.post("/api/ml/retrain", headers=auth_headers(admin))

    assert resp.status_code == 200
    data = resp.json()
    assert data["message"] == "Retrain job enqueued"
    assert "task_id" in data


# ── 9. GET /api/ml/status — returns correct bool per model ───────────────────


def test_status_model_flags(client, db):
    admin = make_admin(db)

    with (
        patch("app.services.ml.MODELS_DIR") as mock_dir,
        patch("app.services.ml.get_model_status") as mock_status,
    ):
        mock_status.return_value = {
            "sentiment":       True,
            "demand":          False,
            "recommender":     True,
            "last_retrain_at": None,
        }
        resp = client.get("/api/ml/status", headers=auth_headers(admin))

    assert resp.status_code == 200
    data = resp.json()
    assert "sentiment" in data
    assert "demand" in data
    assert "recommender" in data
    assert "last_retrain_at" in data


# ── 10. run_sentiment_analysis — silent when model is missing ─────────────────


def test_sentiment_task_silent_on_missing_model(db):
    from app.tasks.ml import run_sentiment_analysis

    review = Review(
        event_id=1,
        user_id=1,
        rating=4,
        comment="great event",
        sentiment=None,
        is_anonymous=False,
    )
    db.add(review)
    db.commit()
    db.refresh(review)

    with patch("ml.inference.sentiment.predict", side_effect=FileNotFoundError("model missing")):
        # Must complete without raising
        run_sentiment_analysis(review.id)

    db.refresh(review)
    assert review.sentiment is None


# ── 11. create_or_update_review — sentiment task enqueued ────────────────────


def test_review_creation_enqueues_sentiment_task(client, db):
    organizer = make_organizer(db)
    event = make_event(
        db,
        organizer,
        status="published",
        start=datetime(2024, 1, 1, 10, 0),
        end=datetime(2024, 1, 1, 18, 0),
    )
    user = make_user(db)
    tier = make_ticket_tier(db, event)
    make_registration(db, user, event, tier=tier, status="confirmed")

    with patch("app.tasks.ml.run_sentiment_analysis") as mock_task:
        mock_delay = MagicMock()
        mock_task.delay = mock_delay

        resp = client.post(
            "/api/reviews",
            json={
                "event_id": event.id,
                "rating": 5,
                "comment": "Absolutely wonderful event!",
                "is_anonymous": False,
            },
            headers=auth_headers(user),
        )

    assert resp.status_code == 201
    review_id = resp.json()["id"]
    mock_delay.assert_called_once_with(review_id)
