"""add refresh token support to users

Revision ID: 003_add_refresh_tokens
Revises: 002_seed_demo_data
Create Date: 2026-05-06
"""

from alembic import op
import sqlalchemy as sa


revision = "003_add_refresh_tokens"
down_revision = "002_seed_demo_data"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add refresh token columns to users table."""
    op.add_column('users', sa.Column('refresh_token', sa.String(), nullable=True))
    op.add_column('users', sa.Column('refresh_token_expires_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    """Remove refresh token columns from users table."""
    op.drop_column('users', 'refresh_token_expires_at')
    op.drop_column('users', 'refresh_token')
