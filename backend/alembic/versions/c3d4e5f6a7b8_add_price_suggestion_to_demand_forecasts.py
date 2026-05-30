"""Add price_suggestion and price_action to ml_demand_forecasts

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-04-29 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'ml_demand_forecasts',
        sa.Column('price_suggestion', sa.Numeric(precision=10, scale=2), nullable=True),
    )
    op.add_column(
        'ml_demand_forecasts',
        sa.Column('price_action', sa.String(length=20), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('ml_demand_forecasts', 'price_action')
    op.drop_column('ml_demand_forecasts', 'price_suggestion')