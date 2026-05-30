"""ml schema cleanup: drop ticket_tier_id, add model_version to recommendations

Revision ID: g7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-05-30

"""
from alembic import op
import sqlalchemy as sa

revision = 'g7b8c9d0e1f2'
down_revision = 'f6a7b8c9d0e1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint('ml_demand_forecasts_ticket_tier_id_fkey', 'ml_demand_forecasts', type_='foreignkey')
    op.drop_column('ml_demand_forecasts', 'ticket_tier_id')
    op.add_column('ml_recommendations', sa.Column('model_version', sa.String(50), nullable=True))


def downgrade() -> None:
    op.drop_column('ml_recommendations', 'model_version')
    op.add_column('ml_demand_forecasts', sa.Column('ticket_tier_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'ml_demand_forecasts_ticket_tier_id_fkey',
        'ml_demand_forecasts', 'ticket_tiers',
        ['ticket_tier_id'], ['id']
    )
