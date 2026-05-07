"""seed demo data (users, products, reviews, decisions)

Revision ID: 002_seed_demo_data
Revises: 001_initial_schema
Create Date: 2026-05-06
"""

from alembic import op
from sqlalchemy import text
import bcrypt
from datetime import datetime


revision = "002_seed_demo_data"
down_revision = "001_initial_schema"
branch_labels = None
depends_on = None


def _hash_password(password: str) -> str:
    """Hash password using bcrypt."""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def upgrade() -> None:
    """Seed demo users, products, and reviews."""
    
    # Hash passwords for demo users
    admin_hash = _hash_password("admin123")
    seller_hash = _hash_password("seller123")
    customer_hash = _hash_password("customer123")
    
    now = datetime.utcnow().isoformat()
    
    # Insert demo users
    op.execute(text(f"""
        INSERT OR IGNORE INTO users (user_id, email, name, account_type, password_hash, is_active, created_at)
        VALUES 
            ('USR_ADMIN_001', 'admin@vyapari.local', 'Vyapari Admin', 'admin', '{admin_hash}', 1, '{now}'),
            ('USR_SELLER_001', 'seller@vyapari.local', 'Default Seller', 'seller', '{seller_hash}', 1, '{now}'),
            ('USR_CUST_001', 'customer@vyapari.local', 'Test Customer', 'customer', '{customer_hash}', 1, '{now}');
    """))
    
    # Insert demo products (associated with seller)
    op.execute(text(f"""
        INSERT OR IGNORE INTO products (product_id, seller_id, name, category, price, cost, stock, created_at)
        VALUES 
            ('PRD_001', 'USR_SELLER_001', 'Wireless Headphones', 'Electronics', 1499.99, 900.0, 25, '{now}'),
            ('PRD_002', 'USR_SELLER_001', 'Running Shoes', 'Sports', 2999.00, 1700.0, 12, '{now}'),
            ('PRD_003', 'USR_SELLER_001', 'Cotton T-Shirt', 'Clothing', 699.00, 320.0, 50, '{now}'),
            ('PRD_004', 'USR_SELLER_001', 'Cooking Pan', 'Home & Kitchen', 1199.00, 650.0, 7, '{now}'),
            ('PRD_005', 'USR_SELLER_001', 'Data Structures Book', 'Books', 499.00, 220.0, 30, '{now}');
    """))
    
    # Insert demo reviews
    op.execute(text(f"""
        INSERT OR IGNORE INTO reviews (review_id, product_id, user_id, stars, text, status, sentiment, created_at)
        VALUES 
            ('REV_SEED_001', 'PRD_001', 'USR_001', 5, 'Excellent sound quality and battery life. Highly recommended!', 'approved', 'POSITIVE', '{now}'),
            ('REV_SEED_002', 'PRD_001', 'USR_002', 4, 'Comfortable to wear for long hours during commute.', 'approved', 'POSITIVE', '{now}'),
            ('REV_SEED_003', 'PRD_002', 'USR_003', 5, 'Great grip and very comfortable even for marathon training.', 'approved', 'POSITIVE', '{now}'),
            ('REV_SEED_004', 'PRD_003', 'USR_004', 3, 'Fabric is decent for the price but fades after few washes.', 'approved', 'NEUTRAL', '{now}'),
            ('REV_SEED_005', 'PRD_005', 'USR_005', 4, 'Good explanations and examples for learners.', 'approved', 'POSITIVE', '{now}');
    """))


def downgrade() -> None:
    """Remove seeded demo data."""
    op.execute(text("DELETE FROM reviews WHERE review_id LIKE 'REV_SEED_%'"))
    op.execute(text("DELETE FROM products WHERE product_id LIKE 'PRD_%'"))
    op.execute(text("DELETE FROM users WHERE user_id IN ('USR_ADMIN_001', 'USR_SELLER_001', 'USR_CUST_001')"))
