from sqlalchemy import DateTime, Integer, String, Text, Numeric, func, ForeignKey
from sqlalchemy.orm import mapped_column, relationship
from app.db.base import Base


class Registration(Base):
    __tablename__ = "registrations"

    id = mapped_column(Integer, primary_key=True)
    event_id = mapped_column(Integer, ForeignKey("events.id"), nullable=False)
    user_id = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    ticket_tier_id = mapped_column(Integer, ForeignKey("ticket_tiers.id"), nullable=True)
    promo_code_id = mapped_column(Integer, ForeignKey("promo_codes.id"), nullable=True)
    quantity = mapped_column(Integer, nullable=False, default=1)
    total_amount = mapped_column(Numeric(10, 2), nullable=False, default=0.00)
    status = mapped_column(String(20), nullable=False, default="pending")
    # 'pending', 'confirmed', 'cancelled', 'rejected'
    registered_at = mapped_column(DateTime, server_default=func.now())
    cancelled_at = mapped_column(DateTime, nullable=True)
    approved_at = mapped_column(DateTime, nullable=True)
    approved_by = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    cancellation_reason = mapped_column(Text, nullable=True)

    # relationships
    event = relationship("Event")
    user = relationship("User", foreign_keys=[user_id])
    ticket_tier = relationship("TicketTier")
    promo_code = relationship("PromoCode")
    approver = relationship("User", foreign_keys=[approved_by])
    tickets = relationship("Ticket", back_populates="registration")


class Waitlist(Base):
    __tablename__ = "waitlist"

    id = mapped_column(Integer, primary_key=True)
    event_id = mapped_column(Integer, ForeignKey("events.id"), nullable=False)
    user_id = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    ticket_tier_id = mapped_column(Integer, ForeignKey("ticket_tiers.id"), nullable=True)
    position = mapped_column(Integer, nullable=False)
    max_waitlist = mapped_column(Integer, nullable=False, default=50)
    status = mapped_column(String(20), nullable=False, default="waiting")
    # 'waiting', 'notified', 'expired', 'converted'
    joined_at = mapped_column(DateTime, server_default=func.now())
    notified_at = mapped_column(DateTime, nullable=True)
    confirmation_deadline = mapped_column(DateTime, nullable=True)

    # relationships
    event = relationship("Event")
    user = relationship("User")
    ticket_tier = relationship("TicketTier")


class Invite(Base):
    __tablename__ = "invites"

    id = mapped_column(Integer, primary_key=True)
    event_id = mapped_column(Integer, ForeignKey("events.id"), nullable=False)
    invited_by = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    email = mapped_column(String(255), nullable=False)
    user_id = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    token = mapped_column(String(500), unique=True, nullable=False)
    status = mapped_column(String(20), nullable=False, default="pending")
    # 'pending', 'accepted', 'expired'
    sent_at = mapped_column(DateTime, server_default=func.now())
    accepted_at = mapped_column(DateTime, nullable=True)
    expires_at = mapped_column(DateTime, nullable=False)

    # relationships
    event = relationship("Event")
    inviter = relationship("User", foreign_keys=[invited_by])
    user = relationship("User", foreign_keys=[user_id])