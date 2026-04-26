import pytest
from datetime import datetime, timezone, timedelta
from pydantic import ValidationError

from app.schemas.utils import NaiveDatetime, PaginatedResponse


# ─── NaiveDatetime ───────────────────────────────────────

class _Model:
    """Minimal Pydantic model for testing NaiveDatetime."""
    pass


def test_naive_datetime_strips_utc_timezone():
    from pydantic import BaseModel
    from typing import Annotated

    class M(BaseModel):
        dt: NaiveDatetime

    aware = datetime(2025, 6, 15, 10, 0, 0, tzinfo=timezone.utc)
    m = M(dt=aware)
    assert m.dt.tzinfo is None
    assert m.dt.year == 2025
    assert m.dt.hour == 10


def test_naive_datetime_strips_positive_offset():
    from pydantic import BaseModel

    class M(BaseModel):
        dt: NaiveDatetime

    tz = timezone(timedelta(hours=2))
    aware = datetime(2025, 6, 15, 14, 0, 0, tzinfo=tz)
    m = M(dt=aware)
    # tzinfo stripped, wall-clock time preserved
    assert m.dt.tzinfo is None
    assert m.dt.hour == 14  # preserves wall-clock, not converted to UTC


def test_naive_datetime_passes_through_naive():
    from pydantic import BaseModel

    class M(BaseModel):
        dt: NaiveDatetime

    naive = datetime(2025, 6, 15, 9, 30, 0)
    m = M(dt=naive)
    assert m.dt == naive
    assert m.dt.tzinfo is None


def test_naive_datetime_from_iso_string():
    from pydantic import BaseModel

    class M(BaseModel):
        dt: NaiveDatetime

    # Without timezone — should pass through unchanged
    m = M(dt="2025-12-01T09:00:00")
    assert m.dt.year == 2025
    assert m.dt.month == 12
    assert m.dt.tzinfo is None


def test_naive_datetime_from_iso_string_with_tz():
    from pydantic import BaseModel

    class M(BaseModel):
        dt: NaiveDatetime

    # With UTC timezone marker
    m = M(dt="2025-12-01T09:00:00+00:00")
    assert m.dt.tzinfo is None
    assert m.dt.hour == 9


# ─── PaginatedResponse ────────────────────────────────────

def test_paginated_response_fields():
    items = [{"id": 1}, {"id": 2}]
    result = PaginatedResponse[dict](total=10, skip=0, limit=5, items=items)
    assert result.total == 10
    assert result.skip == 0
    assert result.limit == 5
    assert result.items == items


def test_paginated_response_empty():
    result = PaginatedResponse[str](total=0, skip=0, limit=20, items=[])
    assert result.total == 0
    assert result.items == []


def test_paginated_response_serialization():
    result = PaginatedResponse[dict](total=3, skip=2, limit=1, items=[{"x": 1}])
    data = result.model_dump()
    assert data["total"] == 3
    assert data["skip"] == 2
    assert data["limit"] == 1
    assert data["items"] == [{"x": 1}]


# ─── Timezone integration test ────────────────────────────

def test_event_datetime_stored_without_timezone(client, db):
    """Sending a tz-aware datetime in the API request stores a naive datetime."""
    from tests.conftest import make_organizer, auth_headers
    from app.models.event import Event

    org = make_organizer(db)
    resp = client.post("/api/events", json={
        "title": "TZ Test",
        "description": "Testing tz stripping",
        "location_type": "physical",
        "physical_address": "123 St",
        "start_datetime": "2025-12-01T09:00:00+02:00",  # +2 hours offset
        "end_datetime": "2025-12-01T17:00:00+02:00",
    }, headers=auth_headers(org))
    assert resp.status_code == 201
    event_id = resp.json()["id"]
    event = db.query(Event).filter(Event.id == event_id).first()
    # Wall-clock time must be preserved exactly (09:00, not converted to 07:00 UTC)
    assert event.start_datetime.hour == 9
    assert event.start_datetime.tzinfo is None


def test_ticket_tier_datetime_stored_without_timezone(client, db):
    """Sale dates with timezone info are stripped to naive datetimes."""
    from tests.conftest import make_organizer, make_event, auth_headers
    from app.models.ticket import TicketTier

    org = make_organizer(db)
    event = make_event(db, org)
    resp = client.post(f"/api/events/{event.id}/ticket-tiers", json={
        "name": "TZ Tier",
        "price": "10.00",
        "quantity": 50,
        "sale_start": "2024-01-01T00:00:00+05:30",  # IST +5:30
        "sale_end": "2026-12-31T23:59:59+05:30",
    }, headers=auth_headers(org))
    assert resp.status_code == 201
    tier_id = resp.json()["id"]
    tier = db.query(TicketTier).filter(TicketTier.id == tier_id).first()
    assert tier.sale_start.tzinfo is None
    assert tier.sale_start.hour == 0  # wall-clock preserved, not shifted
