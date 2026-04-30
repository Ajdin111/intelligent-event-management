"""
TeqEvent Seed Script
--------------------
Generates and inserts synthetic data into the live PostgreSQL database.
Run from backend/ directory:

    python -m ml.seed.seed_data

Idempotent: checks if seed data already exists before inserting.
Safe to re-run — will skip if N_USERS or more users already exist.
"""

import random
import sys
import uuid
from datetime import datetime, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.core.security import hash_password
from app.models.user import User, UserRole
from app.models.event import Event, Category, EventCategory
from app.models.ticket import TicketTier, Ticket
from app.models.registration import Registration
from app.models.review import Review

from ml.seed.seed_config import (
    N_USERS, N_ORGANIZERS, N_EVENTS, CATEGORIES,
    EVENT_TEMPLATES, PHYSICAL_LOCATIONS, ONLINE_LINKS,
    FIRST_NAMES, LAST_NAMES, REVIEW_RATE,
    POSITIVE_COMMENTS, NEUTRAL_COMMENTS, NEGATIVE_COMMENTS,
    PAST_EVENT_RATIO, PAST_DAYS_RANGE, FUTURE_DAYS_RANGE,
)

random.seed(42)   # reproducible output

# ─── Helpers ──────────────────────────────────────────────────────────────────

def _random_name():
    return random.choice(FIRST_NAMES), random.choice(LAST_NAMES)


def _unique_email(first: str, last: str, idx: int) -> str:
    return f"{first.lower()}.{last.lower()}{idx}@teqseed.dev"


def _random_past_datetime(days_back_max: int = PAST_DAYS_RANGE) -> datetime:
    days_back = random.randint(14, days_back_max)
    return datetime.now() - timedelta(days=days_back)


def _random_future_datetime(days_forward_max: int = FUTURE_DAYS_RANGE) -> datetime:
    days_forward = random.randint(14, days_forward_max)
    return datetime.now() + timedelta(days=days_forward)


def _event_duration_hours() -> int:
    """Most events are 4–9 hours (single day)."""
    return random.choice([4, 5, 6, 7, 8, 9, 16, 24])


def _registration_count(capacity: int, fill_rate: float) -> int:
    """Add noise to fill rate so data isn't perfectly clean."""
    noise = random.uniform(-0.05, 0.05)
    rate = max(0.05, min(1.0, fill_rate + noise))
    return int(capacity * rate)


def _sentiment_from_rating(rating: int) -> str:
    if rating <= 2:
        return "negative"
    elif rating == 3:
        return "neutral"
    else:
        return "positive"


def _comment_from_sentiment(sentiment: str) -> str:
    if sentiment == "positive":
        return random.choice(POSITIVE_COMMENTS)
    elif sentiment == "neutral":
        return random.choice(NEUTRAL_COMMENTS)
    else:
        return random.choice(NEGATIVE_COMMENTS)


def _rating_from_sentiment(sentiment: str) -> int:
    """Weighted rating within the sentiment band."""
    if sentiment == "positive":
        return random.choices([4, 5], weights=[0.35, 0.65])[0]
    elif sentiment == "neutral":
        return 3
    else:
        return random.choices([1, 2], weights=[0.45, 0.55])[0]


# ─── Step 1: Categories ───────────────────────────────────────────────────────

def seed_categories(db: Session) -> dict[str, Category]:
    """Insert categories, return name → Category map."""
    existing = {c.name: c for c in db.query(Category).all()}
    created = {}

    for cat_data in CATEGORIES:
        if cat_data["name"] not in existing:
            cat = Category(
                name=cat_data["name"],
                description=cat_data["description"],
            )
            db.add(cat)
            db.flush()
            created[cat.name] = cat
        else:
            created[cat_data["name"]] = existing[cat_data["name"]]

    db.commit()
    print(f"  [categories] {len(created)} ready")
    return created


# ─── Step 2: Users (attendees) ────────────────────────────────────────────────

def seed_users(db: Session) -> list[User]:
    """Insert N_USERS attendees. Returns list of User objects."""
    existing_count = db.query(User).filter(
        User.email.like("%@teqseed.dev")
    ).count()

    if existing_count >= N_USERS:
        users = db.query(User).filter(User.email.like("%@teqseed.dev")).all()
        print(f"  [users] {len(users)} already seeded, skipping")
        return users

    users = []
    for i in range(N_USERS):
        first, last = _random_name()
        user = User(
            email=_unique_email(first, last, i),
            password_hash=hash_password("SeedPass123!"),
            first_name=first,
            last_name=last,
            is_active=True,
            is_admin=False,
        )
        db.add(user)
        db.flush()
        db.add(UserRole(user_id=user.id, role="attendee"))
        users.append(user)

    db.commit()
    print(f"  [users] {len(users)} created")
    return users


# ─── Step 3: Organizers ───────────────────────────────────────────────────────

def seed_organizers(db: Session) -> list[User]:
    """Insert N_ORGANIZERS organizer accounts."""
    existing = db.query(User).filter(
        User.email.like("%@teqorg.dev")
    ).all()

    if len(existing) >= N_ORGANIZERS:
        print(f"  [organizers] {len(existing)} already seeded, skipping")
        return existing

    organizers = []
    for i in range(N_ORGANIZERS):
        first, last = _random_name()
        user = User(
            email=f"org.{first.lower()}{i}@teqorg.dev",
            password_hash=hash_password("OrgPass123!"),
            first_name=first,
            last_name=last,
            is_active=True,
            is_admin=False,
        )
        db.add(user)
        db.flush()
        db.add(UserRole(user_id=user.id, role="attendee"))
        db.add(UserRole(user_id=user.id, role="organizer"))
        organizers.append(user)

    db.commit()
    print(f"  [organizers] {len(organizers)} created")
    return organizers


# ─── Step 4: Events ───────────────────────────────────────────────────────────

def seed_events(
    db: Session,
    organizers: list[User],
    category_map: dict[str, Category],
) -> list[Event]:
    """Insert N_EVENTS events across all categories."""
    existing = db.query(Event).filter(
        Event.description.like("%[SEED]%")
    ).count()

    if existing >= N_EVENTS:
        events = db.query(Event).filter(
            Event.description.like("%[SEED]%")
        ).all()
        print(f"  [events] {len(events)} already seeded, skipping")
        return events

    events = []
    category_names = list(EVENT_TEMPLATES.keys())
    n_past = int(N_EVENTS * PAST_EVENT_RATIO)
    n_future = N_EVENTS - n_past

    for i in range(N_EVENTS):
        is_past = i < n_past
        cat_name = category_names[i % len(category_names)]
        template = EVENT_TEMPLATES[cat_name]

        # Dates
        if is_past:
            start = _random_past_datetime()
        else:
            start = _random_future_datetime()

        duration_hours = _event_duration_hours()
        end = start + timedelta(hours=duration_hours)

        # Location
        location_type = random.choices(
            template["location_types"],
            weights=template["location_weights"],
        )[0]

        physical_address = None
        online_link = None

        if location_type == "physical":
            physical_address = random.choice(PHYSICAL_LOCATIONS)
        elif location_type == "online":
            online_link = random.choice(ONLINE_LINKS)
        else:  # hybrid
            physical_address = random.choice(PHYSICAL_LOCATIONS)
            online_link = random.choice(ONLINE_LINKS)

        # Capacity and pricing
        cap_min, cap_max = template["capacity_range"]
        capacity = random.randint(cap_min, cap_max)

        price_min, price_max = template["price_range"]
        is_free = price_min == 0 and random.random() < 0.25
        base_price = 0 if is_free else random.randint(price_min, price_max)

        # Title
        titles = template["titles"]
        title = f"{random.choice(titles)} {start.year}"

        # Registration type — most events are automatic
        reg_type = random.choices(
            ["automatic", "manual", "invite_only"],
            weights=[0.75, 0.20, 0.05],
        )[0]

        event = Event(
            owner_id=random.choice(organizers).id,
            title=title,
            description=f"[SEED] {cat_name} event for demo and ML training purposes.",
            location_type=location_type,
            physical_address=physical_address,
            online_link=online_link,
            start_datetime=start,
            end_datetime=end,
            capacity=capacity,
            registration_type=reg_type,
            requires_registration=True,
            has_ticketing=not is_free,
            is_free=is_free,
            status="published" if is_past else random.choice(["published", "published", "draft"]),
            feedback_visibility="public",
        )
        db.add(event)
        db.flush()

        # Link category
        category = category_map[cat_name]
        db.add(EventCategory(event_id=event.id, category_id=category.id))

        # Ticket tier (for paid events)
        tier = None
        if not is_free:
            sale_start = start - timedelta(days=random.randint(30, 90))
            sale_end = start - timedelta(days=1) if is_past else start + timedelta(days=30)
            tier = TicketTier(
                event_id=event.id,
                name="Standard",
                price=Decimal(str(base_price)),
                quantity=capacity,
                quantity_sold=0,   # updated after registrations
                sale_start=sale_start,
                sale_end=sale_end,
                is_active=True,
            )
            db.add(tier)

        events.append((event, tier, template))

    db.commit()
    print(f"  [events] {len(events)} created")

    # Re-fetch as plain Event objects for the return value
    return db.query(Event).filter(Event.description.like("%[SEED]%")).all()


# ─── Step 5: Registrations ────────────────────────────────────────────────────

def seed_registrations(
    db: Session,
    users: list[User],
    events: list[Event],
) -> list[Registration]:
    """
    For each past published event, generate registrations based on the
    fill rate defined in the event template. Each registration gets a ticket.
    """
    existing = db.query(Registration).join(Event).filter(
        Event.description.like("%[SEED]%")
    ).count()

    if existing > 0:
        regs = db.query(Registration).join(Event).filter(
            Event.description.like("%[SEED]%")
        ).all()
        print(f"  [registrations] {len(regs)} already seeded, skipping")
        return regs

    all_registrations = []

    for event in events:
        # Only generate registrations for past published events
        if event.status != "published" or event.start_datetime > datetime.now():
            continue

        # Determine category and template
        cat_link = db.query(EventCategory).filter(
            EventCategory.event_id == event.id
        ).first()
        if not cat_link:
            continue

        cat = db.query(Category).filter(Category.id == cat_link.category_id).first()
        if not cat or cat.name not in EVENT_TEMPLATES:
            continue

        template = EVENT_TEMPLATES[cat.name]
        fill_min, fill_max = template["fill_rate_range"]
        fill_rate = random.uniform(fill_min, fill_max)
        n_registrations = _registration_count(event.capacity, fill_rate)
        n_registrations = min(n_registrations, len(users))

        # Get ticket tier if exists
        tier = db.query(TicketTier).filter(
            TicketTier.event_id == event.id
        ).first()

        # Sample attendees without replacement
        attendees = random.sample(users, n_registrations)

        for user in attendees:
            total_amount = Decimal("0.00")
            if tier:
                total_amount = tier.price

            # Registration time: weighted toward event start
            days_before = random.choices(
                [
                    random.randint(1, 7),     # last week
                    random.randint(8, 30),    # 1–4 weeks before
                    random.randint(31, 90),   # 1–3 months before
                ],
                weights=[0.55, 0.30, 0.15],
            )[0]
            registered_at = event.start_datetime - timedelta(days=days_before)

            reg = Registration(
                event_id=event.id,
                user_id=user.id,
                ticket_tier_id=tier.id if tier else None,
                quantity=1,
                total_amount=total_amount,
                status="confirmed",
                registered_at=registered_at,
                approved_at=registered_at,
            )
            db.add(reg)
            db.flush()

            # Generate ticket with QR code
            ticket = Ticket(
                registration_id=reg.id,
                ticket_tier_id=tier.id if tier else None,
                user_id=user.id,
                event_id=event.id,
                qr_code=str(uuid.uuid4()),
                is_valid=True,
                is_guest=False,
            )
            db.add(ticket)
            all_registrations.append(reg)

        # Update quantity_sold on the tier
        if tier:
            tier.quantity_sold = n_registrations
            db.add(tier)

    db.commit()
    print(f"  [registrations] {len(all_registrations)} created")
    return all_registrations


# ─── Step 6: Reviews ──────────────────────────────────────────────────────────

def seed_reviews(
    db: Session,
    registrations: list[Registration],
) -> list[Review]:
    """
    Generate reviews for confirmed registrations on past ended events.
    Uses REVIEW_RATE to decide what fraction of attendees leave a review.
    Sentiment is set deterministically from rating (used for ML training).
    """
    existing = db.query(Review).join(Event).filter(
        Event.description.like("%[SEED]%")
    ).count()

    if existing > 0:
        reviews = db.query(Review).join(Event).filter(
            Event.description.like("%[SEED]%")
        ).all()
        print(f"  [reviews] {len(reviews)} already seeded, skipping")
        return reviews

    reviews = []

    # Group registrations by event for rating distribution
    event_reg_map: dict[int, list[Registration]] = {}
    for reg in registrations:
        event_reg_map.setdefault(reg.event_id, []).append(reg)

    for event_id, regs in event_reg_map.items():
        event = db.query(Event).filter(Event.id == event_id).first()
        if not event or event.end_datetime > datetime.now():
            continue

        # Each event gets a consistent "quality score" that biases ratings
        # so events feel coherent (not random per review)
        quality = random.choices(
            ["high", "medium", "low"],
            weights=[0.55, 0.30, 0.15],
        )[0]

        sentiment_weights = {
            "high":   {"positive": 0.75, "neutral": 0.18, "negative": 0.07},
            "medium": {"positive": 0.45, "neutral": 0.35, "negative": 0.20},
            "low":    {"positive": 0.15, "neutral": 0.30, "negative": 0.55},
        }[quality]

        for reg in regs:
            if random.random() > REVIEW_RATE:
                continue

            sentiment = random.choices(
                ["positive", "neutral", "negative"],
                weights=[
                    sentiment_weights["positive"],
                    sentiment_weights["neutral"],
                    sentiment_weights["negative"],
                ],
            )[0]

            rating = _rating_from_sentiment(sentiment)
            comment = _comment_from_sentiment(sentiment)

            # Review submitted after event ends
            days_after = random.randint(1, 14)
            created_at = event.end_datetime + timedelta(days=days_after)

            review = Review(
                event_id=event_id,
                user_id=reg.user_id,
                rating=rating,
                comment=comment,
                sentiment=sentiment,   # ground truth for ML training
                is_anonymous=random.random() < 0.20,
                created_at=created_at,
                updated_at=created_at,
            )
            db.add(review)
            reviews.append(review)

    db.commit()
    print(f"  [reviews] {len(reviews)} created")
    return reviews


# ─── Main Entry Point ─────────────────────────────────────────────────────────

def run_seed():
    print("\nTeqEvent Seed Script")
    print("=" * 40)

    db: Session = SessionLocal()

    try:
        # Guard: skip if already seeded
        existing_users = db.query(User).filter(
            User.email.like("%@teqseed.dev")
        ).count()

        if existing_users >= N_USERS:
            print(f"Database already seeded ({existing_users} seed users found).")
            print("To reseed, manually delete seed data or run with --force.")
            return

        print("Seeding categories...")
        category_map = seed_categories(db)

        print("Seeding users...")
        users = seed_users(db)

        print("Seeding organizers...")
        organizers = seed_organizers(db)

        print("Seeding events...")
        events = seed_events(db, organizers, category_map)

        print("Seeding registrations and tickets...")
        registrations = seed_registrations(db, users, events)

        print("Seeding reviews...")
        reviews = seed_reviews(db, registrations)

        print("=" * 40)
        print(f"Seed complete.")
        print(f"  Users:         {len(users)}")
        print(f"  Organizers:    {len(organizers)}")
        print(f"  Events:        {len(events)}")
        print(f"  Registrations: {len(registrations)}")
        print(f"  Reviews:       {len(reviews)}")
        print()

    except Exception as e:
        db.rollback()
        print(f"\nSeed failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run_seed()