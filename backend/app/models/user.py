from sqlalchemy import Boolean, DateTime, Integer, String, Text, func, ForeignKey
from sqlalchemy.orm import mapped_column, relationship
from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id = mapped_column(Integer, primary_key=True)
    email = mapped_column(String(255), unique=True, nullable=False)
    password_hash = mapped_column(String(255), nullable=False)
    first_name = mapped_column(String(100), nullable=False)
    last_name = mapped_column(String(100), nullable=False)
    profile_picture = mapped_column(String(500), nullable=True)
    bio = mapped_column(Text, nullable=True)
    is_active = mapped_column(Boolean, default=True)
    is_admin = mapped_column(Boolean, default=False)
    deleted_at = mapped_column(DateTime, nullable=True)
    created_at = mapped_column(DateTime, server_default=func.now())
    updated_at = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    # relationships
    roles = relationship("UserRole", back_populates="user", cascade="all, delete-orphan")

    @property
    def is_organizer(self) -> bool:
        return any(r.role == "organizer" for r in self.roles)


class UserRole(Base):
    __tablename__ = "user_roles"

    id = mapped_column(Integer, primary_key=True)
    user_id = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    role = mapped_column(String(50), nullable=False)
    # roles: 'attendee', 'organizer'
    assigned_at = mapped_column(DateTime, server_default=func.now())

    # relationships
    user = relationship("User", back_populates="roles")