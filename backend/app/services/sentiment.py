from typing import Literal

Sentiment = Literal["POSITIVE", "NEGATIVE", "NEUTRAL"]

POSITIVE_WORDS = {
    "great", "excellent", "amazing", "love", "perfect", "wonderful",
    "outstanding", "fantastic", "brilliant", "superb", "best", "good",
    "happy", "satisfied", "recommend", "fast", "quality", "value",
    "beautiful", "awesome", "nice", "solid", "reliable", "impressed",
    "delighted", "pleased", "works", "comfortable", "durable", "sturdy",
    "smooth", "premium", "worth", "helpful", "efficient", "effective",
}

NEGATIVE_WORDS = {
    "terrible", "broken", "waste", "disappointed", "poor", "awful",
    "useless", "bad", "worst", "horrible", "defective", "refund",
    "return", "fraud", "fake", "slow", "never", "stopped", "damaged",
    "cheap", "flimsy", "faulty", "pathetic", "disgusting", "scam",
    "dreadful", "rotten", "lousy", "inferior", "failed", "failure",
    "problem", "issue", "complaint", "angry", "upset", "hate",
}


def classify_sentiment(text: str) -> tuple[Sentiment, float]:
    words = [w.strip(".,!?;:\"'") for w in text.lower().split()]
    pos_count = sum(1 for w in words if w in POSITIVE_WORDS)
    neg_count = sum(1 for w in words if w in NEGATIVE_WORDS)
    score = pos_count - neg_count
    total = pos_count + neg_count

    if total == 0:
        return "NEUTRAL", 0.70
    if score > 0:
        confidence = min(0.70 + (pos_count / (total + 2)) * 0.25, 0.95)
        return "POSITIVE", round(confidence, 2)
    elif score < 0:
        confidence = min(0.70 + (neg_count / (total + 2)) * 0.25, 0.95)
        return "NEGATIVE", round(confidence, 2)
    else:
        return "NEUTRAL", 0.65
