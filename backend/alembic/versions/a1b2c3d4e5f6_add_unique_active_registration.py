"""Add unique constraint for active registrations per user per event

Revision ID: a1b2c3d4e5f6
Revises: 24c95afa8c63
Create Date: 2026-04-25 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '24c95afa8c63'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Partial unique index: one active registration per user per event.
    # Cancelled and rejected registrations are excluded so users can re-register.
    op.create_index(
        'uq_active_registration',
        'registrations',
        ['event_id', 'user_id'],
        unique=True,
        postgresql_where=sa.text("status != 'cancelled' AND status != 'rejected'"),
    )


def downgrade() -> None:
    op.drop_index('uq_active_registration', table_name='registrations')
