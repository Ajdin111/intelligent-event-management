import logging
from datetime import datetime
from pathlib import Path

import joblib

logger = logging.getLogger(__name__)

MODELS_DIR = Path(__file__).resolve().parent.parent / "models"


def evaluate_all() -> dict:
    result = {
        "sentiment":    None,
        "demand":       None,
        "recommender":  None,
        "evaluated_at": datetime.utcnow().isoformat(),
    }

    # ── Sentiment ────────────────────────────────────────────────────────────
    try:
        from app.db.session import get_db_context
        from app.models.review import Review
        from sklearn.model_selection import StratifiedKFold, cross_val_score

        pipeline = joblib.load(MODELS_DIR / "sentiment_model.pkl")

        with get_db_context() as db:
            reviews = (
                db.query(Review)
                .filter(Review.comment.isnot(None), Review.sentiment.isnot(None))
                .all()
            )

        if len(reviews) >= 10:
            texts  = [r.comment for r in reviews]
            labels = [r.sentiment for r in reviews]

            n_splits = min(5, min(labels.count(l) for l in set(labels)) if labels else 5)
            n_splits = max(2, n_splits)
            cv = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)

            accuracy = float(cross_val_score(pipeline, texts, labels, cv=cv, scoring="accuracy").mean())
            f1       = float(cross_val_score(pipeline, texts, labels, cv=cv, scoring="f1_weighted").mean())
            result["sentiment"] = {"accuracy": round(accuracy, 4), "f1": round(f1, 4)}
        else:
            logger.warning("Not enough labelled reviews for sentiment CV (need ≥10, got %d)", len(reviews))
    except FileNotFoundError:
        logger.warning("Sentiment model not found — skipping evaluation")
    except Exception as exc:
        logger.error("Sentiment evaluation error: %s", exc)

    # ── Demand ───────────────────────────────────────────────────────────────
    try:
        import numpy as np
        from app.db.session import get_db_context
        from app.models.event import Event, EventCategory, Category
        from app.models.registration import Registration
        from sklearn.metrics import mean_absolute_error, r2_score
        from sqlalchemy import func

        model    = joblib.load(MODELS_DIR / "demand_model.pkl")
        scaler   = joblib.load(MODELS_DIR / "demand_scaler.pkl")
        encoders = joblib.load(MODELS_DIR / "demand_encoder.pkl")

        cat_enc = encoders["category"]
        loc_enc = encoders["location_type"]
        reg_enc = encoders["registration_type"]

        with get_db_context() as db:
            events = (
                db.query(Event)
                .filter(Event.status == "published", Event.deleted_at.is_(None))
                .all()
            )

            X_list, y_list = [], []
            now = datetime.utcnow()

            for event in events:
                ec = (
                    db.query(EventCategory)
                    .filter(EventCategory.event_id == event.id)
                    .first()
                )
                category_name = "unknown"
                if ec:
                    cat = db.query(Category).filter(Category.id == ec.category_id).first()
                    if cat:
                        category_name = cat.name

                reg_count = (
                    db.query(func.count(Registration.id))
                    .filter(
                        Registration.event_id == event.id,
                        Registration.status == "confirmed",
                    )
                    .scalar()
                    or 0
                )

                capacity = event.capacity or 100
                days_until = max(0, (event.start_datetime - now).days)

                try:
                    cat_encoded = cat_enc.transform([category_name])[0]
                except ValueError:
                    cat_encoded = 0
                try:
                    loc_encoded = loc_enc.transform([event.location_type])[0]
                except ValueError:
                    loc_encoded = 0
                try:
                    re_encoded = reg_enc.transform([event.registration_type])[0]
                except ValueError:
                    re_encoded = 0

                X_list.append([
                    cat_encoded,
                    loc_encoded,
                    int(event.is_free),
                    0.0,
                    float(capacity),
                    float(days_until),
                    float(event.start_datetime.weekday()),
                    float(event.start_datetime.month),
                    re_encoded,
                    int(event.has_ticketing),
                ])
                y_list.append(float(reg_count))

        if len(X_list) >= 5:
            X = scaler.transform(X_list)
            y = np.array(y_list)
            y_pred = model.predict(X)
            mae = float(mean_absolute_error(y, y_pred))
            r2  = float(r2_score(y, y_pred))
            result["demand"] = {"mae": round(mae, 4), "r2": round(r2, 4)}
        else:
            logger.warning("Not enough published events for demand evaluation (need ≥5, got %d)", len(X_list))
    except FileNotFoundError:
        logger.warning("Demand model artifacts not found — skipping evaluation")
    except Exception as exc:
        logger.error("Demand evaluation error: %s", exc)

    # ── Recommender ──────────────────────────────────────────────────────────
    try:
        from app.db.session import get_db_context
        from app.models.user import User
        from app.models.ml import MLRecommendation
        from sqlalchemy import func, distinct

        with get_db_context() as db:
            total_users = (
                db.query(func.count(User.id))
                .filter(User.is_active.is_(True), User.deleted_at.is_(None))
                .scalar()
                or 0
            )
            users_with_recs = (
                db.query(func.count(distinct(MLRecommendation.user_id)))
                .scalar()
                or 0
            )

        coverage_pct = users_with_recs / total_users if total_users > 0 else 0.0
        result["recommender"] = {"coverage_pct": round(coverage_pct, 4)}
    except Exception as exc:
        logger.error("Recommender evaluation error: %s", exc)

    return result
