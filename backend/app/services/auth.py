from datetime import datetime
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.user import User, UserRole
from app.models.event import Event
from app.schemas.auth import RegisterRequest, UpdateProfileRequest, ChangePasswordRequest, DeleteAccountRequest
from app.core.security import hash_password, verify_password, create_access_token


def register_user(db: Session, data: RegisterRequest) -> User:
    # check if email already exists
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # create new user
    user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        first_name=data.first_name,
        last_name=data.last_name,
    )
    db.add(user)
    db.flush()

    # assign attendee role by default
    role = UserRole(
        user_id=user.id,
        role="attendee"
    )
    db.add(role)
    db.commit()
    db.refresh(user)

    return user


def login_user(db: Session, email: str, password: str) -> str:
    # find user by email — also check not soft deleted
    user = db.query(User).filter(
        User.email == email,
        User.deleted_at.is_(None)
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    # check password
    if not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    # check account is active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated"
        )

    # create and return JWT token
    token = create_access_token(data={"sub": str(user.id)})
    return token


def update_profile(db: Session, user: User, data: UpdateProfileRequest) -> User:
    if data.first_name is not None:
        user.first_name = data.first_name
    if data.last_name is not None:
        user.last_name = data.last_name
    db.commit()
    db.refresh(user)
    return user


def change_password(db: Session, user: User, data: ChangePasswordRequest) -> None:
    if not verify_password(data.current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    if len(data.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="New password must be at least 8 characters"
        )
    user.password_hash = hash_password(data.new_password)
    db.commit()


def delete_account(db: Session, user: User, data: DeleteAccountRequest) -> None:
    if not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password is incorrect"
        )

    if user.is_organizer:
        now = datetime.utcnow()
        active_published = db.query(Event).filter(
            Event.owner_id == user.id,
            Event.status == "published",
            Event.end_datetime > now,
            Event.deleted_at.is_(None),
        ).first()
        if active_published:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Account cannot be deleted while you have active published events. Wait for them to finish or cancel them first."
            )

        db.query(Event).filter(
            Event.owner_id == user.id,
            Event.status == "draft",
            Event.deleted_at.is_(None),
        ).update({"deleted_at": now})

    user.deleted_at = datetime.utcnow()
    db.commit()