from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

from app.db.database import Product, Review

NEGATIVE_KEYWORDS = [
    "refund",
    "broken",
    "dangerous",
    "hazard",
    "fraud",
    "scam",
    "injury",
    "lawsuit",
    "fire",
    "explode",
    "defective",
    "terrible",
    "waste",
    "poor",
]

POSITIVE_KEYWORDS = ["great", "amazing", "excellent", "love", "perfect", "good"]


def classify_review(text: str, stars: int) -> tuple[str, float, bool, str | None]:
    lower = text.lower()
    for keyword in NEGATIVE_KEYWORDS:
        if keyword in lower:
            return "negative", 0.92, True, f"contains keyword '{keyword}'"

    if stars == 1:
        return "negative", 0.9, True, "1-star review"

    pos_hits = sum(1 for w in POSITIVE_KEYWORDS if w in lower)
    neg_hits = sum(1 for w in NEGATIVE_KEYWORDS if w in lower)

    if pos_hits > neg_hits:
        return "positive", 0.84, False, None
    if neg_hits > pos_hits:
        return "negative", 0.82, False, None
    return "neutral", 0.76, False, None


def build_draft_response(product_name: str, sentiment: str) -> str:
    if sentiment == "positive":
        return f"Thank you for sharing your feedback on {product_name}. We are glad it worked well for you and appreciate your support."
    if sentiment == "negative":
        return f"We are sorry to hear about your experience with {product_name}. Please share your order details so we can resolve this quickly."
    return f"Thanks for your review of {product_name}. We value your input and will use it to improve future experiences."


def process_pending_reviews(session: Session) -> int:
    reviews = session.query(Review).filter(Review.status == "pending").all()
    processed = 0
    for review in reviews:
        product = session.query(Product).filter(Product.id == review.product_id).one_or_none()
        product_name = product.name if product else "this product"
        sentiment, confidence, escalated, reason = classify_review(review.text, review.stars)

        review.sentiment = sentiment
        review.sentiment_confidence = confidence
        review.sentiment_source = "rule_based"
        review.escalated = escalated
        review.escalation_reason = reason
        review.processed_at = datetime.utcnow()

        if escalated:
            review.status = "escalated"
            review.draft_response = None
        else:
            review.status = "draft_ready"
            review.draft_response = build_draft_response(product_name, sentiment)

        processed += 1

    return processed
