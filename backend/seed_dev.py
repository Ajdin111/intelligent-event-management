"""
TeqEvent Development Seed Script
----------------------------------
Inserts predictable, named dev/test data into the local PostgreSQL database.
Run from backend/ directory:

    python seed_dev.py

Idempotent: safe to run multiple times — checks existence before inserting.
"""
import sys
import uuid
import random
from datetime import datetime, timedelta
from decimal import Decimal

sys.path.insert(0, ".")

from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.core.security import hash_password
from app.models.user import User, UserRole
from app.models.event import Event, Category, EventCategory
from app.models.ticket import TicketTier, Ticket
from app.models.registration import Registration
from app.models.review import Review

random.seed(2024)  # reproducible across runs

# ── Config ─────────────────────────────────────────────────────────────────────

ADMIN_EMAIL    = "admin@teqevent.com"
ADMIN_PASSWORD = "Admin123"
USER_PASSWORD  = "Test1234"

N_ATTENDEES        = 10
N_ORGANIZERS       = 3
N_FUTURE_EVENTS    = 50
N_PAST_EVENTS      = 10  # used for reviews

SEED_MARKER = "[DEV-SEED]"

CATEGORIES = [
    "Technology", "Business", "Design", "Data & AI", "Security",
    "Web Development", "DevOps", "Product", "Networking", "Workshop",
]

PHYSICAL_ADDRESSES = [
    "Convention Center Hall A, 123 Tech Blvd, San Francisco, CA 94103",
    "Grand Hyatt, 345 Innovation Ave, New York, NY 10001",
    "ExCeL London, Royal Docks, London E16 1XL, UK",
    "Palais des Congrès, 2 Place de la Porte Maillot, Paris 75017, France",
    "Berlin Congress Center, Alexanderplatz 7, 10178 Berlin, Germany",
    "Marina Bay Sands Expo, 10 Bayfront Ave, Singapore 018956",
    "Melbourne Convention Centre, 1 Convention Place, Melbourne VIC 3000",
    "Moscone Center, 747 Howard St, San Francisco, CA 94103",
    "Jacob K. Javits Center, 429 11th Ave, New York, NY 10001",
    "RAI Amsterdam, Europaplein 24, 1078 GZ Amsterdam, Netherlands",
]

ONLINE_LINKS = [
    "https://zoom.us/j/teqevent-2026-main",
    "https://meet.google.com/teq-dev-seed-001",
    "https://teams.microsoft.com/l/teqevent-live",
    "https://hopin.com/events/teqevent-dev",
    "https://streamyard.com/teqevent-broadcast",
]

# Exactly 50 unique titles for future events
FUTURE_EVENT_TITLES = [
    "AI & Machine Learning Summit",
    "Cloud Architecture Conference",
    "DevOps World Forum",
    "Product Leaders Summit",
    "UX Design Intensive",
    "Data Engineering Days",
    "Security & Privacy Symposium",
    "React & Frontend Conference",
    "Startup Founders Meetup",
    "Kubernetes & Platform Engineering",
    "Python for Data Science Workshop",
    "Agile & Scrum Masterclass",
    "Blockchain Technology Forum",
    "Full Stack Development Bootcamp",
    "API Design Best Practices",
    "Leadership in Tech Summit",
    "Open Source Contributors Day",
    "Mobile Development Workshop",
    "Growth Hacking Seminar",
    "Tech Ethics & Society Forum",
    "Edge Computing Conference",
    "Serverless Architecture Day",
    "Observability & SRE Summit",
    "Web Performance Workshop",
    "Remote Work & Digital Culture Forum",
    "Generative AI Applications",
    "Microservices Patterns Conference",
    "Data Governance Forum",
    "Platform Engineering Summit",
    "Developer Experience Conference",
    "Infrastructure as Code Workshop",
    "Modern Data Stack Days",
    "Zero Trust Security Summit",
    "Vector Database Conference",
    "LLMOps & AI Infrastructure",
    "Software Architecture Symposium",
    "Engineering Leadership Forum",
    "Testing & Quality Assurance Day",
    "TypeScript & JavaScript Summit",
    "Career Growth in Tech Workshop",
    "Rust Systems Programming Conference",
    "GraphQL & API Conference",
    "Continuous Delivery Summit",
    "Fintech Innovation Forum",
    "HealthTech Developer Day",
    "Sustainability in Tech Forum",
    "Emerging Technologies Showcase",
    "Developer Productivity Workshop",
    "Tech Startup Pitch Day",
    "Distributed Systems Conference",
]

PAST_EVENT_TITLES = [
    "AI Summit 2025",
    "DevOps Forum 2025",
    "Cloud Conf 2025",
    "Frontend Meetup 2025",
    "Data Days 2025",
    "Security Week 2025",
    "Product Craft 2025",
    "Rust & Systems 2025",
    "Platform Engineering 2025",
    "Developer Experience Day 2025",
]

REVIEW_COMMENTS = {
    "positive": [
        "Outstanding event — world-class speakers and great networking.",
        "Exceeded all expectations. Will definitely attend next year.",
        "Best conference I've attended this year. Highly recommended.",
        "Incredibly well-organized with actionable, practical insights.",
        "The workshops were hands-on and directly applicable to my work.",
    ],
    "neutral": [
        "Good event overall, though some sessions could have been shorter.",
        "Decent content. The venue was a bit crowded but manageable.",
        "Some talks were excellent, others felt average. Still worth attending.",
        "Reasonable value for the price. Would consider returning.",
        "Met a few interesting people but the agenda felt packed.",
    ],
    "negative": [
        "Content felt outdated compared to last year's edition.",
        "Overcrowded and A/V setup had issues throughout the day.",
        "Interesting topic but the execution fell short of expectations.",
        "Too many sales pitches, not enough technical depth.",
        "Registration process was chaotic and sessions ran noticeably late.",
    ],
}


# ── Helpers ────────────────────────────────────────────────────────────────────

def _get_or_create_category(db: Session, name: str) -> Category:
    cat = db.query(Category).filter(Category.name == name).first()
    if not cat:
        cat = Category(name=name, description=f"{name} events and conferences.")
        db.add(cat)
        db.flush()
    return cat


def _future_dt(days_min: int = 14, days_max: int = 365) -> datetime:
    days = random.randint(days_min, days_max)
    hour = random.choice([9, 10, 13, 14])
    base = datetime.now().replace(minute=0, second=0, microsecond=0)
    return base + timedelta(days=days, hours=hour - base.hour)


def _past_dt(days_min: int = 30, days_max: int = 200) -> datetime:
    days = random.randint(days_min, days_max)
    hour = random.choice([9, 10, 13, 14])
    base = datetime.now().replace(minute=0, second=0, microsecond=0)
    return base - timedelta(days=days) + timedelta(hours=hour - base.hour)


def _make_location() -> tuple[str, str | None, str | None]:
    loc_type = random.choices(
        ["physical", "online", "hybrid"],
        weights=[0.55, 0.30, 0.15],
    )[0]
    address = random.choice(PHYSICAL_ADDRESSES) if loc_type in ("physical", "hybrid") else None
    link    = random.choice(ONLINE_LINKS)       if loc_type in ("online",   "hybrid") else None
    return loc_type, address, link


# ── Step 1: Admin ──────────────────────────────────────────────────────────────

def seed_admin(db: Session) -> User:
    existing = db.query(User).filter(User.email == ADMIN_EMAIL).first()
    if existing:
        print(f"  [admin] already exists, skipping")
        return existing

    admin = User(
        email=ADMIN_EMAIL,
        password_hash=hash_password(ADMIN_PASSWORD),
        first_name="Admin",
        last_name="TeqEvent",
        is_active=True,
        is_admin=True,
    )
    db.add(admin)
    db.flush()
    db.add(UserRole(user_id=admin.id, role="attendee"))
    db.commit()
    print(f"  [admin] created — {ADMIN_EMAIL}")
    return admin


# ── Step 2: Attendees ──────────────────────────────────────────────────────────

def seed_attendees(db: Session) -> list[User]:
    users = []
    created = 0
    for i in range(1, N_ATTENDEES + 1):
        email = f"user{i}@teqevent.com"
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            users.append(existing)
            continue

        user = User(
            email=email,
            password_hash=hash_password(USER_PASSWORD),
            first_name="User",
            last_name=str(i),
            is_active=True,
            is_admin=False,
        )
        db.add(user)
        db.flush()
        db.add(UserRole(user_id=user.id, role="attendee"))
        users.append(user)
        created += 1

    db.commit()
    print(f"  [attendees] {len(users)} ready ({created} created)")
    return users


# ── Step 3: Organizers ─────────────────────────────────────────────────────────

def seed_organizers(db: Session) -> list[User]:
    organizers = []
    created = 0
    for i in range(1, N_ORGANIZERS + 1):
        email = f"org{i}@teqevent.com"
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            organizers.append(existing)
            continue

        user = User(
            email=email,
            password_hash=hash_password(USER_PASSWORD),
            first_name="Organizer",
            last_name=str(i),
            is_active=True,
            is_admin=False,
        )
        db.add(user)
        db.flush()
        db.add(UserRole(user_id=user.id, role="attendee"))
        db.add(UserRole(user_id=user.id, role="organizer"))
        organizers.append(user)
        created += 1

    db.commit()
    print(f"  [organizers] {len(organizers)} ready ({created} created)")
    return organizers


# ── Step 4: 50 published future events + ticket tiers ─────────────────────────

def seed_future_events(db: Session, organizers: list[User]) -> list[Event]:
    # Check how many future seed events already exist
    existing_events = (
        db.query(Event)
        .filter(
            Event.description.like(f"%{SEED_MARKER}%"),
            Event.start_datetime > datetime.now(),
        )
        .all()
    )

    if len(existing_events) >= N_FUTURE_EVENTS:
        print(f"  [events:future] {len(existing_events)} already seeded, skipping")
        return existing_events

    cat_map = {name: _get_or_create_category(db, name) for name in CATEGORIES}
    db.commit()

    events = []
    created = 0

    for i, title in enumerate(FUTURE_EVENT_TITLES):
        already = (
            db.query(Event)
            .filter(
                Event.title == title,
                Event.description.like(f"%{SEED_MARKER}%"),
            )
            .first()
        )
        if already:
            events.append(already)
            continue

        start = _future_dt()
        duration_h = random.choice([4, 6, 8, 8, 16])
        end = start + timedelta(hours=duration_h)

        loc_type, address, link = _make_location()
        capacity = random.choice([50, 100, 150, 200, 250, 300, 500])
        price    = random.choice([0, 29, 49, 79, 99, 149, 199, 299])
        is_free  = price == 0
        cat_name = CATEGORIES[i % len(CATEGORIES)]

        # Sale window: opened 30 days ago, closes 7 days after event starts
        sale_start = datetime.now() - timedelta(days=30)
        sale_end   = start + timedelta(days=7)

        event = Event(
            owner_id=organizers[i % len(organizers)].id,
            title=title,
            description=f"{SEED_MARKER} {cat_name} conference for developers and tech professionals.",
            location_type=loc_type,
            physical_address=address,
            online_link=link,
            start_datetime=start,
            end_datetime=end,
            capacity=capacity,
            registration_type="automatic",
            requires_registration=True,
            has_ticketing=True,
            is_free=is_free,
            status="published",
            feedback_visibility="public",
        )
        db.add(event)
        db.flush()

        db.add(EventCategory(event_id=event.id, category_id=cat_map[cat_name].id))

        # Tier layout: cycle through 1-tier / 2-tier / 3-tier patterns
        tier_mode = i % 3
        if tier_mode == 0:
            # 3 tiers
            db.add(TicketTier(
                event_id=event.id, name="Early Bird",
                description="Limited early access pricing.",
                price=Decimal(str(max(0, price - 30))),
                quantity=max(5, int(capacity * 0.2)),
                quantity_sold=0, sale_start=sale_start, sale_end=sale_end, is_active=True,
            ))
            db.add(TicketTier(
                event_id=event.id, name="General Admission",
                price=Decimal(str(price)),
                quantity=int(capacity * 0.6),
                quantity_sold=0, sale_start=sale_start, sale_end=sale_end, is_active=True,
            ))
            db.add(TicketTier(
                event_id=event.id, name="VIP",
                description="Priority seating and speaker meet-and-greet.",
                price=Decimal(str(price + 100)),
                quantity=max(5, int(capacity * 0.2)),
                quantity_sold=0, sale_start=sale_start, sale_end=sale_end, is_active=True,
            ))
        elif tier_mode == 1:
            # 2 tiers
            db.add(TicketTier(
                event_id=event.id, name="Standard",
                price=Decimal(str(price)),
                quantity=int(capacity * 0.8),
                quantity_sold=0, sale_start=sale_start, sale_end=sale_end, is_active=True,
            ))
            db.add(TicketTier(
                event_id=event.id, name="VIP",
                description="Front-row seating and networking dinner.",
                price=Decimal(str(price + 150)),
                quantity=max(5, int(capacity * 0.2)),
                quantity_sold=0, sale_start=sale_start, sale_end=sale_end, is_active=True,
            ))
        else:
            # 1 tier
            db.add(TicketTier(
                event_id=event.id, name="General Admission",
                price=Decimal(str(price)),
                quantity=capacity,
                quantity_sold=0, sale_start=sale_start, sale_end=sale_end, is_active=True,
            ))

        events.append(event)
        created += 1

    db.commit()
    print(f"  [events:future] {len(events)} ready ({created} created)")
    return events


# ── Step 5: Registrations on future events ─────────────────────────────────────

def seed_registrations(
    db: Session,
    users: list[User],
    events: list[Event],
) -> list[Registration]:
    existing_count = (
        db.query(Registration)
        .join(Event, Registration.event_id == Event.id)
        .filter(
            Event.description.like(f"%{SEED_MARKER}%"),
            Event.start_datetime > datetime.now(),
        )
        .count()
    )

    if existing_count > 0:
        all_regs = (
            db.query(Registration)
            .join(Event, Registration.event_id == Event.id)
            .filter(
                Event.description.like(f"%{SEED_MARKER}%"),
                Event.start_datetime > datetime.now(),
            )
            .all()
        )
        print(f"  [registrations] {len(all_regs)} already seeded, skipping")
        return all_regs

    all_regs = []

    for event in events:
        # Pick the "General Admission" or "Standard" tier as the default
        tier = (
            db.query(TicketTier)
            .filter(
                TicketTier.event_id == event.id,
                TicketTier.name.in_(["General Admission", "Standard"]),
            )
            .first()
        )
        if not tier:
            tier = db.query(TicketTier).filter(TicketTier.event_id == event.id).first()

        # Register 2-7 users per event
        n_regs = random.randint(2, min(7, len(users)))
        attendees = random.sample(users, n_regs)

        sold_delta = 0
        for j, user in enumerate(attendees):
            # Roughly 2/3 confirmed, 1/3 pending
            status = "pending" if j % 3 == 2 else "confirmed"
            total  = tier.price if tier else Decimal("0.00")

            reg = Registration(
                event_id=event.id,
                user_id=user.id,
                ticket_tier_id=tier.id if tier else None,
                quantity=1,
                total_amount=total,
                status=status,
            )
            db.add(reg)
            db.flush()

            if status == "confirmed":
                db.add(Ticket(
                    registration_id=reg.id,
                    ticket_tier_id=tier.id if tier else None,
                    user_id=user.id,
                    event_id=event.id,
                    qr_code=str(uuid.uuid4()),
                    is_valid=True,
                    is_guest=False,
                ))
                sold_delta += 1

            all_regs.append(reg)

        if tier and sold_delta:
            tier.quantity_sold = (tier.quantity_sold or 0) + sold_delta

    db.commit()
    print(f"  [registrations] {len(all_regs)} created")
    return all_regs


# ── Step 6: Past events + reviews ─────────────────────────────────────────────

def _seed_reviews_for_event(db: Session, event: Event, attendees: list[User]) -> int:
    """Insert reviews for attendees of a past event. Returns count added."""
    count = 0
    for user in attendees:
        if random.random() > 0.72:  # ~72% leave a review
            continue
        exists = db.query(Review).filter(
            Review.event_id == event.id,
            Review.user_id == user.id,
        ).first()
        if exists:
            continue

        rating    = random.choices([1, 2, 3, 4, 5], weights=[0.05, 0.08, 0.17, 0.35, 0.35])[0]
        sentiment = "positive" if rating >= 4 else ("neutral" if rating == 3 else "negative")
        comment   = random.choice(REVIEW_COMMENTS[sentiment])
        ts        = event.end_datetime + timedelta(days=random.randint(1, 14))

        db.add(Review(
            event_id=event.id,
            user_id=user.id,
            rating=rating,
            comment=comment,
            sentiment=sentiment,
            is_anonymous=random.random() < 0.15,
            created_at=ts,
            updated_at=ts,
        ))
        count += 1

    db.commit()
    return count


def seed_past_events_and_reviews(
    db: Session,
    organizers: list[User],
    users: list[User],
) -> None:
    existing_past = (
        db.query(Event)
        .filter(
            Event.description.like(f"%{SEED_MARKER}%"),
            Event.start_datetime < datetime.now(),
        )
        .all()
    )

    if len(existing_past) >= N_PAST_EVENTS:
        print(f"  [events:past] {len(existing_past)} already seeded, skipping")
        rev_count = (
            db.query(Review)
            .join(Event, Review.event_id == Event.id)
            .filter(Event.description.like(f"%{SEED_MARKER}%"))
            .count()
        )
        print(f"  [reviews] {rev_count} already seeded, skipping")
        return

    cat_map = {name: _get_or_create_category(db, name) for name in CATEGORIES}
    db.commit()

    total_events_created  = 0
    total_reviews_created = 0

    for i, title in enumerate(PAST_EVENT_TITLES):
        already = (
            db.query(Event)
            .filter(
                Event.title == title,
                Event.description.like(f"%{SEED_MARKER}%"),
            )
            .first()
        )

        if already:
            # Event exists — fill reviews if missing
            existing_attendees = (
                db.query(User)
                .join(Registration, Registration.user_id == User.id)
                .filter(Registration.event_id == already.id)
                .all()
            )
            total_reviews_created += _seed_reviews_for_event(db, already, existing_attendees)
            continue

        start = _past_dt()
        end   = start + timedelta(hours=8)
        loc_type, address, link = _make_location()
        capacity = random.choice([100, 150, 200, 300])
        price    = random.choice([0, 49, 79, 99])
        is_free  = price == 0
        cat_name = CATEGORIES[i % len(CATEGORIES)]

        sale_start = start - timedelta(days=60)
        sale_end   = start - timedelta(days=1)

        event = Event(
            owner_id=organizers[i % len(organizers)].id,
            title=title,
            description=f"{SEED_MARKER} Past {cat_name} event (dev seed, for review data).",
            location_type=loc_type,
            physical_address=address,
            online_link=link,
            start_datetime=start,
            end_datetime=end,
            capacity=capacity,
            registration_type="automatic",
            requires_registration=True,
            has_ticketing=True,
            is_free=is_free,
            status="published",
            feedback_visibility="public",
        )
        db.add(event)
        db.flush()

        db.add(EventCategory(event_id=event.id, category_id=cat_map[cat_name].id))

        tier = TicketTier(
            event_id=event.id,
            name="General Admission",
            price=Decimal(str(price)),
            quantity=capacity,
            quantity_sold=0,
            sale_start=sale_start,
            sale_end=sale_end,
            is_active=False,  # sale window closed
        )
        db.add(tier)
        db.flush()

        # Register all users as confirmed attendees
        n_attendees = random.randint(4, len(users))
        attendees   = random.sample(users, n_attendees)

        for user in attendees:
            reg = Registration(
                event_id=event.id,
                user_id=user.id,
                ticket_tier_id=tier.id,
                quantity=1,
                total_amount=tier.price,
                status="confirmed",
            )
            db.add(reg)
            db.flush()

            db.add(Ticket(
                registration_id=reg.id,
                ticket_tier_id=tier.id,
                user_id=user.id,
                event_id=event.id,
                qr_code=str(uuid.uuid4()),
                is_valid=True,
                is_guest=False,
            ))

        tier.quantity_sold = n_attendees
        db.commit()

        total_events_created += 1
        total_reviews_created += _seed_reviews_for_event(db, event, attendees)

    print(f"  [events:past] {total_events_created} created")
    print(f"  [reviews] {total_reviews_created} created")


# ── Main ───────────────────────────────────────────────────────────────────────

def run() -> None:
    print("\nTeqEvent Dev Seed")
    print("=" * 40)

    db: Session = SessionLocal()
    try:
        print("Admin...")
        seed_admin(db)

        print("Attendees...")
        users = seed_attendees(db)

        print("Organizers...")
        organizers = seed_organizers(db)

        print("50 future events + ticket tiers...")
        events = seed_future_events(db, organizers)

        print("Registrations (future events)...")
        seed_registrations(db, users, events)

        print("Past events + reviews...")
        seed_past_events_and_reviews(db, organizers, users)

        print("=" * 40)
        print("Done.")
        print()
        print("  admin@teqevent.com        / Admin123")
        print("  user1..10@teqevent.com    / Test1234")
        print("  org1..3@teqevent.com      / Test1234")
        print()

    except Exception as exc:
        db.rollback()
        print(f"\nSeed failed: {exc}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()
