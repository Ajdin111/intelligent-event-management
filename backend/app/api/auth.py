from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_current_user
from app.core.limiter import limiter
from app.models.user import User, UserRole
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse, UserResponse
from app.services.auth import register_user, login_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse, status_code=201)
@limiter.limit("10/minute")
def register(request: Request, data: RegisterRequest, db: Session = Depends(get_db)):
    return register_user(db, data)


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
def login(request: Request, data: LoginRequest, db: Session = Depends(get_db)):
    token = login_user(db, data.email, data.password)
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/upgrade-to-organizer", response_model=UserResponse)
def upgrade_to_organizer(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    existing_role = db.query(UserRole).filter(
        UserRole.user_id == current_user.id,
        UserRole.role == "organizer"
    ).first()

    if existing_role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already an organizer"
        )

    db.add(UserRole(user_id=current_user.id, role="organizer"))
    db.commit()
    return current_user
