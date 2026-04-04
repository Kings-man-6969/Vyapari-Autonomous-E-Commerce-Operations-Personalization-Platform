"""
Recommendation Engine
- Primary: SVD collaborative filtering via scikit-surprise
- Fallback: content-based (category similarity) for cold-start users
"""
import json, os
from collections import defaultdict

DATA_DIR = os.path.join(os.path.dirname(__file__), "../data")

def _load(filename):
    with open(os.path.join(DATA_DIR, filename)) as f:
        return json.load(f)

def _build_svd_model():
    try:
        from surprise import Dataset, Reader, SVD
        from surprise import accuracy
        import pandas as pd

        ratings = _load("ratings.json")
        df = pd.DataFrame(ratings)
        reader = Reader(rating_scale=(1, 5))
        data = Dataset.load_from_df(df[["user_id", "product_id", "rating"]], reader)
        trainset = data.build_full_trainset()
        algo = SVD(n_factors=50, n_epochs=20, random_state=42)
        algo.fit(trainset)
        return algo, trainset
    except Exception as e:
        print(f"[Recommender] SVD build failed: {e}. Using fallback.")
        return None, None

# Lazy globals
_model = None
_trainset = None

def _get_model():
    global _model, _trainset
    if _model is None:
        _model, _trainset = _build_svd_model()
    return _model, _trainset

def get_recommendations(user_id: str, top_n: int = 6) -> list[dict]:
    products = _load("products.json")
    ratings = _load("ratings.json")
    product_map = {p["id"]: p for p in products}

    # Products already rated by this user
    rated_by_user = {r["product_id"] for r in ratings if r["user_id"] == user_id}

    model, trainset = _get_model()

    if model and trainset and user_id in {r["user_id"] for r in ratings}:
        # SVD predictions for unrated products
        all_pids = [p["id"] for p in products]
        unrated = [pid for pid in all_pids if pid not in rated_by_user]
        preds = [(pid, model.predict(user_id, pid).est) for pid in unrated]
        preds.sort(key=lambda x: x[1], reverse=True)
        top_pids = [pid for pid, _ in preds[:top_n]]
        source = "collaborative_filtering"
    else:
        # Cold-start: return top-rated products by average rating
        rating_sums = defaultdict(list)
        for r in ratings:
            rating_sums[r["product_id"]].append(r["rating"])
        avg_ratings = {pid: sum(rs)/len(rs) for pid, rs in rating_sums.items()}
        top_pids = sorted(avg_ratings, key=avg_ratings.get, reverse=True)[:top_n]
        source = "popularity_fallback"

    return [
        {**product_map[pid], "recommendation_source": source}
        for pid in top_pids if pid in product_map
    ]


def semantic_search(query: str, top_n: int = 6) -> list[dict]:
    """Simple keyword + category search. Replace with sentence-transformers for production."""
    products = _load("products.json")
    query_lower = query.lower()
    scored = []
    for p in products:
        score = 0
        if query_lower in p["name"].lower():
            score += 3
        if query_lower in p["category"].lower():
            score += 2
        # Partial word match
        for word in query_lower.split():
            if word in p["name"].lower():
                score += 1
        if score > 0:
            scored.append((score, p))

    scored.sort(key=lambda x: x[0], reverse=True)
    results = [p for _, p in scored[:top_n]]

    # If no matches, return random sample
    if not results:
        import random
        results = random.sample(products, min(top_n, len(products)))

    return [{**p, "recommendation_source": "semantic_search"} for p in results]
