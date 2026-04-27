from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.core.dependencies import get_db, require_admin
from app.models.user import User
from app.schemas.admin import (
    AdminUserResponse,
    AdminEventResponse,
    PlatformAnalyticsResponse,
)
from app.services.admin import (
    get_all_users,
    get_user_by_id,
    deactivate_user,
    activate_user,
    delete_user,
    get_all_events,
    force_unpublish_event,
    force_delete_event,
    get_platform_analytics,
)

router = APIRouter(prefix="/api/admin", tags=["Admin"])


# ─── User Endpoints ───────────────────────────────────────────────────

@router.get("/users", response_model=list[AdminUserResponse])
def list_users(
    search: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return get_all_users(db, search=search, role=role)


@router.get("/users/{user_id}", response_model=AdminUserResponse)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return get_user_by_id(db, user_id)


@router.patch("/users/{user_id}/deactivate", response_model=AdminUserResponse)
def deactivate(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return deactivate_user(db, user_id, current_user)


@router.patch("/users/{user_id}/activate", response_model=AdminUserResponse)
def activate(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return activate_user(db, user_id)


@router.delete("/users/{user_id}", status_code=204)
def remove_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    delete_user(db, user_id)


# ─── Event Endpoints ──────────────────────────────────────────────────

@router.get("/events", response_model=list[AdminEventResponse])
def list_events(
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return get_all_events(db, status=status)


@router.patch("/events/{event_id}/unpublish", response_model=AdminEventResponse)
def unpublish_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return force_unpublish_event(db, event_id)


@router.delete("/events/{event_id}", status_code=204)
def remove_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    force_delete_event(db, event_id)


# ─── Analytics Endpoints ──────────────────────────────────────────────

@router.get("/analytics", response_model=PlatformAnalyticsResponse)
def platform_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return get_platform_analytics(db)