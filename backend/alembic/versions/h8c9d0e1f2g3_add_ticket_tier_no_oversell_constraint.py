"""Add check constraint preventing ticket_tier oversell

Revision ID: h8c9d0e1f2g3
Revises: g7b8c9d0e1f2
Create Date: 2026-06-03

"""
from alembic import op

revision = 'h8c9d0e1f2g3'
down_revision = 'g7b8c9d0e1f2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_check_constraint(
        'ck_ticket_tier_no_oversell',
        'ticket_tiers',
        'quantity_sold <= quantity',
    )


def downgrade() -> None:
    op.drop_constraint('ck_ticket_tier_no_oversell', 'ticket_tiers', type_='check')
