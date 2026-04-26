import uuid
import pytest
from datetime import datetime, timedelta
from decimal import Decimal
from unittest.mock import patch
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.main import app
from app.db.base import Base
from app.core.dependencies import get_db
from app.core.security import hash_password, create_access_token
from app.models.user import User, UserRole
from app.models.event import Event, Category
from app.models.ticket import TicketTier, Ticket, PromoCode
from app.models.registration import Registration, Waitlist
from app.models.checkin import Checkin

# ─── Database Fixture ────────────────────────────────────

@pytest.fixture(scope="function")
def db():
    # StaticPool ensures all connections share the same in-memory SQLite DB,
    # so Base.metadata.create_all and all subsequent queries see the same tables.
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, autoflush=False)
    session = Session()
    yield session
    session.close()
    engine.dispose()


# ─── Celery Mock (autouse — runs for every test) ─────────

@pytest.fixture(autouse=True)
def mock_celery():
    patches = [
        patch("app.tasks.email.send_registration_confirmation.delay"),
        patch("app.tasks.email.send_feedback_request.delay"),
        patch("app.tasks.analytics.compute_event_analytics.delay"),
        patch("app.tasks.notifications.create_in_app_notification.delay"),
        patch("app.tasks.notifications.notify_waitlist_user.delay"),
    ]
    mocks = [p.start() for p in patches]
    yield mocks
    for p in patches:
        p.stop()


# ─── HTTP Client ─────────────────────────────────────────

@pytest.fixture(scope="function")
def client(db):
    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ─── User Factories ───────────────────────────────────────

def make_user(db, email="user@test.com", password="secret123", is_admin=False):
    user = User(
        email=email,
        password_hash=hash_password(password),
        first_name="Test",
        last_name="User",
        is_active=True,
        is_admin=is_admin,
    )
    db.add(user)
    db.flush()
    db.add(UserRole(user_id=user.id, role="attendee"))
    db.commit()
    db.refresh(user)
    return user


def make_organizer(db, email="organizer@test.com", password="secret123"):
    user = User(
        email=email,
        password_hash=hash_password(password),
        first_name="Org",
        last_name="User",
        is_active=True,
        is_admin=False,
    )
    db.add(user)
    db.flush()
    db.add(UserRole(user_id=user.id, role="organizer"))
    db.commit()
    db.refresh(user)
    return user


def make_admin(db, email="admin@test.com", password="secret123"):
    user = User(
        email=email,
        password_hash=hash_password(password),
        first_name="Admin",
        last_name="User",
        is_active=True,
        is_admin=True,
    )
    db.add(user)
    db.flush()
    db.add(UserRole(user_id=user.id, role="attendee"))
    db.commit()
    db.refresh(user)
    return user


def auth_headers(user):
    token = create_access_token({"sub": str(user.id)})
    return {"Authorization": f"Bearer {token}"}


# ─── Event / Ticket / Registration Factories ─────────────

def make_event(
    db,
    owner,
    title="Test Event",
    status="draft",
    registration_type="automatic",
    capacity=None,
    start=None,
    end=None,
):
    if start is None:
        start = datetime(2025, 12, 1, 9, 0)
    if end is None:
        end = datetime(2025, 12, 1, 17, 0)
    event = Event(
        owner_id=owner.id,
        title=title,
        description="Test description",
        location_type="physical",
        physical_address="123 Test St",
        start_datetime=start,
        end_datetime=end,
        capacity=capacity,
        registration_type=registration_type,
        requires_registration=True,
        has_ticketing=True,
        is_free=True,
        status=status,
        feedback_visibility="organizer_only",
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    event.category_ids = []
    return event


def make_ticket_tier(
    db,
    event,
    name="Standard",
    price=Decimal("10.00"),
    quantity=100,
    quantity_sold=0,
    is_active=True,
    sale_start=None,
    sale_end=None,
):
    if sale_start is None:
        sale_start = datetime(2024, 1, 1)
    if sale_end is None:
        sale_end = datetime(2026, 12, 31)
    tier = TicketTier(
        event_id=event.id,
        name=name,
        price=price,
        quantity=quantity,
        quantity_sold=quantity_sold,
        sale_start=sale_start,
        sale_end=sale_end,
        is_active=is_active,
    )
    db.add(tier)
    db.commit()
    db.refresh(tier)
    return tier


def make_promo_code(
    db,
    event,
    code="SAVE10",
    discount_type="percentage",
    discount_value=Decimal("10.00"),
    max_uses=100,
    uses_count=0,
    valid_from=None,
    valid_until=None,
    is_active=True,
):
    if valid_from is None:
        valid_from = datetime(2024, 1, 1)
    if valid_until is None:
        valid_until = datetime(2026, 12, 31)
    promo = PromoCode(
        event_id=event.id,
        code=code.upper(),
        discount_type=discount_type,
        discount_value=discount_value,
        max_uses=max_uses,
        uses_count=uses_count,
        valid_from=valid_from,
        valid_until=valid_until,
        is_active=is_active,
    )
    db.add(promo)
    db.commit()
    db.refresh(promo)
    return promo


def make_registration(db, user, event, tier=None, status="confirmed", quantity=1):
    price = tier.price * quantity if tier else Decimal("0.00")
    reg = Registration(
        event_id=event.id,
        user_id=user.id,
        ticket_tier_id=tier.id if tier else None,
        quantity=quantity,
        total_amount=price,
        status=status,
        registered_at=datetime.now(),
    )
    db.add(reg)
    db.flush()
    if status == "confirmed":
        ticket = Ticket(
            registration_id=reg.id,
            ticket_tier_id=tier.id if tier else None,
            user_id=user.id,
            event_id=event.id,
            qr_code=str(uuid.uuid4()),
            is_valid=True,
            is_guest=False,
            issued_at=datetime.now(),
        )
        db.add(ticket)
    db.commit()
    db.refresh(reg)
    return reg


def make_checkin(db, registration, ticket, event, user, checked_by):
    checkin = Checkin(
        registration_id=registration.id,
        ticket_id=ticket.id,
        event_id=event.id,
        user_id=user.id,
        checked_in_by=checked_by.id,
        checked_in_at=datetime.now(),
        is_manual=False,
    )
    db.add(checkin)
    db.commit()
    db.refresh(checkin)
    return checkin


def make_category(db, name="Technology", description="Tech events"):
    cat = Category(name=name, description=description)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat
