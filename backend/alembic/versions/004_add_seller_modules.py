"""add seller inventory, pricing, and review management tables

Revision ID: 004_add_seller_modules
Revises: 003_add_refresh_tokens
Create Date: 2026-05-06
"""

from alembic import op
import sqlalchemy as sa


revision = "004_add_seller_modules"
down_revision = "003_add_refresh_tokens"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add tables for seller inventory, pricing, and review management."""
    
    # Price history table for tracking price changes
    op.create_table(
        'price_history',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('price_history_id', sa.String(), unique=True, nullable=False, index=True),
        sa.Column('product_id', sa.String(), sa.ForeignKey('products.product_id'), nullable=False),
        sa.Column('old_price', sa.Float(), nullable=False),
        sa.Column('new_price', sa.Float(), nullable=False),
        sa.Column('changed_by', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )
    
    # Review response table for seller responses to reviews
    op.create_table(
        'review_responses',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('response_id', sa.String(), unique=True, nullable=False, index=True),
        sa.Column('review_id', sa.String(), sa.ForeignKey('reviews.review_id'), nullable=False),
        sa.Column('seller_id', sa.String(), sa.ForeignKey('users.user_id'), nullable=False),
        sa.Column('response_text', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )
    
    # Inventory log table for tracking inventory changes
    op.create_table(
        'inventory_log',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('log_id', sa.String(), unique=True, nullable=False, index=True),
        sa.Column('product_id', sa.String(), sa.ForeignKey('products.product_id'), nullable=False),
        sa.Column('old_stock', sa.Integer(), nullable=False),
        sa.Column('new_stock', sa.Integer(), nullable=False),
        sa.Column('reason', sa.String(), nullable=True),
        sa.Column('changed_by', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    """Remove seller management tables."""
    op.drop_table('inventory_log')
    op.drop_table('review_responses')
    op.drop_table('price_history')
