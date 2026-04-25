
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from typing import Generator, Optional
from app.db.session import SessionLocal
from app.core.security import decode_access_token
from app.models.user import User, UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    user_id = payload.get("sub")
    if user_id is None:
        raise credentials_exception

    user = db.query(User).filter(
        User.id == int(user_id),
        User.deleted_at.is_(None),
        User.is_active.is_(True)
    ).first()

    if user is None:
        raise credentials_exception

    return user


def require_organizer(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> User:
    role = db.query(UserRole).filter(
        UserRole.user_id == current_user.id,
        UserRole.role == "organizer"
    ).first()

    if not role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Organizer role required"
        )

    return current_user


def require_admin(
    current_user: User = Depends(get_current_user)
) -> User:
    # get_current_user already validates is_active and deleted_at
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required"
        )
    return current_user
def get_optional_user(
    db: Session = Depends(get_db),
    token: Optional[str] = Depends(oauth2_scheme)
) -> Optional[User]:
    if token is None:
        return None
    payload = decode_access_token(token)
    if payload is None:
        return None
    user_id = payload.get("sub")
    if user_id is None:
        return None
    user = db.query(User).filter(
        User.id == int(user_id),
        User.deleted_at.is_(None),
        User.is_active.is_(True)
    ).first()
    return user