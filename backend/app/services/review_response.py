import random
from typing import Optional


POSITIVE_TEMPLATES = {
    "Electronics": [
        "Thank you so much for your wonderful review of {name}! We're thrilled it exceeded your expectations. "
        "Your satisfaction is what drives us to keep innovating. Enjoy your purchase!",
        "We're delighted to hear {name} has been a great addition to your setup! "
        "Thank you for taking the time to share your experience with us.",
    ],
    "Clothing": [
        "So glad {name} was the perfect fit for you! Your kind words truly mean everything to our team. "
        "We hope you wear it with joy!",
        "Thank you for your lovely review of {name}! We put a lot of care into the quality and design, "
        "and it's wonderful to know it shows. Enjoy!",
    ],
    "Books": [
        "Delighted you enjoyed {name}! We hope it brought you both knowledge and joy. "
        "Happy reading!",
        "Thank you for your great review of {name}! Books have the power to change lives, "
        "and we're glad this one made a positive impact.",
    ],
    "Sports": [
        "Thank you for the amazing review of {name}! We're so glad it's helping you on your fitness journey. "
        "Keep crushing your goals!",
        "Fantastic to hear {name} is working great for you! Your enthusiasm inspires us. "
        "Keep up the great work!",
    ],
    "Home & Kitchen": [
        "We're so pleased {name} has found a home in your kitchen! Thank you for the wonderful review. "
        "Happy cooking!",
        "Thank you for your kind words about {name}! We're committed to quality you can count on every day.",
    ],
    "default": [
        "Thank you so much for your kind review! We're so happy you're satisfied with your purchase. "
        "Your support means the world to us!",
        "We really appreciate you taking the time to share your experience. Thank you for choosing us "
        "and for your wonderful feedback!",
    ],
}

NEGATIVE_TEMPLATES = {
    1: [
        "We are truly sorry to hear about your experience with {name}. This is absolutely not the standard "
        "we hold ourselves to. Please contact our support team immediately — we will make this right for you.",
        "We sincerely apologize for the serious inconvenience caused by your {name} purchase. "
        "Your feedback has been escalated to our quality assurance team as a top priority. "
        "Please reach out to us directly so we can resolve this immediately.",
    ],
    2: [
        "We're sorry {name} didn't meet your expectations. Your feedback is invaluable to us and has been "
        "shared with our quality team. We'd love the opportunity to make this right — please contact us.",
        "Thank you for bringing this to our attention. We sincerely apologize for the experience with {name}. "
        "We are taking your feedback seriously and working to improve. Please let us know how we can help.",
    ],
    3: [
        "Thank you for your honest feedback about {name}. We're sorry it didn't fully meet your expectations. "
        "We're constantly working to improve and your input helps us do that. We hope to serve you better.",
        "We appreciate your feedback on {name}. We're sorry the experience wasn't perfect. "
        "Please don't hesitate to reach out if there's anything we can do to improve your experience.",
    ],
}

NEUTRAL_TEMPLATES = [
    "Thank you for taking the time to review {name}. Your feedback helps us continuously improve "
    "our products and services for everyone.",
    "We appreciate your honest review of {name}. Thank you for being a valued customer. "
    "We hope to exceed your expectations on your next purchase!",
]


def generate_response(
    review_text: str,
    sentiment: str,
    stars: int,
    product_name: str,
    category: str,
) -> tuple[Optional[str], float, str]:
    """
    Returns (response_text, confidence_score, risk_level).
    response_text is None for HIGH-risk escalations.
    """
    name = product_name

    if sentiment == "POSITIVE":
        templates = POSITIVE_TEMPLATES.get(category, POSITIVE_TEMPLATES["default"])
        text = random.choice(templates).format(name=name)
        return text, 0.88, "LOW"

    if sentiment == "NEGATIVE":
        if stars == 1:
            # Escalate — no auto-draft for 1-star reviews
            return None, 0.45, "HIGH"
        star_templates = NEGATIVE_TEMPLATES.get(stars, NEGATIVE_TEMPLATES[3])
        text = random.choice(star_templates).format(name=name)
        return text, 0.72, "MEDIUM"

    # NEUTRAL
    text = random.choice(NEUTRAL_TEMPLATES).format(name=name)
    return text, 0.85, "LOW"
