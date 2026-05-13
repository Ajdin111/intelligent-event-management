from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_current_user
from app.models.user import User
from app.schemas.collaborator import (
    CollaboratorInviteRequest,
    CollaboratorResponse,
    CollaboratorWithUserResponse,
    PendingInviteResponse,
)
from app.schemas.event import EventResponse
from app.services import collaborator as collaborator_service

router = APIRouter(prefix="/api/collaborators", tags=["Collaborators"])


@router.post(
    "/events/{event_id}/invite",
    response_model=CollaboratorResponse,
    status_code=status.HTTP_201_CREATED,
)
def invite_collaborator(
    event_id: int,
    body: CollaboratorInviteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return collaborator_service.add_collaborator(db, event_id, body.email, current_user)


@router.post(
    "/events/{event_id}/accept",
    response_model=CollaboratorResponse,
)
def accept_invite(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return collaborator_service.accept_invite(db, event_id, current_user)


@router.post(
    "/events/{event_id}/decline",
    response_model=CollaboratorResponse,
)
def decline_invite(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return collaborator_service.decline_invite(db, event_id, current_user)


@router.delete(
    "/events/{event_id}/remove/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_collaborator(
    event_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    collaborator_service.remove_collaborator(db, event_id, user_id, current_user)


@router.get(
    "/events/{event_id}",
    response_model=list[CollaboratorWithUserResponse],
)
def list_collaborators(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return collaborator_service.list_collaborators(db, event_id, current_user)


@router.get(
    "/my/invites",
    response_model=list[PendingInviteResponse],
)
def my_invites(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return collaborator_service.list_my_invites(db, current_user)


@router.get(
    "/my/events",
    response_model=list[EventResponse],
)
def my_collaborating_events(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return collaborator_service.list_collaborating_events(db, current_user)