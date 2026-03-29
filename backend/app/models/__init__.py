from app.models.user import User, UserRole
from app.models.event import Event, EventCategory, Category, EventCollaborator
from app.models.agenda import Track, Session, SessionRegistration
from app.models.ticket import TicketTier, Ticket, PromoCode
from app.models.registration import Registration, Waitlist, Invite
from app.models.checkin import Checkin, OfflineCheckinQueue
from app.models.notification import Notification, NotificationLog, NotificationPreferences, EventReminder
from app.models.review import Review
from app.models.analytics import EventAnalytics, EventAnalyticsHistory, TicketTierAnalytics, PlatformAnalytics
from app.models.ml import MLDemandForecast, MLRecommendation

__all__ = [
    # Users
    "User",
    "UserRole",
    # Events
    "Event",
    "EventCategory",
    "Category",
    "EventCollaborator",
    # Agenda
    "Track",
    "Session",
    "SessionRegistration",
    # Tickets
    "TicketTier",
    "Ticket",
    "PromoCode",
    # Registration
    "Registration",
    "Waitlist",
    "Invite",
    # Checkin
    "Checkin",
    "OfflineCheckinQueue",
    # Notifications
    "Notification",
    "NotificationLog",
    "NotificationPreferences",
    "EventReminder",
    # Reviews
    "Review",
    # Analytics
    "EventAnalytics",
    "EventAnalyticsHistory",
    "TicketTierAnalytics",
    "PlatformAnalytics",
    # ML
    "MLDemandForecast",
    "MLRecommendation",
]