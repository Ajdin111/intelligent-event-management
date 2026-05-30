"""add published_at to events

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-05-30

"""
from alembic import op
import sqlalchemy as sa

revision = 'f6a7b8c9d0e1'
down_revision = 'e5f6a7b8c9d0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('events', sa.Column('published_at', sa.DateTime(), nullable=True))
    # Backfill: use updated_at as best estimate for already-published events
    op.execute("""
        UPDATE events
        SET published_at = updated_at
        WHERE status = 'published' AND published_at IS NULL
    """)


def downgrade() -> None:
    op.drop_column('events', 'published_at')
