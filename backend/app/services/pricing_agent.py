import json
import uuid
import time
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models import Product, CompetitorPrice, Decision


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def run_pricing_scan(db: Session, seller_id: str) -> dict:
    start = time.time()
    products = db.query(Product).filter(Product.seller_id == seller_id).all()

    decisions_created = 0
    auto_executed = 0
    pending_review = 0

    for p in products:
        cp = p.competitor_price
        if not cp:
            continue

        min_comp = min(cp.competitor_a, cp.competitor_b, cp.competitor_c)
        our_price = p.price
        diff_pct = round((our_price - min_comp) / min_comp * 100, 2)

        # Minimum viable price: cost × 1.10
        min_price = round(p.cost * 1.10, 2)
        suggested = round(max(min_price, min_comp * 1.03), 2)

        if diff_pct <= 5:
            continue  # competitive, no action

        if diff_pct > 15:
            confidence = 0.75
            risk = "MEDIUM"
            do_auto = False
        else:
            confidence = 0.88
            # Auto-execute if change is small and confidence high
            price_change_pct = abs(our_price - suggested) / our_price * 100
            do_auto = confidence >= 0.85 and price_change_pct <= 10
            risk = "LOW" if do_auto else "MEDIUM"

        action_payload = {
            "action": "PRICE_ADJUST",
            "current_price": our_price,
            "min_competitor": round(min_comp, 2),
            "price_diff_pct": diff_pct,
            "suggested_price": suggested,
            "reason": (
                f"Our price ₹{our_price} is {diff_pct:.1f}% above minimum "
                f"competitor price ₹{min_comp:.0f}. Suggest ₹{suggested}."
            ),
        }

        dec_status = "auto_executed" if do_auto else "pending"
        dec = Decision(
            decision_id="DEC_" + str(uuid.uuid4())[:8].upper(),
            agent_type="PRICING",
            product_id=p.product_id,
            decision_type="PRICE_ADJUST",
            proposed_action=json.dumps(action_payload),
            confidence_score=confidence,
            risk_level=risk,
            decision_status=dec_status,
            created_at=_now(),
            updated_at=_now(),
        )
        db.add(dec)

        if do_auto:
            p.price = suggested
            p.updated_at = _now()
            auto_executed += 1
        else:
            pending_review += 1

        decisions_created += 1

    db.commit()
    elapsed_ms = int((time.time() - start) * 1000)
    return {
        "message": "Pricing scan complete",
        "decisions_created": decisions_created,
        "auto_executed": auto_executed,
        "pending_review": pending_review,
        "escalated": 0,
        "scan_duration_ms": elapsed_ms,
    }
