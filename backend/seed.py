"""
Vyapari Database Seeder
Run from backend/ directory: python seed.py
"""
import sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
import os
import uuid
import json
import random
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from passlib.context import CryptContext
from app.database import SessionLocal, Base, engine
from app.models import (
    User, Product, Rating, Review, Order, OrderItem,
    WishlistItem, CompetitorPrice, Decision
)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def uid(): return str(uuid.uuid4())
def now(): return datetime.now(timezone.utc).isoformat()
def days_ago(n): return (datetime.now(timezone.utc) - timedelta(days=n)).isoformat()


# ─── Wipe & recreate DB ───────────────────────────────────────────────────────
db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "vyapari.db")
if os.path.exists(db_path):
    os.remove(db_path)
    print("🗑  Removed old database.")

Base.metadata.create_all(bind=engine)
db = SessionLocal()

# ─── Users ────────────────────────────────────────────────────────────────────
admin_id    = uid()
seller_id   = uid()
cust1_id    = uid()
cust2_id    = uid()
cust3_id    = uid()

users = [
    User(user_id=admin_id,  email="admin@vyapari.com",    name="Admin User",    password_hash=pwd_context.hash("demo123"), account_type="admin",    created_at=days_ago(90), is_active=True),
    User(user_id=seller_id, email="seller@vyapari.com",   name="Vikram Stores", password_hash=pwd_context.hash("demo123"), account_type="seller",   created_at=days_ago(60), is_active=True),
    User(user_id=cust1_id,  email="customer@vyapari.com", name="Ravi Sharma",   password_hash=pwd_context.hash("demo123"), account_type="customer", created_at=days_ago(30), is_active=True),
    User(user_id=cust2_id,  email="priya@vyapari.com",    name="Priya Patel",   password_hash=pwd_context.hash("demo123"), account_type="customer", created_at=days_ago(25), is_active=True),
    User(user_id=cust3_id,  email="arjun@vyapari.com",    name="Arjun Singh",   password_hash=pwd_context.hash("demo123"), account_type="customer", created_at=days_ago(20), is_active=True),
]
for u in users:
    db.add(u)
db.commit()

# ─── Products ─────────────────────────────────────────────────────────────────
product_data = [
    # Electronics (12)
    ("Wireless Noise-Cancelling Headphones", "Electronics", "Premium wireless headphones with 40-hour battery life and active noise cancellation technology.", 3499, 1800, 45, "ELEC-001", "🎧"),
    ("Bluetooth Speaker Portable",           "Electronics", "Waterproof portable speaker with 360° surround sound and 24-hour playback.",                      1999, 1000, 32, "ELEC-002", "🔊"),
    ("Smart LED Desk Lamp",                  "Electronics", "Touch-controlled LED lamp with 5 brightness levels and USB charging port.",                        899,  450,  3,  "ELEC-003", "💡"),
    ("Mechanical Gaming Keyboard",           "Electronics", "RGB backlit mechanical keyboard with Cherry MX switches and anti-ghosting technology.",            2499, 1300, 18, "ELEC-004", "⌨️"),
    ("Wireless Mouse Ergonomic",             "Electronics", "Silent wireless mouse with 6-button programmable layout and 18-month battery life.",               799,  400,  55, "ELEC-005", "🖱️"),
    ("USB-C Fast Charger 65W",               "Electronics", "65W GaN fast charger supports PD 3.0 for laptops, phones, and tablets simultaneously.",           1299, 650,  5,  "ELEC-006", "🔌"),
    ("Action Camera 4K",                     "Electronics", "4K 60fps action camera with EIS stabilization and waterproof to 10m depth.",                      7999, 4200, 12, "ELEC-007", "📷"),
    ("Smart Watch Fitness Band",             "Electronics", "Track heart rate, SpO2, sleep quality. 7-day battery, IP68 waterproof certified.",                2999, 1500, 28, "ELEC-008", "⌚"),
    ("Gaming Headset 7.1 Surround",         "Electronics", "7.1 surround sound gaming headset with noise-cancelling mic and RGB lighting.",                   1799, 900,  4,  "ELEC-009", "🎮"),
    ("Portable Power Bank 20000mAh",        "Electronics", "20000mAh fast-charge power bank with dual USB-C output and LCD display.",                         1499, 750,  22, "ELEC-010", "🔋"),
    ("Webcam 1080p HD",                     "Electronics", "Full HD webcam with built-in stereo mic, auto light correction, plug & play setup.",               1999, 1000, 2,  "ELEC-011", "📹"),
    ("Smart Plug WiFi",                     "Electronics", "Control home appliances remotely via app. Works with Alexa & Google Home.",                        599,  280,  67, "ELEC-012", "🔌"),
    # Clothing (10)
    ("Premium Cotton Kurta Men",            "Clothing", "Handwoven pure cotton kurta with intricate embroidery. Available in 5 vibrant colors.",             1299, 600,  35, "CLTH-001", "👘"),
    ("Women Ethnic Anarkali Set",           "Clothing", "Flared Anarkali suit with dupatta. Festive-wear georgette fabric with zari work.",                  2499, 1200, 20, "CLTH-002", "👗"),
    ("Men Slim Fit Chinos",                 "Clothing", "Stretchable slim-fit chinos, wrinkle-resistant, 4-way stretch. Perfect for office.",                999,  480,  48, "CLTH-003", "👖"),
    ("Women Casual Kurti",                  "Clothing", "Rayon printed kurti — lightweight, breathable, perfect for everyday comfort.",                      599,  270,  6,  "CLTH-004", "👚"),
    ("Men Formal Shirt White",              "Clothing", "Premium cotton formal shirt, anti-wrinkle, easy-iron finish. Office-ready.",                         799,  380,  3,  "CLTH-005", "👔"),
    ("Women Track Pants",                   "Clothing", "High-waist gym track pants with side pockets and quick-dry fabric.",                                699,  320,  30, "CLTH-006", "🩳"),
    ("Men Linen Shirt Summer",              "Clothing", "Pure linen shirt, perfect for Indian summers. Relaxed fit with mandarin collar.",                   1199, 580,  15, "CLTH-007", "👕"),
    ("Women Winter Jacket",                 "Clothing", "Water-resistant quilted jacket with warm filler. Puffer style for cold weather.",                   2999, 1500, 8,  "CLTH-008", "🧥"),
    ("Men Sports T-Shirt Dry-Fit",          "Clothing", "Quick-dry polyester sports tee with mesh ventilation panels for intense workouts.",                  499,  220,  52, "CLTH-009", "🥋"),
    ("Women Salwar Kameez Set",             "Clothing", "Ready-to-stitch Punjabi salwar kameez in vibrant block print with dupatta.",                        1599, 780,  12, "CLTH-010", "👘"),
    # Books (10)
    ("Atomic Habits",                       "Books", "James Clear's life-changing guide to building good habits and breaking bad ones.",                    449,  180,  80, "BOOK-001", "📚"),
    ("The Psychology of Money",             "Books", "Timeless lessons on wealth, greed, and happiness by Morgan Housel.",                                  399,  160,  65, "BOOK-002", "💰"),
    ("Deep Work",                           "Books", "Cal Newport's rules for focused success in a distracted world.",                                      399,  160,  55, "BOOK-003", "🧠"),
    ("Rich Dad Poor Dad",                   "Books", "The classic personal finance book by Robert T. Kiyosaki.",                                             299,  120,  90, "BOOK-004", "📖"),
    ("Zero to One",                         "Books", "Peter Thiel's notes on startups, or how to build the future.",                                       499,  200,  40, "BOOK-005", "🚀"),
    ("The Alchemist",                       "Books", "Paulo Coelho's magical fable about following your dreams. International bestseller.",                 249,  100, 100, "BOOK-006", "✨"),
    ("Ikigai: The Japanese Secret",         "Books", "Find your purpose and live a long, happy life with the Japanese ikigai philosophy.",                  349,  140,  72, "BOOK-007", "🌸"),
    ("Think and Grow Rich",                 "Books", "Napoleon Hill's classic on the psychology of achievement and building wealth.",                        299,  120,  60, "BOOK-008", "💡"),
    ("The Lean Startup",                    "Books", "Eric Ries on how entrepreneurs use continuous innovation to create businesses.",                       549,  220,  35, "BOOK-009", "🏭"),
    ("Sapiens",                             "Books", "Yuval Noah Harari's brief history of humankind — from apes to the digital age.",                      599,  240,  45, "BOOK-010", "🌍"),
    # Home & Kitchen (10)
    ("Stainless Steel Pressure Cooker 5L", "Home & Kitchen", "ISI-certified 5L pressure cooker with safety valve. Induction compatible.",                         1299, 650,  25, "HOME-001", "🍲"),
    ("Non-Stick Cookware Set 5-Piece",     "Home & Kitchen", "Granite finish non-stick set — kadai, tawa, saucepan with glass lids.",                             2499, 1200, 3,  "HOME-002", "🍳"),
    ("Electric Kettle 1.8L",              "Home & Kitchen", "1800W fast boil kettle, borosilicate glass body, auto shut-off safety.",                            899,  440,  18, "HOME-003", "☕"),
    ("Air Fryer 4L Digital",              "Home & Kitchen", "4L digital air fryer with 8 presets, touchscreen display, BPA-free basket.",                         3999, 2000, 7,  "HOME-004", "🍟"),
    ("Bamboo Cutting Board Set",          "Home & Kitchen", "Set of 3 eco-friendly bamboo cutting boards with juice groove and anti-slip feet.",                   599,  280,  40, "HOME-005", "🪵"),
    ("Vacuum Food Storage Containers",    "Home & Kitchen", "Set of 5 airtight vacuum containers — keeps food fresh 5x longer.",                                  799,  380,  22, "HOME-006", "🫙"),
    ("Wooden Wall Clock Minimalist",      "Home & Kitchen", "Silent sweep mechanism wooden clock. Nordic minimalist design for any room.",                         699,  320,  5,  "HOME-007", "🕐"),
    ("Aromatherapy Diffuser Humidifier",  "Home & Kitchen", "500ml ultrasonic humidifier with 7-color LED and timer. Whisper quiet operation.",                   1199, 580,  14, "HOME-008", "💧"),
    ("Stainless Steel Water Bottle 1L",  "Home & Kitchen", "Double-wall insulated bottle. Keeps hot 12h, cold 24h. Leak-proof lid.",                             699,  330,  60, "HOME-009", "🍶"),
    ("Hanging Kitchen Organizer",        "Home & Kitchen", "Stainless steel wall-mounted kitchen storage rack with 6 hooks and 2 shelves.",                       499,  230,  35, "HOME-010", "🪝"),
    # Sports (8)
    ("Yoga Mat Non-Slip Premium",        "Sports", "6mm thick premium yoga mat with alignment lines. Eco-friendly TPE material.",                           899,  420,  30, "SPRT-001", "🧘"),
    ("Adjustable Dumbbell Set 20kg",     "Sports", "Space-saving adjustable dumbbell set. Dial system, adjustable from 2-20kg.",                            7999, 4000, 4,  "SPRT-002", "🏋️"),
    ("Running Shoes Men",                "Sports", "Lightweight mesh running shoes with EVA midsole and anti-slip rubber grip.",                             2499, 1200, 22, "SPRT-003", "👟"),
    ("Resistance Band Set 5-Pack",       "Sports", "Latex resistance bands — from light to extra heavy. Essential home workout tool.",                       599,  270,  45, "SPRT-004", "💪"),
    ("Jump Rope Speed Cable",            "Sports", "Professional speed jump rope with precision ball bearings and adjustable cable.",                        399,  180,  38, "SPRT-005", "🪢"),
    ("Badminton Racket Set",             "Sports", "Professional grade badminton set — 2 rackets, 3 shuttlecocks, zip carry bag.",                           1499, 700,  2,  "SPRT-006", "🏸"),
    ("Football Size 5 Professional",    "Sports", "FIFA-quality hand-stitched football. All-weather butyl rubber bladder inside.",                          999,  480,  15, "SPRT-007", "⚽"),
    ("Protein Shaker Bottle 700ml",     "Sports", "BPA-free shaker with mixing ball. Graduated markings, leak-proof flip lid.",                             349,  160,  55, "SPRT-008", "🥤"),
]

products = []
for i, (name, cat, desc, price, cost, stock, sku, img) in enumerate(product_data, 1):
    p = Product(
        product_id=f"PRD_{i:03d}",
        seller_id=seller_id,
        name=name, category=cat, description=desc,
        price=float(price), cost=float(cost), stock=stock, sku=sku, image_url=img,
        avg_rating=0.0, review_count=0,
        created_at=days_ago(random.randint(5, 60)),
        updated_at=now(),
    )
    products.append(p)
    db.add(p)
db.commit()
print(f"✅ Products: {len(products)}")

# ─── Competitor Prices ────────────────────────────────────────────────────────
for p in products:
    base = p.price
    # Electronics tend to be overpriced vs competitors for demo
    if p.category == "Electronics" and random.random() > 0.4:
        comp_a = round(base * random.uniform(0.80, 0.89), 2)
        comp_b = round(base * random.uniform(0.83, 0.91), 2)
        comp_c = round(base * random.uniform(0.82, 0.93), 2)
    else:
        comp_a = round(base * random.uniform(0.93, 1.10), 2)
        comp_b = round(base * random.uniform(0.95, 1.12), 2)
        comp_c = round(base * random.uniform(0.90, 1.08), 2)
    db.add(CompetitorPrice(
        price_id=uid(), product_id=p.product_id,
        competitor_a=comp_a, competitor_b=comp_b, competitor_c=comp_c,
        last_updated=days_ago(random.randint(0, 3)),
    ))
db.commit()
print("✅ Competitor prices seeded")

# ─── Ratings ──────────────────────────────────────────────────────────────────
all_pids = [p.product_id for p in products]
customers = [cust1_id, cust2_id, cust3_id]

for cust_id in customers:
    rated = random.sample(all_pids, min(35, len(all_pids)))
    for pid in rated:
        stars = random.choices([1,2,3,4,5], weights=[4,7,14,35,40])[0]
        db.add(Rating(
            rating_id=uid(), user_id=cust_id, product_id=pid,
            rating=stars, created_at=days_ago(random.randint(1, 30)),
        ))
db.commit()
total_ratings = db.query(Rating).count()
print(f"✅ Ratings: {total_ratings}")

# ─── Reviews + AI Processing ──────────────────────────────────────────────────
from app.services.sentiment import classify_sentiment
from app.services.review_response import generate_response

POSITIVE_TEXTS = [
    "Absolutely love this product! Works perfectly straight out of the box. Great build quality and the performance exceeded my expectations. Highly recommend to everyone!",
    "Fantastic product! The quality is top-notch and delivery was super fast. Very satisfied with my purchase. Will definitely buy again from this seller.",
    "Excellent value for money. Works exactly as described. The build quality feels premium. Highly recommend!",
    "Best purchase I made this year. The performance is outstanding and battery life is incredible. 5 stars without hesitation!",
    "Great quality and comfortable to use. The product held up well after weeks of daily use. Fast delivery and well packaged.",
    "Amazing quality for the price. Sturdy construction and works perfectly. Very happy with this purchase!",
    "Love this product! Exactly what I needed. Durable material and solid performance. Highly recommend for anyone looking for good value.",
]

NEGATIVE_TEXTS = [
    "Very disappointed with this product. Stopped working after just 2 weeks of normal use. Poor quality and terrible customer service experience.",
    "Waste of money! The product arrived damaged and quality is nothing like the description. Asking for a refund. Very bad experience.",
    "Broken out of the box. The item is defective and inferior quality. Never buying from here again.",
    "Worst purchase ever! The product is cheap and flimsy. Failed after one week. I feel completely cheated.",
]

NEUTRAL_TEXTS = [
    "The product is okay for the price. Nothing extraordinary but gets the job done. Delivery was on time. Average quality.",
    "Decent product. Works as expected. Nothing special but serves the purpose. Average experience overall.",
    "It is what it is. Quality matches the price point. No major complaints but nothing impressive either.",
]

review_counter = 1
review_assignments = []
for p in products:
    n = random.randint(1, 3)
    reviewers = random.sample(customers, min(n, 3))
    for cust_id in reviewers:
        review_assignments.append((p, cust_id))

random.shuffle(review_assignments)

for p, cust_id in review_assignments[:65]:
    r_id = f"REV_{review_counter:04d}"
    review_counter += 1

    # Mix sentiment
    choice = random.choices(["POS","NEG","NEU"], weights=[65, 20, 15])[0]
    if choice == "POS":
        text = random.choice(POSITIVE_TEXTS)
        stars = random.choices([3,4,5], weights=[10,35,55])[0]
    elif choice == "NEG":
        text = random.choice(NEGATIVE_TEXTS)
        stars = random.choices([1,2], weights=[50,50])[0]
    else:
        text = random.choice(NEUTRAL_TEXTS)
        stars = random.choices([2,3,4], weights=[20,60,20])[0]

    sentiment, _ = classify_sentiment(text)
    response_text, resp_conf, risk = generate_response(text, sentiment, stars, p.name, p.category)

    # Pre-process older reviews
    is_processed = review_counter < 52

    if is_processed and risk == "LOW" and response_text:
        resp_status = "published"
        resp_pub = days_ago(random.randint(0, 5))
        rev_status = "published"
    elif is_processed and risk == "MEDIUM" and response_text:
        resp_status = "draft"
        resp_pub = None
        rev_status = "published"
    elif is_processed and risk == "HIGH":
        resp_status = None
        response_text = None
        resp_pub = None
        rev_status = "published"
    else:
        resp_status = None
        response_text = None
        resp_pub = None
        rev_status = "published"
        sentiment = None

    rev = Review(
        review_id=r_id,
        product_id=p.product_id,
        user_id=cust_id,
        stars=stars,
        text=text,
        sentiment=sentiment,
        status=rev_status,
        agent_response=response_text,
        response_status=resp_status,
        response_published_at=resp_pub,
        created_at=days_ago(random.randint(1, 25)),
        processed_at=days_ago(random.randint(0, 5)) if is_processed else None,
    )
    db.add(rev)

    # Update product avg_rating
    p.review_count = (p.review_count or 0) + 1
    total = (p.avg_rating or 0) * (p.review_count - 1) + stars
    p.avg_rating = round(total / p.review_count, 1)

db.commit()
print(f"✅ Reviews: {review_counter - 1}")

# ─── Orders ───────────────────────────────────────────────────────────────────
order_counter = 1
for _ in range(30):
    cust = random.choice(customers)
    order_prods = random.sample(products, random.randint(1, 4))
    total_amt = 0.0
    items_data = []
    for p in order_prods:
        qty = random.randint(1, 3)
        total_amt += p.price * qty
        items_data.append((p, qty))

    status = random.choices(["placed","processing","shipped","delivered"], weights=[10,15,25,50])[0]
    o_id = f"ORD_{order_counter:04d}"
    order_counter += 1
    order = Order(
        order_id=o_id, customer_id=cust, status=status,
        total_amount=round(total_amt, 2),
        shipping_address=json.dumps({
            "name": "Demo Customer", "street": "123 MG Road",
            "city": "Kanpur", "state": "UP", "pincode": "208001", "phone": "9876543210"
        }),
        created_at=days_ago(random.randint(0, 30)),
        updated_at=now(),
    )
    db.add(order)
    for p, qty in items_data:
        db.add(OrderItem(
            order_item_id=uid(), order_id=o_id,
            product_id=p.product_id, product_name=p.name,
            qty=qty, unit_price=p.price,
        ))
db.commit()
print(f"✅ Orders: {order_counter - 1}")

# ─── Pre-seeded Decisions ─────────────────────────────────────────────────────
dec_counter = 1

# Inventory decisions for critical stock products
critical_prods = [p for p in products if p.stock < 7]
for p in critical_prods[:6]:
    d_id = f"DEC_{dec_counter:04d}"; dec_counter += 1
    conf = random.uniform(0.72, 0.92)
    risk = "LOW" if conf >= 0.85 else "MEDIUM"
    status = "auto_executed" if (risk == "LOW" and random.random() > 0.5) else "pending"
    days_rem = p.stock / max(0.5, random.uniform(0.5, 2.0))
    db.add(Decision(
        decision_id=d_id, agent_type="INVENTORY",
        product_id=p.product_id, decision_type="RESTOCK",
        proposed_action=json.dumps({
            "action": "RESTOCK", "current_stock": p.stock,
            "avg_daily_sales": round(random.uniform(0.5, 2.5), 1),
            "days_remaining": round(days_rem, 1),
            "suggested_qty": 50,
            "reason": f"Stock critically low — estimated {int(days_rem)} days remaining",
        }),
        confidence_score=round(conf, 2), risk_level=risk,
        decision_status=status,
        created_at=days_ago(random.randint(0, 5)), updated_at=now(),
    ))

# Pricing decisions
elec = [p for p in products if p.category == "Electronics"][:8]
for p in elec[:7]:
    d_id = f"DEC_{dec_counter:04d}"; dec_counter += 1
    comp_min = p.price * random.uniform(0.80, 0.90)
    diff = round((p.price - comp_min) / comp_min * 100, 1)
    suggested = round(max(p.cost * 1.10, comp_min * 1.03), 2)
    conf = round(random.uniform(0.70, 0.92), 2)
    risk = "MEDIUM" if diff > 15 else "LOW"
    status = random.choice(["pending", "pending", "approved", "auto_executed"])
    db.add(Decision(
        decision_id=d_id, agent_type="PRICING",
        product_id=p.product_id, decision_type="PRICE_ADJUST",
        proposed_action=json.dumps({
            "action": "PRICE_ADJUST", "current_price": p.price,
            "min_competitor": round(comp_min, 2), "price_diff_pct": diff,
            "suggested_price": suggested,
            "reason": f"Our price is {diff:.1f}% above minimum competitor. Suggest ₹{suggested}",
        }),
        confidence_score=conf, risk_level=risk,
        decision_status=status,
        created_at=days_ago(random.randint(0, 7)), updated_at=now(),
    ))

# Review-response decisions (for negative reviews)
neg_revs = db.query(Review).filter(Review.sentiment == "NEGATIVE").limit(8).all()
for rev in neg_revs:
    d_id = f"DEC_{dec_counter:04d}"; dec_counter += 1
    is_high = rev.stars == 1
    conf = 0.45 if is_high else 0.72
    risk = "HIGH" if is_high else "MEDIUM"
    status = "pending" if is_high else random.choice(["pending", "pending", "approved"])
    db.add(Decision(
        decision_id=d_id, agent_type="REVIEW_RESPONSE",
        product_id=rev.product_id, review_id=rev.review_id,
        decision_type="REVIEW_DRAFT",
        proposed_action=json.dumps({
            "action": "REVIEW_DRAFT", "stars": rev.stars,
            "sentiment": rev.sentiment, "review_text": rev.text[:120],
            "proposed_response": rev.agent_response or "Escalated — manual handling required",
        }),
        confidence_score=conf, risk_level=risk,
        decision_status=status,
        created_at=days_ago(random.randint(0, 5)), updated_at=now(),
    ))

db.commit()
db.close()

total_decs = dec_counter - 1
print(f"✅ Decisions: {total_decs}")
print()
print("=" * 50)
print("🚀 Database seeded successfully!")
print("=" * 50)
print()
print("Demo Credentials:")
print("  Seller:    seller@vyapari.com   / demo123")
print("  Customer:  customer@vyapari.com / demo123")
print("  Admin:     admin@vyapari.com    / demo123")
print()
print("Start backend: uvicorn app.main:app --reload --port 8000")
