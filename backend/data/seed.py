"""
Run this once to generate mock data: python seed.py
"""
import json, random, os

random.seed(42)

CATEGORIES = ["Electronics", "Clothing", "Books", "Home & Kitchen", "Sports"]

PRODUCTS = [
    {"id": f"P{str(i).zfill(3)}", "name": name, "category": cat, "price": round(random.uniform(199, 4999), 2), "stock": random.randint(2, 120), "cost": 0}
    for i, (name, cat) in enumerate([
        ("Wireless Earbuds Pro", "Electronics"), ("USB-C Hub 7-in-1", "Electronics"),
        ("Mechanical Keyboard", "Electronics"), ("4K Webcam", "Electronics"),
        ("LED Desk Lamp", "Electronics"), ("Cotton Polo Shirt", "Clothing"),
        ("Running Shorts", "Clothing"), ("Yoga Pants", "Clothing"),
        ("Formal Trousers", "Clothing"), ("Winter Jacket", "Clothing"),
        ("Python Crash Course", "Books"), ("Deep Learning Book", "Books"),
        ("Atomic Habits", "Books"), ("Clean Code", "Books"),
        ("The Pragmatic Programmer", "Books"), ("Stainless Steel Bottle", "Home & Kitchen"),
        ("Air Fryer 4L", "Home & Kitchen"), ("Coffee Maker", "Home & Kitchen"),
        ("Non-Stick Pan Set", "Home & Kitchen"), ("Bamboo Cutting Board", "Home & Kitchen"),
        ("Resistance Bands Set", "Sports"), ("Yoga Mat Premium", "Sports"),
        ("Dumbbells 5kg Pair", "Sports"), ("Jump Rope Speed", "Sports"),
        ("Foam Roller", "Sports"),
    ], 1)
]

# Set cost as 60-75% of price
for p in PRODUCTS:
    p["cost"] = round(p["price"] * random.uniform(0.55, 0.70), 2)

# Users
USERS = [{"id": f"U{str(i).zfill(3)}", "name": f"User_{i}"} for i in range(1, 51)]

# Ratings (user-item interactions)
product_ids = [p["id"] for p in PRODUCTS]
RATINGS = []
for user in USERS:
    n_rated = random.randint(4, 12)
    rated_products = random.sample(product_ids, n_rated)
    for pid in rated_products:
        RATINGS.append({
            "user_id": user["id"],
            "product_id": pid,
            "rating": round(random.gauss(3.8, 0.9), 1).__round__(1)
        })
# Clamp ratings 1-5
for r in RATINGS:
    r["rating"] = max(1.0, min(5.0, r["rating"]))

# Competitor prices (5-15% variation)
COMPETITOR_PRICES = [
    {"product_id": p["id"], "competitor_price": round(p["price"] * random.uniform(0.85, 1.15), 2)}
    for p in PRODUCTS
]

# Reviews
REVIEW_TEXTS = {
    "positive": [
        "Amazing product! Works exactly as described. Very happy with the purchase.",
        "Great quality, fast delivery. Would definitely buy again.",
        "Exceeded my expectations. Highly recommended to everyone.",
        "Perfect fit and excellent build quality. Five stars!",
        "Value for money. Works perfectly right out of the box.",
    ],
    "negative": [
        "Very disappointing. Stopped working after just 3 days of use.",
        "Poor quality. Looks nothing like the photos on the website.",
        "Terrible experience. Arrived damaged and no response from support.",
        "Complete waste of money. Would not recommend to anyone.",
        "Product broke within a week. Requesting a refund immediately.",
    ],
    "neutral": [
        "Decent product for the price. Nothing extraordinary but does the job.",
        "Average quality. Shipping was fast though.",
        "It is okay. Not as good as expected but acceptable.",
        "Works fine. Instructions could be clearer.",
    ]
}

REVIEWS = []
for i in range(1, 31):
    sentiment = random.choices(["positive", "negative", "neutral"], weights=[0.5, 0.3, 0.2])[0]
    star_map = {"positive": random.randint(4, 5), "negative": random.randint(1, 2), "neutral": 3}
    pid = random.choice(product_ids)
    REVIEWS.append({
        "id": f"R{str(i).zfill(3)}",
        "product_id": pid,
        "user": f"Customer_{i}",
        "stars": star_map[sentiment],
        "text": random.choice(REVIEW_TEXTS[sentiment]),
        "status": "pending",
        "draft_response": None,
        "sentiment": None,
    })

# Sales velocity (units sold per day, last 7 days)
SALES_VELOCITY = {
    p["id"]: [random.randint(0, 8) for _ in range(7)]
    for p in PRODUCTS
}

output_dir = os.path.dirname(os.path.abspath(__file__))
for filename, data in [
    ("products.json", PRODUCTS),
    ("users.json", USERS),
    ("ratings.json", RATINGS),
    ("competitor_prices.json", COMPETITOR_PRICES),
    ("reviews.json", REVIEWS),
    ("sales_velocity.json", SALES_VELOCITY),
]:
    with open(os.path.join(output_dir, filename), "w") as f:
        json.dump(data, f, indent=2)

print(f"Seeded: {len(PRODUCTS)} products, {len(USERS)} users, {len(RATINGS)} ratings, {len(REVIEWS)} reviews")
