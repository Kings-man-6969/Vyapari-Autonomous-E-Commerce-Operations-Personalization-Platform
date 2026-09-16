"""
Vyapari — Celery Application
"""
from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "vyapari",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "app.tasks.notifications",
        "app.tasks.embedding_refresh",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Kolkata",
    enable_utc=True,
    task_track_started=True,
    # Beat schedule
    beat_schedule={
        "refresh-embeddings-daily": {
            "task": "app.tasks.embedding_refresh.refresh_all_product_embeddings",
            "schedule": 86400,  # every 24h
        },
    },
)
