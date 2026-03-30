from sqlalchemy import Date, DateTime, Integer, Numeric, func, ForeignKey
from sqlalchemy.orm import mapped_column, relationship
from app.db.base import Base


class EventAnalytics(Base):
    __tablename__ = "event_analytics"

    id = mapped_column(Integer, primary_key=True)
    event_id = mapped_column(Integer, ForeignKey("events.id"), unique=True, nullable=False)
    total_registrations = mapped_column(Integer, default=0)
    confirmed_registrations = mapped_column(Integer, default=0)
    cancelled_registrations = mapped_column(Integer, default=0)
    total_checked_in = mapped_column(Integer, default=0)
    attendance_rate = mapped_column(Numeric(5, 2), default=0.00)
    total_revenue = mapped_column(Numeric(10, 2), default=0.00)
    average_rating = mapped_column(Numeric(3, 2), default=0.00)
    total_reviews = mapped_column(Integer, default=0)
    positive_sentiment_pct = mapped_column(Numeric(5, 2), default=0.00)
    negative_sentiment_pct = mapped_column(Numeric(5, 2), default=0.00)
    neutral_sentiment_pct = mapped_column(Numeric(5, 2), default=0.00)
    last_updated = mapped_column(DateTime, server_default=func.now())

    # relationships
    event = relationship("Event")


class EventAnalyticsHistory(Base):
    __tablename__ = "event_analytics_history"

    id = mapped_column(Integer, primary_key=True)
    event_id = mapped_column(Integer, ForeignKey("events.id"), nullable=False)
    snapshot_date = mapped_column(Date, nullable=False)
    total_registrations = mapped_column(Integer, default=0)
    confirmed_registrations = mapped_column(Integer, default=0)
    total_checked_in = mapped_column(Integer, default=0)
    total_revenue = mapped_column(Numeric(10, 2), default=0.00)
    attendance_rate = mapped_column(Numeric(5, 2), default=0.00)
    average_rating = mapped_column(Numeric(3, 2), default=0.00)
    computed_at = mapped_column(DateTime, server_default=func.now())

    # relationships
    event = relationship("Event")


class TicketTierAnalytics(Base):
    __tablename__ = "ticket_tier_analytics"

    id = mapped_column(Integer, primary_key=True)
    event_id = mapped_column(Integer, ForeignKey("events.id"), nullable=False)
    ticket_tier_id = mapped_column(Integer, ForeignKey("ticket_tiers.id"), nullable=False)
    total_sold = mapped_column(Integer, default=0)
    total_revenue = mapped_column(Numeric(10, 2), default=0.00)
    last_updated = mapped_column(DateTime, server_default=func.now())

    # relationships
    event = relationship("Event")
    ticket_tier = relationship("TicketTier")


class PlatformAnalytics(Base):
    __tablename__ = "platform_analytics"

    id = mapped_column(Integer, primary_key=True)
    date = mapped_column(Date, unique=True, nullable=False)
    total_users = mapped_column(Integer, default=0)
    new_users = mapped_column(Integer, default=0)
    total_events = mapped_column(Integer, default=0)
    new_events = mapped_column(Integer, default=0)
    total_registrations = mapped_column(Integer, default=0)
    total_revenue = mapped_column(Numeric(10, 2), default=0.00)
    active_events = mapped_column(Integer, default=0)
    computed_at = mapped_column(DateTime, server_default=func.now())