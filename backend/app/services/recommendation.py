import threading
from datetime import datetime, timezone
from sqlalchemy.orm import Session

_model = None
_model_lock = threading.Lock()
_trained_at = None
SURPRISE_AVAILABLE = False

try:
    from surprise import SVD, Dataset, Reader
    import pandas as pd
    SURPRISE_AVAILABLE = True
except ImportError:
    pass


def train_model(db: Session) -> None:
    global _model, _trained_at
    if not SURPRISE_AVAILABLE:
        return
    from app.models import Rating
    ratings = db.query(Rating).all()
    if len(ratings) < 10:
        return
    data_dict = {
        "user": [r.user_id for r in ratings],
        "item": [r.product_id for r in ratings],
        "rating": [float(r.rating) for r in ratings],
    }
    df = pd.DataFrame(data_dict)
    reader = Reader(rating_scale=(1, 5))
    dataset = Dataset.load_from_df(df[["user", "item", "rating"]], reader)
    trainset = dataset.build_full_trainset()
    algo = SVD(n_factors=50, n_epochs=20, lr_all=0.005, reg_all=0.02)
    algo.fit(trainset)
    with _model_lock:
        _model = algo
        _trained_at = datetime.now(timezone.utc).isoformat()


def retrain_async(db_factory) -> None:
    """Retrain in a background thread after new ratings are added."""
    def _worker():
        db = db_factory()
        try:
            train_model(db)
        finally:
            db.close()
    threading.Thread(target=_worker, daemon=True).start()


def get_recommendations(db: Session, session_id: str, top_n: int = 6) -> dict:
    from app.models import Rating, Product

    user_ratings = db.query(Rating).filter(Rating.user_id == session_id).all()
    rated_ids = {r.product_id for r in user_ratings}
    now = datetime.now(timezone.utc).isoformat()

    # SVD path
    if SURPRISE_AVAILABLE and _model is not None and len(user_ratings) >= 3:
        all_products = db.query(Product).filter(Product.stock > 0).all()
        preds = []
        for p in all_products:
            if p.product_id not in rated_ids:
                pred = _model.predict(session_id, p.product_id)
                preds.append((p, pred.est))
        preds.sort(key=lambda x: x[1], reverse=True)
        top = preds[:top_n]
        return {
            "recommendations": [
                {
                    "product_id": p.product_id,
                    "name": p.name,
                    "category": p.category,
                    "price": p.price,
                    "avg_rating": p.avg_rating,
                    "image_url": p.image_url,
                    "source": "SVD",
                    "confidence": round(min(0.95, score / 5.0), 2),
                    "in_stock": p.stock > 0,
                }
                for p, score in top
            ],
            "source": "SVD",
            "generated_at": now,
        }

    # Content-based fallback: if user has rated some products, use same categories
    if user_ratings:
        from app.models import Product as Prod
        rated_products = db.query(Prod).filter(Prod.product_id.in_(rated_ids)).all()
        cats = list({p.category for p in rated_products})
        candidates = (
            db.query(Product)
            .filter(Product.stock > 0, Product.category.in_(cats), ~Product.product_id.in_(rated_ids))
            .order_by(Product.avg_rating.desc())
            .limit(top_n)
            .all()
        )
        if candidates:
            return {
                "recommendations": [
                    {
                        "product_id": p.product_id,
                        "name": p.name,
                        "category": p.category,
                        "price": p.price,
                        "avg_rating": p.avg_rating,
                        "image_url": p.image_url,
                        "source": "content_based",
                        "confidence": 0.70,
                        "in_stock": True,
                    }
                    for p in candidates
                ],
                "source": "content_based",
                "generated_at": now,
            }

    # Popularity fallback
    popular = (
        db.query(Product)
        .filter(Product.stock > 0)
        .order_by(Product.avg_rating.desc().nullslast(), Product.review_count.desc().nullslast())
        .limit(top_n)
        .all()
    )
    return {
        "recommendations": [
            {
                "product_id": p.product_id,
                "name": p.name,
                "category": p.category,
                "price": p.price,
                "avg_rating": p.avg_rating or 0.0,
                "image_url": p.image_url,
                "source": "popular",
                "confidence": 0.60,
                "in_stock": True,
            }
            for p in popular
        ],
        "source": "popular",
        "generated_at": now,
    }
