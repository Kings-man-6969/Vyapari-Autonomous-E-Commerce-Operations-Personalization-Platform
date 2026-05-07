"""initial schema with auth and hitl constraints

Revision ID: 001_initial_schema
Revises:
Create Date: 2026-05-06
"""

from alembic import op
import sqlalchemy as sa


revision = "001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("account_type", sa.String(), nullable=False),
        sa.Column("password_hash", sa.String(), nullable=False),
        sa.Column("is_active", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("last_login", sa.DateTime(), nullable=True),
        sa.CheckConstraint("account_type in ('customer', 'seller', 'admin')", name="ck_users_account_type"),
        sa.UniqueConstraint("user_id"),
        sa.UniqueConstraint("email"),
    )

    op.create_table(
        "products",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("product_id", sa.String(), nullable=False),
        sa.Column("seller_id", sa.String(), nullable=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("category", sa.String(), nullable=True),
        sa.Column("price", sa.Float(), nullable=False),
        sa.Column("cost", sa.Float(), nullable=False),
        sa.Column("stock", sa.Integer(), nullable=False),
        sa.Column("image_url", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.CheckConstraint("stock >= 0", name="ck_products_stock_nonnegative"),
        sa.CheckConstraint("price >= 0", name="ck_products_price_nonnegative"),
        sa.CheckConstraint("cost >= 0", name="ck_products_cost_nonnegative"),
        sa.CheckConstraint("price >= (cost * 1.10)", name="ck_products_price_guardrail"),
        sa.CheckConstraint(
            "category in ('Electronics', 'Clothing', 'Books', 'Home & Kitchen', 'Sports')",
            name="ck_products_category_enum",
        ),
        sa.ForeignKeyConstraint(["seller_id"], ["users.user_id"]),
        sa.UniqueConstraint("product_id"),
    )

    op.create_table(
        "reviews",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("review_id", sa.String(), nullable=False),
        sa.Column("product_id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=True),
        sa.Column("stars", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("status", sa.String(), nullable=True),
        sa.Column("sentiment", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.CheckConstraint("stars >= 1 and stars <= 5", name="ck_reviews_stars_range"),
        sa.CheckConstraint("length(text) >= 10 and length(text) <= 500", name="ck_reviews_text_length"),
        sa.ForeignKeyConstraint(["product_id"], ["products.product_id"]),
        sa.UniqueConstraint("review_id"),
    )

    op.create_table(
        "decisions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("decision_id", sa.String(), nullable=False),
        sa.Column("agent_type", sa.String(), nullable=False),
        sa.Column("product_id", sa.String(), nullable=False),
        sa.Column("decision_type", sa.String(), nullable=False),
        sa.Column("proposed_action", sa.Text(), nullable=False),
        sa.Column("confidence_score", sa.Float(), nullable=False),
        sa.Column("risk_level", sa.String(), nullable=False),
        sa.Column("decision_status", sa.String(), nullable=False),
        sa.Column("approval_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.CheckConstraint("confidence_score >= 0 and confidence_score <= 1", name="ck_decisions_confidence_range"),
        sa.CheckConstraint("risk_level in ('LOW', 'MEDIUM', 'HIGH')", name="ck_decisions_risk_level"),
        sa.CheckConstraint(
            "decision_status in ('pending', 'approved', 'rejected', 'auto_executed')",
            name="ck_decisions_status",
        ),
        sa.ForeignKeyConstraint(["product_id"], ["products.product_id"]),
        sa.UniqueConstraint("decision_id"),
    )


def downgrade() -> None:
    op.drop_table("decisions")
    op.drop_table("reviews")
    op.drop_table("products")
    op.drop_table("users")
