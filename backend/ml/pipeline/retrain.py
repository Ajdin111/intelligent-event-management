import importlib
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

_STEPS = [
    ("train_sentiment",   "ml.training.train_sentiment"),
    ("train_demand",      "ml.training.train_demand"),
    ("train_recommender", "ml.training.train_recommender"),
]


def run_pipeline(trigger: str = "manual") -> dict:
    started_at = datetime.utcnow()
    logger.info("Retrain pipeline started (trigger=%s)", trigger)

    step_results = []

    for step_name, module_path in _STEPS:
        logger.info("Step started: %s", step_name)
        step_start = datetime.utcnow()
        try:
            module = importlib.import_module(module_path)
            module.train()
            duration = (datetime.utcnow() - step_start).total_seconds()
            logger.info("Step completed: %s (%.1fs)", step_name, duration)
            step_results.append({"name": step_name, "status": "success", "duration_seconds": duration})
        except Exception as exc:
            duration = (datetime.utcnow() - step_start).total_seconds()
            logger.error("Step failed: %s — %s", step_name, exc)
            step_results.append({"name": step_name, "status": "failed", "duration_seconds": duration})

    finished_at = datetime.utcnow()
    logger.info("Retrain pipeline finished (%.1fs total)", (finished_at - started_at).total_seconds())

    return {
        "trigger":     trigger,
        "started_at":  started_at.isoformat(),
        "finished_at": finished_at.isoformat(),
        "steps":       step_results,
    }
