from datetime import datetime, date
from sqlalchemy.orm import Session
from sqlalchemy import or_
from fastapi import HTTPException, status

from app.models.user import User, UserRole
from app.models.event import Event
from app.models.analytics import PlatformAnalytics
from app.models.registration import Registration


# ─── Helpers ─────────────────────────────────────────────────────────

def _get_user_or_404(db: Session, user_id: int) -> User:
    user = db.query(User).filter(
        User.id == user_id,
        User.deleted_at.is_(None)
    ).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return user


def _get_event_or_404(db: Session, event_id: int) -> Event:
    event = db.query(Event).filter(
        Event.id == event_id,
        Event.deleted_at.is_(None)
    ).first()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    return event


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
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role filter. Must be attendee, organizer, or admin"
        )

    return query.all()


def get_user_by_id(db: Session, user_id: int) -> User:
    return _get_user_or_404(db, user_id)


def deactivate_user(db: Session, user_id: int, current_user: User) -> User:
    user = _get_user_or_404(db, user_id)
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate your own account"
        )
    user.is_active = False
    db.commit()
    return user


def activate_user(db: Session, user_id: int) -> User:
    user = _get_user_or_404(db, user_id)
    user.is_active = True
    db.commit()
    return user


def delete_user(db: Session, user_id: int) -> dict:
    user = _get_user_or_404(db, user_id)

    has_events = db.query(Event).filter(
        Event.owner_id == user_id
    ).first() is not None

    has_registrations = db.query(Registration).filter(
        Registration.user_id == user_id
    ).first() is not None

    if has_events or has_registrations:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete user with associated events or registrations"
        )

    db.delete(user)
    db.commit()
    return {"detail": "User deleted"}


# ─── Event Services ───────────────────────────────────────────────────

def get_all_events(db: Session, status: str = None) -> list[Event]:
    query = db.query(Event).filter(Event.deleted_at.is_(None))
    if status:
        query = query.filter(Event.status.ilike(status))
    return query.all()


def force_unpublish_event(db: Session, event_id: int) -> Event:
    event = _get_event_or_404(db, event_id)
    event.status = "draft"
    db.commit()
    return event


def force_delete_event(db: Session, event_id: int) -> dict:
    event = _get_event_or_404(db, event_id)
    db.delete(event)
    db.commit()
    return {"detail": "Event deleted"}


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
            computed_at=datetime.now()
        )

    return analytics