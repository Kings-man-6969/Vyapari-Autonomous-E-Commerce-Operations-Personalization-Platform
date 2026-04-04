"""
Inventory & Pricing Agent
- Monitors stock levels vs sales velocity
- Flags restock when days_of_stock < threshold
- Flags pricing when our price > competitor_price * 1.10
"""
import json, os
from datetime import datetime

DATA_DIR = os.path.join(os.path.dirname(__file__), "../data")

def _load(filename):
    with open(os.path.join(DATA_DIR, filename)) as f:
        return json.load(f)

def _save(filename, data):
    with open(os.path.join(DATA_DIR, filename), "w") as f:
        json.dump(data, f, indent=2)


def run_inventory_scan(restock_threshold_days: int = 7) -> list[dict]:
    """Scan all products and return decisions that need HITL approval."""
    products = _load("products.json")
    sales_velocity = _load("sales_velocity.json")
    competitor_prices = _load("competitor_prices.json")
    comp_map = {c["product_id"]: c["competitor_price"] for c in competitor_prices}

    decisions = []

    for product in products:
        pid = product["id"]
        stock = product["stock"]
        our_price = product["price"]
        cost = product["cost"]
        velocity_data = sales_velocity.get(pid, [1] * 7)

        # Average daily sales over last 7 days
        avg_daily_sales = sum(velocity_data) / len(velocity_data) if velocity_data else 0
        days_of_stock = (stock / avg_daily_sales) if avg_daily_sales > 0 else 999

        # ── RESTOCK DECISION ──
        if days_of_stock < restock_threshold_days and stock < 20:
            suggested_qty = max(50, int(avg_daily_sales * 14))  # 2-week buffer
            confidence = min(0.95, (restock_threshold_days - days_of_stock) / restock_threshold_days)
            decisions.append({
                "type": "restock",
                "product_id": pid,
                "product_name": product["name"],
                "current_stock": stock,
                "avg_daily_sales": round(avg_daily_sales, 2),
                "days_of_stock_remaining": round(days_of_stock, 1),
                "suggested_restock_qty": suggested_qty,
                "confidence": round(confidence, 2),
                "mode": "autonomous" if confidence > 0.85 else "advisory",
                "reasoning": f"At {avg_daily_sales:.1f} units/day, current stock of {stock} lasts only {days_of_stock:.1f} days — below {restock_threshold_days}-day threshold.",
                "created_at": datetime.now().isoformat(),
                "status": "pending",
            })

        # ── PRICING DECISION ──
        comp_price = comp_map.get(pid)
        if comp_price:
            price_diff_pct = ((our_price - comp_price) / comp_price) * 100
            min_price = round(cost * 1.10, 2)  # Never below cost + 10%

            if price_diff_pct > 10:
                suggested_price = max(min_price, round(comp_price * 1.02, 2))  # 2% above competitor
                confidence = min(0.90, price_diff_pct / 30)
                decisions.append({
                    "type": "pricing",
                    "product_id": pid,
                    "product_name": product["name"],
                    "our_price": our_price,
                    "competitor_price": comp_price,
                    "price_diff_pct": round(price_diff_pct, 1),
                    "suggested_price": suggested_price,
                    "min_allowed_price": min_price,
                    "confidence": round(confidence, 2),
                    "mode": "advisory",  # pricing always requires human approval
                    "reasoning": f"Our price ₹{our_price} is {price_diff_pct:.1f}% above competitor ₹{comp_price}. Suggest ₹{suggested_price} (maintains 2% premium while staying competitive).",
                    "created_at": datetime.now().isoformat(),
                    "status": "pending",
                })

    return decisions


def get_inventory_summary() -> list[dict]:
    """Return all products with stock health status."""
    products = _load("products.json")
    sales_velocity = _load("sales_velocity.json")
    summary = []
    for p in products:
        velocity_data = sales_velocity.get(p["id"], [1] * 7)
        avg_daily = sum(velocity_data) / len(velocity_data) if velocity_data else 0
        days_left = (p["stock"] / avg_daily) if avg_daily > 0 else 999
        health = "critical" if days_left < 5 else ("warning" if days_left < 10 else "ok")
        summary.append({
            **p,
            "avg_daily_sales": round(avg_daily, 2),
            "days_of_stock": round(min(days_left, 999), 1),
            "health": health,
        })
    return summary


def get_pricing_summary() -> list[dict]:
    """Return pricing comparison with competitor prices and status."""
    products = _load("products.json")
    competitor_prices = _load("competitor_prices.json")
    comp_map = {c["product_id"]: c["competitor_price"] for c in competitor_prices}
    
    summary = []
    for p in products:
        pid = p["id"]
        our_price = p["price"]
        comp_price = comp_map.get(pid)
        if comp_price:
            diff_pct = ((our_price - comp_price) / comp_price) * 100
            status = "OVERPRICED" if diff_pct > 10 else ("UNDERPRICED" if diff_pct < -5 else "OK")
            suggested_price = round(comp_price * 1.02, 2) if diff_pct > 10 else our_price
        else:
            diff_pct = None
            status = "NO_DATA"
            suggested_price = our_price
        
        summary.append({
            "product_id": pid,
            "product_name": p["name"],
            "category": p["category"],
            "our_price": our_price,
            "competitor_price": comp_price,
            "diff_pct": round(diff_pct, 1) if diff_pct is not None else None,
            "suggested_price": suggested_price,
            "status": status,
            "cost": p["cost"],
        })
    return summary


def update_product_field(product_id: str, field: str, value):
    """Update a product field (price or stock) after HITL approval."""
    products = _load("products.json")
    for p in products:
        if p["id"] == product_id:
            p[field] = value
            break
    _save("products.json", products)
