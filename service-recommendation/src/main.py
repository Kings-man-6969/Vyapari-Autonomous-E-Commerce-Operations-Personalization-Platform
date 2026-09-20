import os
import math
import logging
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel
import asyncpg
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("service-recommendation")

app = FastAPI(
    title="Vyapari Recommendation & Semantic Search Service",
    description="Team A AI Microservice providing 384-dim product embeddings, pgvector cosine search, percentile normalization, time-decayed popularity, and cold-start fallback.",
    version="1.0.0"
)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://vyapari_admin:vyapari_secure_password@db:5432/vyapari")
MODEL_NAME = "all-MiniLM-L6-v2"
DECAY_LAMBDA = 0.05  # Exponential time-decay constant (~14 day half-life)

# Lazy model loader
_embedder = None

def get_embedder():
    global _embedder
    if _embedder is None:
        try:
            from sentence_transformers import SentenceTransformer
            logger.info(f"Loading SentenceTransformer model: {MODEL_NAME}...")
            _embedder = SentenceTransformer(MODEL_NAME)
            logger.info("Model loaded successfully.")
        except Exception as e:
            logger.warning(f"Failed to load sentence_transformers ({e}). Using deterministic fallback embedding generator.")
            _embedder = "fallback"
    return _embedder

def compute_embedding(text: str) -> List[float]:
    embedder = get_embedder()
    if embedder != "fallback":
        vec = embedder.encode(text, normalize_embeddings=True)
        return vec.tolist()
    
    # Fallback deterministic pseudo-embedding (384-dim, normalized)
    words = text.lower().split()
    seed = sum(ord(c) for c in text[:50]) if text else 42
    raw = [math.sin(seed * (i + 1)) * 0.5 + math.cos((len(words) + i) * 0.2) for i in range(384)]
    norm = math.sqrt(sum(x * x for x in raw)) or 1.0
    return [round(x / norm, 5) for x in raw]

def apply_percentile_normalization(items: List[Dict[str, Any]], score_key: str = "similarity") -> List[Dict[str, Any]]:
    """
    Applies percentile rank normalization to prevent extreme outliers from skewing results.
    Ranks from 1.0 (highest) to 0.0 (lowest) within the candidate result set.
    """
    total = len(items)
    if total <= 1:
        for item in items:
            item["percentile_score"] = 1.0
        return items
    
    # Already sorted descending by similarity/popularity
    for idx, item in enumerate(items):
        rank = (total - 1 - idx) / (total - 1)
        item["percentile_score"] = round(rank, 4)
    return items

async def get_db_pool():
    if not hasattr(app.state, "pool"):
        try:
            app.state.pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=10)
        except Exception as e:
            logger.error(f"Failed to connect to database: {e}")
            return None
    return app.state.pool

@app.on_event("startup")
async def startup():
    logger.info("Recommendation Service starting up...")

@app.on_event("shutdown")
async def shutdown():
    if hasattr(app.state, "pool") and app.state.pool:
        await app.state.pool.close()

# Request/Response schemas
class EmbedRequest(BaseModel):
    text: str

class EmbedResponse(BaseModel):
    model: str
    dimension: int
    embedding: List[float]

class InteractionRequest(BaseModel):
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    product_id: str
    event_type: str # view, click, add_to_cart, purchase, wishlist
    metadata: Optional[Dict[str, Any]] = {}

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "recommendation",
        "model": MODEL_NAME,
        "dimension": 384,
        "decay_lambda": DECAY_LAMBDA
    }

@app.post("/embed", response_model=EmbedResponse)
async def embed_endpoint(req: EmbedRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    vec = compute_embedding(req.text)
    return EmbedResponse(model=MODEL_NAME, dimension=384, embedding=vec)

@app.post("/embed/product/{product_id}")
async def embed_product_endpoint(product_id: str):
    pool = await get_db_pool()
    if not pool:
        raise HTTPException(status_code=503, detail="Database pool unavailable")
    
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow("SELECT id, title, description, attributes FROM products WHERE id = $1::uuid", product_id)
            if not row:
                raise HTTPException(status_code=404, detail="Product not found")
            
            text_to_embed = f"{row['title']} {row['description'] or ''} {str(row['attributes'] or '')}"
            vec = compute_embedding(text_to_embed)
            vec_str = "[" + ",".join(str(x) for x in vec) + "]"
            
            await conn.execute("""
                INSERT INTO product_embeddings (product_id, embedding, model_version, updated_at)
                VALUES ($1::uuid, $2::vector, $3, CURRENT_TIMESTAMP)
                ON CONFLICT (product_id)
                DO UPDATE SET embedding = EXCLUDED.embedding, model_version = EXCLUDED.model_version, updated_at = CURRENT_TIMESTAMP;
            """, product_id, vec_str, MODEL_NAME)
            
            return {"success": True, "product_id": product_id, "dimension": 384, "model": MODEL_NAME}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error embedding product {product_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def _fetch_popular_products(conn, limit: int = 8) -> List[Dict[str, Any]]:
    """Fetches active, in-stock products weighted by time-decayed user interactions."""
    query = """
        SELECT 
            p.id,
            p.title,
            p.price,
            p.images,
            p.stock_qty,
            p.status,
            COALESCE(SUM(
                (CASE 
                    WHEN ui.event_type = 'purchase' THEN 5.0
                    WHEN ui.event_type = 'add_to_cart' THEN 3.0
                    WHEN ui.event_type = 'wishlist' THEN 2.0
                    ELSE 1.0
                END) * EXP(-0.05 * EXTRACT(EPOCH FROM (NOW() - ui.created_at)) / 86400.0)
            ), 0.0) AS popularity_score
        FROM products p
        LEFT JOIN user_interactions ui ON p.id = ui.product_id
        WHERE p.status = 'active' AND p.stock_qty > 0
        GROUP BY p.id
        ORDER BY popularity_score DESC, p.created_at DESC
        LIMIT $1;
    """
    rows = await conn.fetch(query, limit)
    results = [
        {
            "id": str(r["id"]),
            "title": r["title"],
            "price": float(r["price"]),
            "images": r["images"],
            "stock_qty": r["stock_qty"],
            "similarity": round(float(r["popularity_score"]), 4),
            "reason": "popular_decayed"
        }
        for r in rows
    ]
    return apply_percentile_normalization(results, "similarity")

@app.get("/popular")
async def get_popular(limit: int = Query(8, ge=1, le=20)):
    pool = await get_db_pool()
    if not pool:
        raise HTTPException(status_code=503, detail="Database pool unavailable")
    
    try:
        async with pool.acquire() as conn:
            return await _fetch_popular_products(conn, limit)
    except Exception as e:
        logger.error(f"Error fetching popular items: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/similar/{product_id}")
async def get_similar_products(product_id: str, limit: int = Query(6, ge=1, le=20)):
    pool = await get_db_pool()
    if not pool:
        raise HTTPException(status_code=503, detail="Database pool unavailable")
    
    query = """
        WITH target AS (
            SELECT embedding FROM product_embeddings WHERE product_id = $1::uuid
        )
        SELECT 
            p.id,
            p.title,
            p.price,
            p.images,
            p.stock_qty,
            p.status,
            1 - (pe.embedding <=> target.embedding) AS similarity
        FROM product_embeddings pe
        JOIN products p ON pe.product_id = p.id
        CROSS JOIN target
        WHERE pe.product_id != $1::uuid
          AND p.status = 'active'
          AND p.stock_qty > 0
        ORDER BY pe.embedding <=> target.embedding ASC
        LIMIT $2;
    """
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(query, product_id, limit)
            
            # Cold-start fallback: if product has no embedding or 0 similar items, return popular items
            if not rows:
                logger.info(f"Zero similar items for product {product_id}, triggering cold-start popular fallback.")
                fallback_items = await _fetch_popular_products(conn, limit)
                for item in fallback_items:
                    item["reason"] = "cold_start_popular"
                return fallback_items

            results = [
                {
                    "id": str(r["id"]),
                    "title": r["title"],
                    "price": float(r["price"]),
                    "images": r["images"],
                    "stock_qty": r["stock_qty"],
                    "similarity": round(float(r["similarity"]), 4),
                    "reason": "similar_item"
                }
                for r in rows
            ]
            return apply_percentile_normalization(results, "similarity")
    except Exception as e:
        logger.error(f"Error querying similar products ({e}), falling back to popular")
        try:
            async with pool.acquire() as conn:
                return await _fetch_popular_products(conn, limit)
        except Exception:
            return []

@app.get("/search")
async def semantic_search(q: str = Query(..., min_length=1), limit: int = Query(12, ge=1, le=50)):
    pool = await get_db_pool()
    if not pool:
        raise HTTPException(status_code=503, detail="Database pool unavailable")
    
    vec = compute_embedding(q)
    vec_str = "[" + ",".join(str(x) for x in vec) + "]"
    
    query = """
        SELECT 
            p.id,
            p.title,
            p.description,
            p.price,
            p.compare_at_price,
            p.stock_qty,
            p.images,
            p.attributes,
            1 - (pe.embedding <=> $1::vector) AS similarity
        FROM product_embeddings pe
        JOIN products p ON pe.product_id = p.id
        WHERE p.status = 'active'
          AND p.stock_qty > 0
        ORDER BY pe.embedding <=> $1::vector ASC
        LIMIT $2;
    """
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(query, vec_str, limit)
            results = [
                {
                    "id": str(r["id"]),
                    "title": r["title"],
                    "description": r["description"],
                    "price": float(r["price"]),
                    "compare_at_price": float(r["compare_at_price"]) if r["compare_at_price"] else None,
                    "stock_qty": r["stock_qty"],
                    "images": r["images"],
                    "attributes": r["attributes"],
                    "similarity": round(float(r["similarity"]), 4)
                }
                for r in rows
            ]
            return apply_percentile_normalization(results, "similarity")
    except Exception as e:
        logger.error(f"Error executing semantic search: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/recommendations/home/{user_id}")
async def get_home_recommendations(user_id: str, limit: int = Query(10, ge=1, le=30)):
    """
    Personalized recommendations for home feed.
    If user has zero interactions (cold start), seamlessly returns top time-decayed popular items.
    """
    pool = await get_db_pool()
    if not pool:
        raise HTTPException(status_code=503, detail="Database pool unavailable")

    try:
        async with pool.acquire() as conn:
            # 1. Fetch user's latest interaction
            last_interaction = await conn.fetchrow(
                """
                SELECT product_id FROM user_interactions
                WHERE user_id = $1::uuid
                ORDER BY created_at DESC
                LIMIT 1;
                """,
                user_id
            )

            if not last_interaction:
                # Cold-start fallback: user has zero history
                logger.info(f"Cold-start for user {user_id}: returning time-decayed popular products.")
                popular = await _fetch_popular_products(conn, limit)
                for item in popular:
                    item["reason"] = "cold_start_popular"
                return popular

            last_prod_id = last_interaction["product_id"]

            # 2. Candidate generation using similarity to last interacted product
            query = """
                WITH target AS (
                    SELECT embedding FROM product_embeddings WHERE product_id = $1::uuid
                )
                SELECT 
                    p.id,
                    p.title,
                    p.price,
                    p.images,
                    p.stock_qty,
                    p.status,
                    1 - (pe.embedding <=> target.embedding) AS similarity
                FROM product_embeddings pe
                JOIN products p ON pe.product_id = p.id
                CROSS JOIN target
                WHERE pe.product_id != $1::uuid
                  AND p.status = 'active'
                  AND p.stock_qty > 0
                ORDER BY pe.embedding <=> target.embedding ASC
                LIMIT $2;
            """
            rows = await conn.fetch(query, last_prod_id, limit)
            if not rows:
                popular = await _fetch_popular_products(conn, limit)
                for item in popular:
                    item["reason"] = "cold_start_popular"
                return popular

            results = [
                {
                    "id": str(r["id"]),
                    "title": r["title"],
                    "price": float(r["price"]),
                    "images": r["images"],
                    "stock_qty": r["stock_qty"],
                    "similarity": round(float(r["similarity"]), 4),
                    "reason": "personalized"
                }
                for r in rows
            ]
            return apply_percentile_normalization(results, "similarity")
    except Exception as e:
        logger.error(f"Error generating home recommendations ({e}), falling back to popular items")
        try:
            async with pool.acquire() as conn:
                return await _fetch_popular_products(conn, limit)
        except Exception:
            return []

@app.post("/interactions")
async def record_interaction(req: InteractionRequest):
    """Records user behavioral event (view, click, add_to_cart, purchase, wishlist)."""
    valid_events = {"view", "click", "add_to_cart", "purchase", "wishlist"}
    if req.event_type not in valid_events:
        raise HTTPException(status_code=400, detail=f"Invalid event_type. Must be one of: {valid_events}")

    pool = await get_db_pool()
    if not pool:
        raise HTTPException(status_code=503, detail="Database pool unavailable")

    try:
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO user_interactions (user_id, session_id, product_id, event_type, metadata, created_at)
                VALUES ($1::uuid, $2, $3::uuid, $4, $5::jsonb, CURRENT_TIMESTAMP);
                """,
                req.user_id if req.user_id else None,
                req.session_id,
                req.product_id,
                req.event_type,
                req.metadata or {}
            )
            return {"success": True, "event_type": req.event_type, "product_id": req.product_id}
    except Exception as e:
        logger.error(f"Error recording interaction: {e}")
        raise HTTPException(status_code=500, detail=str(e))
