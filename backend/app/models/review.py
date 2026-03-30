from sqlalchemy import Boolean, DateTime, Integer, String, Text, func, ForeignKey
from sqlalchemy.orm import mapped_column, relationship
from app.db.base import Base


class Review(Base):
    __tablename__ = "reviews"

    id = mapped_column(Integer, primary_key=True)
    event_id = mapped_column(Integer, ForeignKey("events.id"), nullable=False)
    user_id = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    rating = mapped_column(Integer, nullable=False)
    # 1 to 5
    comment = mapped_column(Text, nullable=True)
    sentiment = mapped_column(String(20), nullable=True)
    # 'positive', 'negative', 'neutral' — filled by ML
    is_anonymous = mapped_column(Boolean, default=False)
    created_at = mapped_column(DateTime, server_default=func.now())
    updated_at = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    # relationships
    event = relationship("Event")
    user = relationship("User")