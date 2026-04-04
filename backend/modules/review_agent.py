"""
Review Response Agent
- Sentiment classification via HuggingFace pipeline (distilbert)
- Response generation via OpenAI API (falls back to templates if no key)
- Escalation rules for critical reviews
"""
import json, os, re
from datetime import datetime

DATA_DIR = os.path.join(os.path.dirname(__file__), "../data")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

ESCALATION_KEYWORDS = [
    "refund", "broken", "dangerous", "hazard", "lawsuit", "fraud",
    "cheat", "scam", "injury", "injured", "fire", "explode", "defective"
]

# ── Sentiment pipeline (lazy load) ──
_sentiment_pipeline = None

def _get_sentiment_pipeline():
    global _sentiment_pipeline
    if _sentiment_pipeline is None:
        try:
            from transformers import pipeline
            _sentiment_pipeline = pipeline(
                "sentiment-analysis",
                model="distilbert-base-uncased-finetuned-sst-2-english",
                truncation=True,
                max_length=512,
            )
            print("[ReviewAgent] Sentiment pipeline loaded.")
        except Exception as e:
            print(f"[ReviewAgent] Pipeline load failed: {e}. Using rule-based fallback.")
    return _sentiment_pipeline

def _load(filename):
    with open(os.path.join(DATA_DIR, filename)) as f:
        return json.load(f)

def _save(filename, data):
    with open(os.path.join(DATA_DIR, filename), "w") as f:
        json.dump(data, f, indent=2)


def classify_sentiment(text: str) -> dict:
    pipe = _get_sentiment_pipeline()
    if pipe:
        result = pipe(text[:512])[0]
        label = result["label"].lower()  # POSITIVE / NEGATIVE
        score = result["score"]
        # Map to 3-class
        if label == "positive" and score > 0.75:
            sentiment = "positive"
        elif label == "negative" and score > 0.75:
            sentiment = "negative"
        else:
            sentiment = "neutral"
        return {"sentiment": sentiment, "confidence": round(score, 3), "source": "distilbert"}
    else:
        # Rule-based fallback
        text_lower = text.lower()
        pos_words = ["great", "amazing", "excellent", "love", "perfect", "happy", "good", "nice"]
        neg_words = ["terrible", "awful", "broken", "waste", "disappointed", "poor", "bad", "worst"]
        pos_score = sum(1 for w in pos_words if w in text_lower)
        neg_score = sum(1 for w in neg_words if w in text_lower)
        if pos_score > neg_score:
            return {"sentiment": "positive", "confidence": 0.70, "source": "rule_based"}
        elif neg_score > pos_score:
            return {"sentiment": "negative", "confidence": 0.70, "source": "rule_based"}
        return {"sentiment": "neutral", "confidence": 0.60, "source": "rule_based"}


def needs_escalation(text: str, stars: int) -> bool:
    text_lower = text.lower()
    has_keyword = any(kw in text_lower for kw in ESCALATION_KEYWORDS)
    return stars == 1 or has_keyword


def _generate_with_openai(review_text: str, sentiment: str, product_name: str) -> str:
    try:
        import openai
        client = openai.OpenAI(api_key=OPENAI_API_KEY)
        system_prompt = (
            "You are a professional customer support agent for Vyapari, an online store. "
            "Write a concise, empathetic, brand-consistent response to the customer review below. "
            "Keep it under 60 words. Be genuine, not robotic. Don't use 'Dear Customer'."
        )
        user_prompt = (
            f"Product: {product_name}\nSentiment: {sentiment}\nReview: {review_text}\n\nResponse:"
        )
        resp = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=120,
            temperature=0.7,
        )
        return resp.choices[0].message.content.strip()
    except Exception as e:
        print(f"[ReviewAgent] OpenAI failed: {e}. Using template.")
        return None


RESPONSE_TEMPLATES = {
    "positive": [
        "Thank you so much for your kind words! We're thrilled you're happy with your {product}. Your support means everything to us — see you again soon! 😊",
        "We're so glad your {product} hit the mark! Reviews like yours truly make our day. Thanks for choosing Vyapari!",
    ],
    "negative": [
        "We're really sorry to hear about your experience with the {product}. This isn't the standard we hold ourselves to. Please reach out to our support team and we'll make it right.",
        "Thank you for bringing this to our attention. We sincerely apologize for the inconvenience with your {product} and will do our best to resolve this promptly.",
    ],
    "neutral": [
        "Thanks for your honest feedback on the {product}! We're always working to improve. Hope to exceed your expectations next time.",
        "We appreciate you taking the time to share your thoughts on the {product}. Your feedback helps us do better.",
    ],
}

def generate_response(review_text: str, sentiment: str, product_name: str) -> str:
    if OPENAI_API_KEY:
        response = _generate_with_openai(review_text, sentiment, product_name)
        if response:
            return response
    import random
    template = random.choice(RESPONSE_TEMPLATES.get(sentiment, RESPONSE_TEMPLATES["neutral"]))
    return template.format(product=product_name)


def process_reviews() -> list[dict]:
    """Process all pending reviews — classify sentiment and generate response draft."""
    reviews = _load("reviews.json")
    products = _load("products.json")
    product_map = {p["id"]: p["name"] for p in products}
    processed = []

    for review in reviews:
        if review["status"] != "pending":
            continue
        product_name = product_map.get(review["product_id"], "our product")
        sentiment_result = classify_sentiment(review["text"])
        sentiment = sentiment_result["sentiment"]
        escalate = needs_escalation(review["text"], review["stars"])

        review["sentiment"] = sentiment
        review["sentiment_confidence"] = sentiment_result["confidence"]
        review["sentiment_source"] = sentiment_result["source"]
        review["escalated"] = escalate
        review["processed_at"] = datetime.now().isoformat()

        if escalate:
            review["status"] = "escalated"
            review["draft_response"] = None
            review["escalation_reason"] = (
                "1-star review" if review["stars"] == 1
                else "Contains escalation keyword"
            )
        else:
            draft = generate_response(review["text"], sentiment, product_name)
            review["draft_response"] = draft
            review["status"] = "draft_ready"

        processed.append(review)

    _save("reviews.json", reviews)
    return processed


def get_all_reviews() -> list[dict]:
    return _load("reviews.json")


def approve_response(review_id: str, final_response: str):
    reviews = _load("reviews.json")
    for r in reviews:
        if r["id"] == review_id:
            r["draft_response"] = final_response
            r["status"] = "published"
            r["published_at"] = datetime.now().isoformat()
    _save("reviews.json", reviews)


def reject_response(review_id: str):
    reviews = _load("reviews.json")
    for r in reviews:
        if r["id"] == review_id:
            r["status"] = "rejected"
    _save("reviews.json", reviews)
