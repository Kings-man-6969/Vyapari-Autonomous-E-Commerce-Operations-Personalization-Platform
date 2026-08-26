import uuid
import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db, SessionLocal
from app.models import Review, Product, Rating, Decision, User
from app.schemas import ReviewCreate, ReviewOut
from app.core.auth import get_current_user
from app.services.sentiment import classify_sentiment
from app.services.review_response import generate_response
from app.services.recommendation import retrain_async

router = APIRouter()


def _now():
    return datetime.now(timezone.utc).isoformat()


def _next_review_id(db: Session) -> str:
    count = db.query(Review).count()
    return f"REV_{(count + 1):04d}"


def _next_decision_id(db: Session) -> str:
    count = db.query(Decision).count()
    return f"DEC_{(count + 1):04d}"


def _update_product_rating(db: Session, product_id: str):
    reviews = db.query(Review).filter(
        Review.product_id == product_id,
        Review.status != "rejected",
    ).all()
    if not reviews:
        return
    avg = sum(r.stars for r in reviews) / len(reviews)
    product = db.query(Product).filter(Product.product_id == product_id).first()
    if product:
        product.avg_rating = round(avg, 1)
        product.review_count = len(reviews)


@router.post("/reviews", response_model=ReviewOut, status_code=201)
def submit_review(
    body: ReviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.account_type != "customer":
        raise HTTPException(status_code=403, detail="Only customers can submit reviews")

    product = db.query(Product).filter(Product.product_id == body.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Check if already reviewed
    existing = db.query(Review).filter(
        Review.product_id == body.product_id,
        Review.user_id == current_user.user_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="You have already reviewed this product")

    # Classify sentiment
    sentiment, sent_confidence = classify_sentiment(body.text)

    # Generate response
    response_text, resp_confidence, risk = generate_response(
        body.text, sentiment, body.stars, product.name, product.category
    )

    # Determine review + response status based on risk
    review_id = _next_review_id(db)
    resp_status = None
    resp_pub_at = None

    if risk == "LOW" and response_text:
        # Auto-execute: publish response immediately
        resp_status = "published"
        resp_pub_at = _now()
        dec_status = "auto_executed"
    elif risk == "HIGH":
        # Escalate: no response draft
        response_text = None
        resp_status = None
        dec_status = "pending"
    else:
        # MEDIUM: draft ready for HITL review
        resp_status = "draft"
        dec_status = "pending"

    review = Review(
        review_id=review_id,
        product_id=body.product_id,
        user_id=current_user.user_id,
        stars=body.stars,
        text=body.text,
        sentiment=sentiment,
        status="published",
        agent_response=response_text,
        response_status=resp_status,
        response_published_at=resp_pub_at,
        created_at=_now(),
        processed_at=_now(),
    )
    db.add(review)

    # Save rating too
    existing_rating = db.query(Rating).filter(
        Rating.user_id == current_user.user_id,
        Rating.product_id == body.product_id,
    ).first()
    if not existing_rating:
        db.add(Rating(
            rating_id=str(uuid.uuid4()),
            user_id=current_user.user_id,
            product_id=body.product_id,
            rating=body.stars,
            created_at=_now(),
        ))

    # Create HITL decision if needed
    action_payload = {
        "action": "REVIEW_DRAFT",
        "stars": body.stars,
        "sentiment": sentiment,
        "review_text": body.text[:150],
        "proposed_response": response_text or "Escalated — manual handling required",
    }
    decision = Decision(
        decision_id=_next_decision_id(db),
        agent_type="REVIEW_RESPONSE",
        product_id=body.product_id,
        review_id=review_id,
        decision_type="REVIEW_DRAFT",
        proposed_action=json.dumps(action_payload),
        confidence_score=resp_confidence,
        risk_level=risk,
        decision_status=dec_status,
        created_at=_now(),
        updated_at=_now(),
    )
    db.add(decision)

    _update_product_rating(db, body.product_id)
    db.commit()
    db.refresh(review)

    # Retrain recommendations async
    retrain_async(SessionLocal)

    return ReviewOut(
        review_id=review.review_id,
        product_id=review.product_id,
        stars=review.stars,
        text=review.text,
        sentiment=review.sentiment,
        status=review.status,
        agent_response=review.agent_response,
        response_status=review.response_status,
        response_published_at=review.response_published_at,
        created_at=review.created_at,
        processed_at=review.processed_at,
    )


@router.get("/reviews/seller/pending")
def get_seller_pending_reviews(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    products = db.query(Product).filter(Product.seller_id == current_user.user_id).all()
    pids = [p.product_id for p in products]
    pending = (
        db.query(Review)
        .filter(Review.product_id.in_(pids), Review.response_status.is_(None))
        .order_by(Review.created_at.desc())
        .all()
    )
    items = [
        {
            "review_id": r.review_id,
            "product_id": r.product_id,
            "product_name": r.product.name if r.product else "Unknown",
            "stars": r.stars,
            "text": r.text,
            "sentiment": r.sentiment,
            "created_at": r.created_at,
        }
        for r in pending
    ]
    return {
        "pending_reviews": items,
        "total": len(items),
    }


@router.post("/reviews/{review_id}/response")
def respond_to_review_alt(
    review_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    review = db.query(Review).filter(Review.review_id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    resp_text = payload.get("response_text") or payload.get("response", "")
    review.agent_response = resp_text
    review.response_status = "published"
    review.response_published_at = _now()
    review.status = "published"
    db.commit()
    return {"message": "Response published", "review_id": review_id}

