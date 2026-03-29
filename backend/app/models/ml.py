from sqlalchemy import DateTime, Integer, String, Numeric, func, ForeignKey
from sqlalchemy.orm import mapped_column, relationship
from app.db.base import Base


class MLDemandForecast(Base):
    __tablename__ = "ml_demand_forecasts"

    id = mapped_column(Integer, primary_key=True)
    event_id = mapped_column(Integer, ForeignKey("events.id"), nullable=False)
    ticket_tier_id = mapped_column(Integer, ForeignKey("ticket_tiers.id"), nullable=True)
    predicted_demand = mapped_column(Integer, nullable=False)
    predicted_sellout_date = mapped_column(DateTime, nullable=True)
    confidence_score = mapped_column(Numeric(5, 2), nullable=True)
    # 0 to 100 percent
    model_version = mapped_column(String(50), nullable=True)
    generated_at = mapped_column(DateTime, server_default=func.now())

    # relationships
    event = relationship("Event")
    ticket_tier = relationship("TicketTier")


class MLRecommendation(Base):
    __tablename__ = "ml_recommendations"

    id = mapped_column(Integer, primary_key=True)
    user_id = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    event_id = mapped_column(Integer, ForeignKey("events.id"), nullable=False)
    score = mapped_column(Numeric(5, 4), nullable=False)
    # relevance score 0 to 1
    reason = mapped_column(String(100), nullable=True)
    # 'based_on_history', 'popular_in_category', 'similar_events'
    generated_at = mapped_column(DateTime, server_default=func.now())
    expires_at = mapped_column(DateTime, nullable=False)

    # relationships
    user = relationship("User")
    event = relationship("Event")