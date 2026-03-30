from sqlalchemy import Boolean, DateTime, Integer, String, Text, Numeric, func, ForeignKey
from sqlalchemy.orm import mapped_column, relationship
from app.db.base import Base


class TicketTier(Base):
    __tablename__ = "ticket_tiers"

    id = mapped_column(Integer, primary_key=True)
    event_id = mapped_column(Integer, ForeignKey("events.id"), nullable=False)
    name = mapped_column(String(100), nullable=False)
    description = mapped_column(Text, nullable=True)
    price = mapped_column(Numeric(10, 2), nullable=False, default=0.00)
    quantity = mapped_column(Integer, nullable=False)
    quantity_sold = mapped_column(Integer, nullable=False, default=0)
    sale_start = mapped_column(DateTime, nullable=False)
    sale_end = mapped_column(DateTime, nullable=False)
    is_active = mapped_column(Boolean, default=True)
    created_at = mapped_column(DateTime, server_default=func.now())

    # relationships
    event = relationship("Event")


class Ticket(Base):
    __tablename__ = "tickets"

    id = mapped_column(Integer, primary_key=True)
    registration_id = mapped_column(Integer, ForeignKey("registrations.id"), nullable=False)
    ticket_tier_id = mapped_column(Integer, ForeignKey("ticket_tiers.id"), nullable=True)
    user_id = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    event_id = mapped_column(Integer, ForeignKey("events.id"), nullable=False)
    guest_name = mapped_column(String(255), nullable=True)
    guest_email = mapped_column(String(255), nullable=True)
    is_guest = mapped_column(Boolean, default=False)
    qr_code = mapped_column(String(500), unique=True, nullable=False)
    is_valid = mapped_column(Boolean, default=True)
    issued_at = mapped_column(DateTime, server_default=func.now())

    # relationships
    registration = relationship("Registration")
    ticket_tier = relationship("TicketTier")
    user = relationship("User")


class PromoCode(Base):
    __tablename__ = "promo_codes"

    id = mapped_column(Integer, primary_key=True)
    event_id = mapped_column(Integer, ForeignKey("events.id"), nullable=False)
    code = mapped_column(String(100), unique=True, nullable=False)
    discount_type = mapped_column(String(20), nullable=False)
    # 'percentage', 'fixed'
    discount_value = mapped_column(Numeric(10, 2), nullable=False)
    max_uses = mapped_column(Integer, nullable=False)
    uses_count = mapped_column(Integer, nullable=False, default=0)
    valid_from = mapped_column(DateTime, nullable=False)
    valid_until = mapped_column(DateTime, nullable=False)
    is_active = mapped_column(Boolean, default=True)
    created_at = mapped_column(DateTime, server_default=func.now())

    # relationships
    event = relationship("Event")