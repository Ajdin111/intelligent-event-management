from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_current_user
from app.models.user import User
from app.schemas.invite import (
    InviteCreateRequest,
    InviteResponse,
    InviteDetailResponse,
    InviteWithEventResponse,
    AcceptInviteResponse,
)
from app.services import invite as invite_service

router = APIRouter(tags=["Invites"])


@router.post(
    "/api/events/{event_id}/invites",
    response_model=InviteResponse,
    status_code=status.HTTP_201_CREATED,
)
def send_invite(
    event_id: int,
    body: InviteCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return invite_service.send_invite(db, event_id, body.email, current_user)


@router.get(
    "/api/events/{event_id}/invites",
    response_model=list[InviteDetailResponse],
)
def list_event_invites(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return invite_service.list_event_invites(db, event_id, current_user)


@router.get(
    "/api/invites/my",
    response_model=list[InviteWithEventResponse],
)
def list_my_invites(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return invite_service.list_my_invites(db, current_user)


@router.post(
    "/api/invites/{event_id}/accept",
    response_model=AcceptInviteResponse,
)
def accept_invite(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return invite_service.accept_invite(db, event_id, current_user)


@router.post(
    "/api/invites/{event_id}/decline",
    response_model=InviteResponse,
)
def decline_invite(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return invite_service.decline_invite(db, event_id, current_user)
