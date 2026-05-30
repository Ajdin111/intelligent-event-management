"""Add soft delete to categories/tracks/sessions; rename session datetime columns

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-04-25 00:01:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('categories', sa.Column('deleted_at', sa.DateTime(), nullable=True))
    op.add_column('tracks', sa.Column('deleted_at', sa.DateTime(), nullable=True))
    op.add_column('sessions', sa.Column('deleted_at', sa.DateTime(), nullable=True))
    op.alter_column('sessions', 'start_time', new_column_name='start_datetime')
    op.alter_column('sessions', 'end_time', new_column_name='end_datetime')


def downgrade() -> None:
    op.alter_column('sessions', 'start_datetime', new_column_name='start_time')
    op.alter_column('sessions', 'end_datetime', new_column_name='end_time')
    op.drop_column('sessions', 'deleted_at')
    op.drop_column('tracks', 'deleted_at')
    op.drop_column('categories', 'deleted_at')
