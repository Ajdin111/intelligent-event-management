from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.user import User, UserRole
from app.schemas.auth import RegisterRequest
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