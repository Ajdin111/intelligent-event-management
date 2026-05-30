"""Add added_by and status to event_collaborators

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-05-12 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'event_collaborators',
        sa.Column('added_by', sa.Integer(), nullable=True)
    )
    op.add_column(
        'event_collaborators',
        sa.Column('status', sa.String(length=20), nullable=False, server_default='pending')
    )
    op.create_foreign_key(
        'fk_event_collaborators_added_by',
        'event_collaborators',
        'users',
        ['added_by'],
        ['id']
    )


def downgrade() -> None:
    op.drop_constraint('fk_event_collaborators_added_by', 'event_collaborators', type_='foreignkey')
    op.drop_column('event_collaborators', 'status')
    op.drop_column('event_collaborators', 'added_by')