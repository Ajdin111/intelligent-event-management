from sqlalchemy import Boolean, DateTime, Integer, String, Text, func, ForeignKey
from sqlalchemy.orm import mapped_column, relationship
from app.db.base import Base


class Event(Base):
    __tablename__ = "events"

    id = mapped_column(Integer, primary_key=True)
    owner_id = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    title = mapped_column(String(255), nullable=False)
    description = mapped_column(Text, nullable=False)
    cover_image = mapped_column(String(500), nullable=True)
    location_type = mapped_column(String(20), nullable=False)
    # 'physical', 'online', 'hybrid'
    physical_address = mapped_column(Text, nullable=True)
    online_link = mapped_column(String(500), nullable=True)
    start_datetime = mapped_column(DateTime, nullable=False)
    end_datetime = mapped_column(DateTime, nullable=False)
    capacity = mapped_column(Integer, nullable=True)
    registration_type = mapped_column(String(20), nullable=False, default="automatic")
    # 'automatic', 'manual', 'invite_only'
    requires_registration = mapped_column(Boolean, nullable=False, default=True)
    has_ticketing = mapped_column(Boolean, default=True)
    is_free = mapped_column(Boolean, default=False)
    status = mapped_column(String(20), nullable=False, default="draft")
    # 'draft', 'published', 'cancelled', 'closed'
    feedback_visibility = mapped_column(String(20), default="organizer_only")
    # 'public', 'organizer_only'
    deleted_at = mapped_column(DateTime, nullable=True)
    created_at = mapped_column(DateTime, server_default=func.now())
    updated_at = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    # relationships
    owner = relationship("User", foreign_keys=[owner_id])
    categories = relationship("EventCategory", back_populates="event", cascade="all, delete-orphan")
    collaborators = relationship("EventCollaborator", back_populates="event", cascade="all, delete-orphan")


class EventCategory(Base):
    __tablename__ = "event_categories"

    id = mapped_column(Integer, primary_key=True)
    event_id = mapped_column(Integer, ForeignKey("events.id"), nullable=False)
    category_id = mapped_column(Integer, ForeignKey("categories.id"), nullable=False)

    # relationships
    event = relationship("Event", back_populates="categories")
    category = relationship("Category")


class Category(Base):
    __tablename__ = "categories"

    id = mapped_column(Integer, primary_key=True)
    name = mapped_column(String(100), unique=True, nullable=False)
    description = mapped_column(Text, nullable=True)
    created_at = mapped_column(DateTime, server_default=func.now())


class EventCollaborator(Base):
    __tablename__ = "event_collaborators"

    id = mapped_column(Integer, primary_key=True)
    event_id = mapped_column(Integer, ForeignKey("events.id"), nullable=False)
    user_id = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    added_at = mapped_column(DateTime, server_default=func.now())

    # relationships
    event = relationship("Event", back_populates="collaborators")
    user = relationship("User")