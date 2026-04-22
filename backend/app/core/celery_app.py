from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "teqevent",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "app.tasks.email",
        "app.tasks.notifications",
        "app.tasks.analytics",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    beat_schedule={
        "cleanup-expired-notifications": {
            "task": "app.tasks.notifications.cleanup_expired_notifications",
            "schedule": 86400.0,  # every 24 hours
        },
        "send-event-reminders-24h": {
            "task": "app.tasks.email.send_upcoming_event_reminders",
            "schedule": 3600.0,  # every hour, checks internally
        },
        "compute-platform-analytics-daily": {
    "task": "app.tasks.analytics.compute_platform_analytics",
    "schedule": 86400.0,
},
    },
)
celery_app.conf.update(
    broker_connection_retry_on_startup=True,  # add this
    task_serializer="json",
    # ... rest of your config
)
