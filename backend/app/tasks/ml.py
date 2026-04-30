import logging
from datetime import datetime, timedelta

from celery import shared_task

from app.db.session import get_db_context

logger = logging.getLogger(__name__)


@shared_task(name="app.tasks.ml.run_sentiment_analysis")
def run_sentiment_analysis(review_id: int):
    try:
        from ml.inference import sentiment as sentiment_inf
        from app.models.review import Review

        with get_db_context() as db:
            review = db.query(Review).filter(Review.id == review_id).first()
            if not review or not review.comment:
                return

            try:
                label = sentiment_inf.predict(review.comment)
            except FileNotFoundError:
                logger.warning(
                    "Sentiment model missing — skipping analysis for review %d", review_id
                )
                return

            review.sentiment = label
            db.commit()
    except Exception as exc:
        logger.error("run_sentiment_analysis error for review %d: %s", review_id, exc)


@shared_task(name="app.tasks.ml.regenerate_recommendations")
def regenerate_recommendations():
    try:
        from ml.inference import recommender as rec_inf
        from app.models.user import User
        from app.models.ml import MLRecommendation

        with get_db_context() as db:
            users = db.query(User).filter(
                User.is_active.is_(True),
                User.deleted_at.is_(None),
            ).all()

            now = datetime.utcnow()
            expires_at = now + timedelta(hours=6)

            for user in users:
                try:
                    recs = rec_inf.recommend(user.id, top_n=10)
                except FileNotFoundError:
                    logger.warning(
                        "Recommender model missing — skipping recommendations"
                    )
                    return
                except Exception as exc:
                    logger.error(
                        "Recommendation error for user %d: %s", user.id, exc
                    )
                    continue

                for rec in recs:
                    existing = db.query(MLRecommendation).filter(
                        MLRecommendation.user_id == user.id,
                        MLRecommendation.event_id == rec["event_id"],
                    ).first()

                    if existing:
                        existing.score = rec["score"]
                        existing.reason = rec.get("reason")
                        existing.generated_at = now
                        existing.expires_at = expires_at
                    else:
                        db.add(MLRecommendation(
                            user_id=user.id,
                            event_id=rec["event_id"],
                            score=rec["score"],
                            reason=rec.get("reason"),
                            generated_at=now,
                            expires_at=expires_at,
                        ))

            db.commit()
    except Exception as exc:
        logger.error("regenerate_recommendations error: %s", exc)


@shared_task(name="app.tasks.ml.recompute_demand_forecasts")
def recompute_demand_forecasts():
    try:
        from ml.inference import demand as demand_inf
        from app.models.event import Event, EventCategory, Category
        from app.models.ticket import TicketTier
        from app.models.registration import Registration
        from app.models.ml import MLDemandForecast
        from sqlalchemy import func

        with get_db_context() as db:
            now = datetime.utcnow()
            events = db.query(Event).filter(
                Event.status == "published",
                Event.end_datetime > now,
                Event.deleted_at.is_(None),
            ).all()

            for event in events:
                try:
                    ec = db.query(EventCategory).filter(
                        EventCategory.event_id == event.id
                    ).first()
                    category_name = "unknown"
                    if ec:
                        cat = db.query(Category).filter(
                            Category.id == ec.category_id
                        ).first()
                        if cat:
                            category_name = cat.name

                    tier = db.query(TicketTier).filter(
                        TicketTier.event_id == event.id,
                        TicketTier.is_active.is_(True),
                    ).first()
                    base_price = float(tier.price) if tier else 0.0

                    capacity = event.capacity or 100

                    current_regs = (
                        db.query(func.count(Registration.id))
                        .filter(
                            Registration.event_id == event.id,
                            Registration.status == "confirmed",
                        )
                        .scalar()
                        or 0
                    )

                    result = demand_inf.predict(
                        category_name=category_name,
                        location_type=event.location_type,
                        is_free=event.is_free,
                        base_price=base_price,
                        capacity=capacity,
                        start_datetime=event.start_datetime,
                        registration_type=event.registration_type,
                        has_ticketing=event.has_ticketing,
                        current_registrations=current_regs,
                        published_at=event.created_at,
                        current_price=base_price,
                    )

                    existing = db.query(MLDemandForecast).filter(
                        MLDemandForecast.event_id == event.id
                    ).first()

                    if existing:
                        existing.predicted_demand = result["predicted_demand"]
                        existing.confidence_score = result["confidence_score"]
                        existing.predicted_sellout_date = result["predicted_sellout_date"]
                        existing.price_action = result["price_action"]
                        existing.price_suggestion = result["price_suggestion"]
                        existing.generated_at = now
                    else:
                        db.add(MLDemandForecast(
                            event_id=event.id,
                            predicted_demand=result["predicted_demand"],
                            confidence_score=result["confidence_score"],
                            predicted_sellout_date=result["predicted_sellout_date"],
                            price_action=result["price_action"],
                            price_suggestion=result["price_suggestion"],
                            generated_at=now,
                        ))

                    db.commit()

                except FileNotFoundError:
                    logger.warning(
                        "Demand model missing — skipping forecast for event %d", event.id
                    )
                    return
                except Exception as exc:
                    logger.error(
                        "Demand forecast error for event %d: %s", event.id, exc
                    )

    except Exception as exc:
        logger.error("recompute_demand_forecasts error: %s", exc)


@shared_task(name="app.tasks.ml.run_full_retrain")
def run_full_retrain():
    import importlib

    logger.info("Starting full ML retrain")

    steps = [
        ("train_sentiment", "ml.training.train_sentiment"),
        ("train_demand", "ml.training.train_demand"),
        ("train_recommender", "ml.training.train_recommender"),
    ]

    for step_name, module_path in steps:
        logger.info("Starting step: %s", step_name)
        try:
            module = importlib.import_module(module_path)
            module.train()
            logger.info("Completed step: %s", step_name)
        except Exception as exc:
            logger.error("Step %s failed: %s", step_name, exc)

    logger.info("Full retrain complete — triggering downstream tasks")
    regenerate_recommendations.delay()
    recompute_demand_forecasts.delay()


@shared_task(name="app.tasks.ml.check_and_retrain_if_needed")
def check_and_retrain_if_needed():
    try:
        import redis as redis_lib
        from app.core.config import settings
        from app.models.review import Review

        r = redis_lib.from_url(settings.REDIS_URL)
        last_retrain_val = r.get("ml:last_retrain_at")

        if last_retrain_val:
            last_retrain_at = datetime.fromisoformat(last_retrain_val.decode())
        else:
            last_retrain_at = datetime.utcnow() - timedelta(days=7)

        with get_db_context() as db:
            count = (
                db.query(Review)
                .filter(Review.created_at > last_retrain_at)
                .count()
            )

        if count >= 50:
            logger.info(
                "Review count since last retrain: %d — triggering retrain", count
            )
            run_full_retrain.delay()
            r.set("ml:last_retrain_at", datetime.utcnow().isoformat())

    except Exception as exc:
        logger.error("check_and_retrain_if_needed error: %s", exc)
