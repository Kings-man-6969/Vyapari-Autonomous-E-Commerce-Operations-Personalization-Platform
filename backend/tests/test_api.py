from fastapi.testclient import TestClient
import bcrypt

from app.main import app
from app.database import Base, engine, SessionLocal
from app import models


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def _client():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    # Seed demo data for tests
    db = SessionLocal()
    
    # Create demo users
    users = [
        models.User(user_id="USR_ADMIN_001", email="admin@vyapari.local", name="Vyapari Admin", account_type="admin", password_hash=_hash_password("admin123"), is_active=1),
        models.User(user_id="USR_SELLER_001", email="seller@vyapari.local", name="Default Seller", account_type="seller", password_hash=_hash_password("seller123"), is_active=1),
        models.User(user_id="USR_CUST_001", email="customer@vyapari.local", name="Test Customer", account_type="customer", password_hash=_hash_password("customer123"), is_active=1),
    ]
    for user in users:
        db.add(user)
    db.commit()
    
    # Create demo products
    products = [
        models.Product(product_id="PRD_001", seller_id="USR_SELLER_001", name="Wireless Headphones", category="Electronics", price=1499.99, cost=900.0, stock=25),
        models.Product(product_id="PRD_002", seller_id="USR_SELLER_001", name="Running Shoes", category="Sports", price=2999.00, cost=1700.0, stock=12),
        models.Product(product_id="PRD_003", seller_id="USR_SELLER_001", name="Cotton T-Shirt", category="Clothing", price=699.00, cost=320.0, stock=50),
        models.Product(product_id="PRD_004", seller_id="USR_SELLER_001", name="Cooking Pan", category="Home & Kitchen", price=1199.00, cost=650.0, stock=7),
        models.Product(product_id="PRD_005", seller_id="USR_SELLER_001", name="Data Structures Book", category="Books", price=499.00, cost=220.0, stock=30),
    ]
    for product in products:
        db.add(product)
    db.commit()
    
    # Create demo reviews
    reviews = [
        models.Review(review_id="REV_SEED_001", product_id="PRD_001", user_id="USR_001", stars=5, text="Excellent sound quality and battery life.", status="approved", sentiment="POSITIVE"),
        models.Review(review_id="REV_SEED_002", product_id="PRD_001", user_id="USR_002", stars=4, text="Comfortable to wear for long hours.", status="approved", sentiment="POSITIVE"),
        models.Review(review_id="REV_SEED_003", product_id="PRD_002", user_id="USR_003", stars=5, text="Great grip and very comfortable.", status="approved", sentiment="POSITIVE"),
        models.Review(review_id="REV_SEED_004", product_id="PRD_003", user_id="USR_004", stars=3, text="Fabric is decent for the price.", status="approved", sentiment="NEUTRAL"),
        models.Review(review_id="REV_SEED_005", product_id="PRD_005", user_id="USR_005", stars=4, text="Good explanations and examples.", status="approved", sentiment="POSITIVE"),
    ]
    for review in reviews:
        db.add(review)
    db.commit()
    
    # Create demo decisions
    decisions = [
        models.Decision(
            decision_id="DEC_1005",
            agent_type="INVENTORY",
            product_id="PRD_002",
            decision_type="RESTOCK",
            proposed_action='{"action":"restock","quantity":100}',
            confidence_score=0.78,
            risk_level="MEDIUM",
            decision_status="pending",
        ),
        models.Decision(
            decision_id="DEC_1006",
            agent_type="PRICING",
            product_id="PRD_001",
            decision_type="PRICE_ADJUST",
            proposed_action='{"action":"adjust_price","new_price":1349}',
            confidence_score=0.92,
            risk_level="LOW",
            decision_status="auto_executed",
        ),
    ]
    for decision in decisions:
        db.add(decision)
    db.commit()
    db.close()
    
    return TestClient(app)


def _auth_headers(client):
    response = client.post('/auth/login', json={'email': 'admin@vyapari.local', 'password': 'admin123'})
    assert response.status_code == 200
    token = response.json()['access_token']
    return {'Authorization': f'Bearer {token}'}


def _login(client, email, password):
        response = client.post('/auth/login', json={'email': email, 'password': password})
        assert response.status_code == 200
        return response.json(), response.cookies


def test_health():
    client = _client()
    response = client.get('/health')
    assert response.status_code == 200
    assert response.json()['status'] == 'ok'


def test_products_contract():
    client = _client()
    response = client.get('/products')
    assert response.status_code == 200
    payload = response.json()
    assert 'products' in payload
    assert 'total' in payload
    assert payload['total'] >= 1


def test_search_and_recommendations():
    client = _client()
    search = client.get('/search?q=wireless&top_n=5')
    assert search.status_code == 200
    assert 'results' in search.json()

    recs = client.get('/recommendations/session_1?top_n=3')
    assert recs.status_code == 200
    assert len(recs.json()['recommendations']) == 3


def test_cart_add_and_read():
    client = _client()
    add = client.post('/cart/add?session_id=tester', json={'product_id': 'PRD_001', 'qty': 2})
    assert add.status_code == 200
    cart = add.json()
    assert cart['total'] > 0
    assert len(cart['items']) == 1


def test_hitl_approve_flow():
    client = _client()
    headers = _auth_headers(client)
    decisions = client.get('/hitl/decisions?status=pending', headers=headers)
    assert decisions.status_code == 200
    assert decisions.json()['total'] >= 1

    decision_id = decisions.json()['decisions'][0]['decision_id']
    approve = client.post(f'/hitl/decisions/{decision_id}/approve', json={'approver_id': 'ADMIN_001'}, headers=headers)
    assert approve.status_code == 200
    assert approve.json()['decision']['decision_status'] == 'approved'


def test_seller_stats_requires_auth():
    client = _client()
    unauth = client.get('/stats')
    assert unauth.status_code == 401

    headers = _auth_headers(client)
    authed = client.get('/stats', headers=headers)
    assert authed.status_code == 200
    assert 'total_products' in authed.json()


def test_refresh_flow_and_logout_revokes_session():
    client = _client()
    login_payload, _ = _login(client, 'seller@vyapari.local', 'seller123')
    first_token = login_payload['access_token']

    refreshed = client.post('/auth/refresh')
    assert refreshed.status_code == 200
    second_token = refreshed.json()['access_token']
    assert second_token

    me = client.get('/auth/me', headers={'Authorization': f'Bearer {second_token}'})
    assert me.status_code == 200
    assert me.json()['account_type'] == 'seller'

    logout = client.post('/auth/logout')
    assert logout.status_code == 200
    assert logout.json()['status'] == 'logged_out'

    revoked = client.post('/auth/refresh')
    assert revoked.status_code == 401


def test_seller_inventory_and_pricing_flow():
    client = _client()
    login_payload, _ = _login(client, 'seller@vyapari.local', 'seller123')
    headers = {'Authorization': f"Bearer {login_payload['access_token']}"}

    create = client.post('/products/seller', json={
        'name': 'Desk Lamp',
        'category': 'Home & Kitchen',
        'price': 899.0,
        'cost': 500.0,
        'stock': 8,
    }, headers=headers)
    assert create.status_code == 201
    product_id = create.json()['product_id']

    update = client.put(f'/products/{product_id}/seller', json={
        'price': 999.0,
        'stock': 11,
    }, headers=headers)
    assert update.status_code == 200
    assert update.json()['price'] == 999.0

    price_update = client.post(f'/products/{product_id}/price?new_price=1099', headers=headers)
    assert price_update.status_code == 200

    history = client.get(f'/products/{product_id}/price-history', headers=headers)
    assert history.status_code == 200
    assert len(history.json()['price_history']) >= 1

    inventory = client.get('/products/seller/inventory', headers=headers)
    assert inventory.status_code == 200
    assert any(item['product_id'] == product_id for item in inventory.json()['products'])


def test_seller_review_response_flow():
    client = _client()
    login_payload, _ = _login(client, 'seller@vyapari.local', 'seller123')
    headers = {'Authorization': f"Bearer {login_payload['access_token']}"}

    pending = client.get('/reviews/seller/pending', headers=headers)
    assert pending.status_code == 200
    assert pending.json()['total'] >= 1

    review_id = pending.json()['pending_reviews'][0]['review_id']
    response = client.post(f'/reviews/{review_id}/response', json={'response_text': 'Thanks for the thoughtful feedback. We will keep improving.'}, headers=headers)
    assert response.status_code == 200
    assert response.json()['review_id'] == review_id

    pending_after = client.get('/reviews/seller/pending', headers=headers)
    assert pending_after.status_code == 200
