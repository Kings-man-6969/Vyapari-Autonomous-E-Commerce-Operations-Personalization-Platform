"""
Vyapari Backend — FastAPI
Run: uvicorn main:app --reload --port 8000
"""
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import json, os

from modules.recommender import get_recommendations, semantic_search
from modules.inventory_agent import run_inventory_scan, get_inventory_summary, update_product_field, get_pricing_summary
from modules.review_agent import process_reviews, get_all_reviews, approve_response, reject_response
from modules.decision_store import store_decisions, get_pending_decisions, get_all_decisions, resolve_decision

app = FastAPI(title="Vyapari API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")

def load_json(filename):
    with open(os.path.join(DATA_DIR, filename)) as f:
        return json.load(f)

# ─────────────────────────────────────────────
# PRODUCTS
# ─────────────────────────────────────────────

@app.get("/products")
def list_products(category: Optional[str] = None):
    products = load_json("products.json")
    if category:
        products = [p for p in products if p["category"].lower() == category.lower()]
    return products

@app.get("/products/{product_id}")
def get_product(product_id: str):
    products = load_json("products.json")
    for p in products:
        if p["id"] == product_id:
            return p
    raise HTTPException(status_code=404, detail="Product not found")

# ─────────────────────────────────────────────
# RECOMMENDATIONS
# ─────────────────────────────────────────────

@app.get("/recommendations/{user_id}")
def recommendations(user_id: str, top_n: int = 6):
    return get_recommendations(user_id, top_n)

@app.get("/search")
def search(q: str = Query(..., min_length=1), top_n: int = 6):
    return semantic_search(q, top_n)

# ─────────────────────────────────────────────
# INVENTORY & PRICING
# ─────────────────────────────────────────────

@app.get("/inventory")
def inventory():
    return get_inventory_summary()

@app.get("/pricing")
def pricing():
    return get_pricing_summary()

@app.post("/inventory/scan")
def scan_inventory(threshold_days: int = 7):
    decisions = run_inventory_scan(restock_threshold_days=threshold_days)
    stored = store_decisions(decisions)
    return {"scanned": len(decisions), "new_decisions": len(stored), "decisions": stored}

class UpdateProductRequest(BaseModel):
    field: str   # "price" or "stock"
    value: float

@app.patch("/products/{product_id}")
def update_product(product_id: str, req: UpdateProductRequest):
    if req.field not in ("price", "stock"):
        raise HTTPException(status_code=400, detail="field must be 'price' or 'stock'")
    update_product_field(product_id, req.field, req.value)
    return {"ok": True, "product_id": product_id, "updated": {req.field: req.value}}

# ─────────────────────────────────────────────
# REVIEWS
# ─────────────────────────────────────────────

@app.get("/reviews")
def reviews(status: Optional[str] = None):
    all_r = get_all_reviews()
    if status:
        all_r = [r for r in all_r if r.get("status") == status]
    return all_r

@app.post("/reviews/process")
def trigger_review_processing():
    processed = process_reviews()
    return {"processed": len(processed), "reviews": processed}

class ReviewAction(BaseModel):
    response: Optional[str] = None

@app.post("/reviews/{review_id}/approve")
def approve_review(review_id: str, body: ReviewAction):
    if not body.response:
        raise HTTPException(status_code=400, detail="response text required")
    approve_response(review_id, body.response)
    return {"ok": True, "review_id": review_id, "status": "published"}

@app.post("/reviews/{review_id}/reject")
def reject_review(review_id: str):
    reject_response(review_id)
    return {"ok": True, "review_id": review_id, "status": "rejected"}

# ─────────────────────────────────────────────
# HITL DECISIONS
# ─────────────────────────────────────────────

@app.get("/decisions/pending")
def pending_decisions():
    return get_pending_decisions()

@app.get("/decisions")
def all_decisions(limit: int = 50):
    return get_all_decisions(limit)

class DecisionAction(BaseModel):
    action: str  # "approved" | "rejected"
    resolved_by: Optional[str] = "operator"

@app.post("/decisions/{decision_id}/resolve")
def resolve(decision_id: int, body: DecisionAction):
    if body.action not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="action must be 'approved' or 'rejected'")
    resolve_decision(decision_id, body.action, body.resolved_by)
    return {"ok": True, "decision_id": decision_id, "status": body.action}

# ─────────────────────────────────────────────
# DASHBOARD STATS
# ─────────────────────────────────────────────

@app.get("/stats")
def stats():
    inventory = get_inventory_summary()
    reviews = get_all_reviews()
    pending = get_pending_decisions()

    critical_stock = sum(1 for p in inventory if p["health"] == "critical")
    warning_stock = sum(1 for p in inventory if p["health"] == "warning")
    pending_reviews = sum(1 for r in reviews if r["status"] in ("pending", "draft_ready"))
    escalated_reviews = sum(1 for r in reviews if r["status"] == "escalated")

    return {
        "total_products": len(inventory),
        "critical_stock_items": critical_stock,
        "warning_stock_items": warning_stock,
        "pending_decisions": len(pending),
        "pending_reviews": pending_reviews,
        "escalated_reviews": escalated_reviews,
        "total_reviews": len(reviews),
    }

@app.get("/")
def root():
    return {"message": "Vyapari API is running", "docs": "/docs"}
