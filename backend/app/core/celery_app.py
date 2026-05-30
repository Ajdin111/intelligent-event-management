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
        "app.tasks.ml",
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
    broker_connection_retry_on_startup=True,
    beat_schedule={
        "cleanup-expired-notifications": {
            "task": "app.tasks.notifications.cleanup_expired_notifications",
            "schedule": 86400.0,
        },
        "send-event-reminders": {
            "task": "app.tasks.email.send_upcoming_event_reminders",
            "schedule": 3600.0,
        },
        "compute-platform-analytics-daily": {
            "task": "app.tasks.analytics.compute_platform_analytics",
            "schedule": 86400.0,
        },
        "ml-regenerate-recommendations": {
            "task": "app.tasks.ml.regenerate_recommendations",
            "schedule": 21600.0,
        },
        "ml-recompute-demand-forecasts": {
            "task": "app.tasks.ml.recompute_demand_forecasts",
            "schedule": 86400.0,
        },
        "ml-weekly-retrain": {
            "task": "app.tasks.ml.run_full_retrain",
            "schedule": 604800.0,
        },
        "ml-check-retrain-trigger": {
            "task": "app.tasks.ml.check_and_retrain_if_needed",
            "schedule": 86400.0,
        },
    },
)
