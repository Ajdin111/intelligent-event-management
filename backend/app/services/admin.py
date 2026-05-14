from datetime import datetime, date
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.user import User, UserRole
from app.models.event import Event, EventCategory
from app.models.analytics import PlatformAnalytics, EventAnalytics
from app.models.registration import Registration
from app.core.exceptions import NotFoundError, BadRequestError
from app.core.constants import EVENT_STATUS_DRAFT
from app.services.common import get_event_or_404


# ─── Helpers ─────────────────────────────────────────────────────────

def _get_user_or_404(db: Session, user_id: int) -> User:
    user = db.query(User).filter(
        User.id == user_id,
        User.deleted_at.is_(None)
    ).first()
    if not user:
        raise NotFoundError("User not found")
    return user


# ─── User Services ────────────────────────────────────────────────────

def get_all_users(db: Session, search: str = None, role: str = None) -> list[User]:
    query = db.query(User).filter(User.deleted_at.is_(None))

    if search:
        query = query.filter(or_(
            User.email.ilike(f"%{search}%"),
            User.first_name.ilike(f"%{search}%"),
            User.last_name.ilike(f"%{search}%")
        ))

    if role == "admin":
        query = query.filter(User.is_admin.is_(True))
    elif role == "organizer":
        query = query.join(UserRole).filter(UserRole.role.ilike("organizer"))
    elif role == "attendee":
        query = query.join(UserRole).filter(UserRole.role.ilike("attendee"))
    elif role is not None:
        raise BadRequestError("Invalid role filter. Must be attendee, organizer, or admin")

    return query.all()


def get_user_by_id(db: Session, user_id: int) -> User:
    return _get_user_or_404(db, user_id)


def deactivate_user(db: Session, user_id: int, current_user: User) -> User:
    user = _get_user_or_404(db, user_id)
    if user.id == current_user.id:
        raise BadRequestError("Cannot deactivate your own account")
    user.is_active = False
    db.commit()
    return user


def activate_user(db: Session, user_id: int) -> User:
    user = _get_user_or_404(db, user_id)
    user.is_active = True
    db.commit()
    return user


def delete_user(db: Session, user_id: int) -> None:
    user = _get_user_or_404(db, user_id)

    has_events = db.query(Event).filter(
        Event.owner_id == user_id,
        Event.deleted_at.is_(None)
    ).first() is not None

    has_registrations = db.query(Registration).filter(
        Registration.user_id == user_id
    ).first() is not None

    if has_events or has_registrations:
        raise BadRequestError("Cannot delete user with associated events or registrations")

    user.deleted_at = datetime.utcnow()
    db.commit()


# ─── Event Services ───────────────────────────────────────────────────

def get_all_events(db: Session, status: str = None) -> list[Event]:
    query = db.query(
        Event,
        User.email.label("owner_email"),
        EventAnalytics.total_registrations.label("total_registrations"),
        EventAnalytics.total_revenue.label("total_revenue"),
    ).join(
        User, User.id == Event.owner_id
    ).outerjoin(
        EventAnalytics, EventAnalytics.event_id == Event.id
    ).filter(Event.deleted_at.is_(None))
    if status:
        query = query.filter(Event.status.ilike(status))
    results = query.all()
    events = []
    for event, owner_email, total_registrations, total_revenue in results:
        event.owner_email = owner_email
        event.total_registrations = total_registrations
        event.total_revenue = total_revenue
        events.append(event)
    return events


def get_event_by_id_admin(db: Session, event_id: int) -> Event:
    result = db.query(
        Event,
        User.email.label("owner_email"),
        User.first_name.label("owner_first_name"),
        User.last_name.label("owner_last_name"),
    ).join(
        User, User.id == Event.owner_id
    ).filter(
        Event.id == event_id,
        Event.deleted_at.is_(None)
    ).first()

    if not result:
        raise NotFoundError("Event not found")

    event, owner_email, owner_first_name, owner_last_name = result
    event.owner_email = owner_email
    event.owner_first_name = owner_first_name
    event.owner_last_name = owner_last_name

    category_rows = db.query(EventCategory).filter(EventCategory.event_id == event_id).all()
    event.category_ids = [row.category_id for row in category_rows]

    return event


def get_event_analytics_admin(db: Session, event_id: int) -> EventAnalytics:
    get_event_or_404(db, event_id)
    analytics = db.query(EventAnalytics).filter(EventAnalytics.event_id == event_id).first()
    if not analytics:
        raise NotFoundError("Analytics not yet available for this event")
    return analytics


def force_unpublish_event(db: Session, event_id: int) -> Event:
    event = get_event_or_404(db, event_id)
    event.status = EVENT_STATUS_DRAFT
    db.commit()
    return event


def force_delete_event(db: Session, event_id: int) -> None:
    event = get_event_or_404(db, event_id)
    event.deleted_at = datetime.utcnow()
    db.commit()


# ─── Analytics Services ───────────────────────────────────────────────

def get_platform_analytics(db: Session) -> PlatformAnalytics:
    analytics = db.query(PlatformAnalytics).order_by(
        PlatformAnalytics.computed_at.desc()
    ).first()

    if not analytics:
        return PlatformAnalytics(
            date=date.today(),
            total_users=0,
            new_users=0,
            total_events=0,
            new_events=0,
            total_registrations=0,
            total_revenue=0.00,
            active_events=0,
            computed_at=datetime.utcnow()
        )

    return analytics
