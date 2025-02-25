"""init_db

Revision ID: 000
Revises:
Create Date: 2025-01-06 00:42:14.253167

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "000"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table(
        "datasets",
        sa.Column("_intid", sa.Integer(), nullable=False),
        sa.Column(
            "id",
            sa.String(),
            sa.Computed(
                "'DS' || _intid",
            ),
            nullable=False,
        ),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("file_path", sa.String(), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("_intid"),
        sa.UniqueConstraint("_intid"),
        sa.UniqueConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_table(
        "eval_runs",
        sa.Column("_intid", sa.Integer(), nullable=False),
        sa.Column(
            "id",
            sa.String(),
            sa.Computed(
                "'ER' || _intid",
            ),
            nullable=False,
        ),
        sa.Column("eval_name", sa.String(), nullable=False),
        sa.Column("workflow_id", sa.String(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "PENDING",
                "RUNNING",
                "COMPLETED",
                "FAILED",
                name="evalrunstatus",
            ),
            nullable=False,
        ),
        sa.Column("output_variable", sa.String(), nullable=False),
        sa.Column("num_samples", sa.Integer(), nullable=False),
        sa.Column("start_time", sa.DateTime(), nullable=True),
        sa.Column("end_time", sa.DateTime(), nullable=True),
        sa.Column("results", sa.JSON(), nullable=True),
        sa.PrimaryKeyConstraint("_intid"),
        sa.UniqueConstraint("id"),
    )
    op.create_table(
        "output_files",
        sa.Column("_intid", sa.Integer(), nullable=False),
        sa.Column(
            "id",
            sa.String(),
            sa.Computed(
                "'OF' || _intid",
            ),
            nullable=False,
        ),
        sa.Column("file_name", sa.String(), nullable=False),
        sa.Column("file_path", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("_intid"),
        sa.UniqueConstraint("id"),
    )
    op.create_table(
        "workflows",
        sa.Column("_intid", sa.Integer(), nullable=False),
        sa.Column(
            "id",
            sa.String(),
            sa.Computed(
                "'S' || _intid",
            ),
            nullable=False,
        ),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("definition", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("_intid"),
        sa.UniqueConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_table(
        "workflow_versions",
        sa.Column("_intid", sa.Integer(), nullable=False),
        sa.Column(
            "id",
            sa.String(),
            sa.Computed(
                "'SV' || _intid",
            ),
            nullable=False,
        ),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("workflow_id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("definition", sa.JSON(), nullable=False),
        sa.Column("definition_hash", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["workflow_id"],
            ["workflows.id"],
        ),
        sa.PrimaryKeyConstraint("_intid"),
        sa.UniqueConstraint("id"),
    )
    op.create_index(
        op.f("ix_workflow_versions_version"),
        "workflow_versions",
        ["version"],
        unique=True,
    )
    op.create_index(
        op.f("ix_workflow_versions_workflow_id"),
        "workflow_versions",
        ["workflow_id"],
        unique=False,
    )
    op.create_table(
        "runs",
        sa.Column("_intid", sa.Integer(), nullable=False),
        sa.Column(
            "id",
            sa.String(),
            sa.Computed(
                "'R' || _intid",
            ),
            nullable=False,
        ),
        sa.Column("workflow_id", sa.String(), nullable=False),
        sa.Column("workflow_version_id", sa.String(), nullable=False),
        sa.Column("parent_run_id", sa.String(), nullable=True),
        sa.Column(
            "status",
            sa.Enum("PENDING", "RUNNING", "COMPLETED", "FAILED", name="runstatus"),
            nullable=False,
        ),
        sa.Column("run_type", sa.String(), nullable=False),
        sa.Column("initial_inputs", sa.JSON(), nullable=True),
        sa.Column("input_dataset_id", sa.String(), nullable=True),
        sa.Column("start_time", sa.DateTime(), nullable=True),
        sa.Column("end_time", sa.DateTime(), nullable=True),
        sa.Column("outputs", sa.JSON(), nullable=True),
        sa.Column("output_file_id", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(
            ["input_dataset_id"],
            ["datasets.id"],
        ),
        sa.ForeignKeyConstraint(
            ["output_file_id"],
            ["output_files.id"],
        ),
        sa.ForeignKeyConstraint(
            ["parent_run_id"],
            ["runs.id"],
        ),
        sa.ForeignKeyConstraint(
            ["workflow_id"],
            ["workflows.id"],
        ),
        sa.ForeignKeyConstraint(
            ["workflow_version_id"],
            ["workflow_versions.id"],
        ),
        sa.PrimaryKeyConstraint("_intid"),
        sa.UniqueConstraint("id"),
    )
    op.create_index(
        op.f("ix_runs_input_dataset_id"),
        "runs",
        ["input_dataset_id"],
        unique=False,
    )
    op.create_index(op.f("ix_runs_parent_run_id"), "runs", ["parent_run_id"], unique=False)
    op.create_index(op.f("ix_runs_workflow_id"), "runs", ["workflow_id"], unique=False)
    op.create_index(
        op.f("ix_runs_workflow_version_id"),
        "runs",
        ["workflow_version_id"],
        unique=False,
    )
    op.create_table(
        "tasks",
        sa.Column("_intid", sa.Integer(), nullable=False),
        sa.Column(
            "id",
            sa.String(),
            sa.Computed(
                "'T' || _intid",
            ),
            nullable=False,
        ),
        sa.Column("run_id", sa.String(), nullable=False),
        sa.Column("node_id", sa.String(), nullable=False),
        sa.Column("parent_task_id", sa.String(), nullable=True),
        sa.Column(
            "status",
            sa.Enum("PENDING", "RUNNING", "COMPLETED", "FAILED", name="taskstatus"),
            nullable=False,
        ),
        sa.Column("inputs", sa.JSON(), nullable=True),
        sa.Column("outputs", sa.JSON(), nullable=True),
        sa.Column("start_time", sa.DateTime(), nullable=True),
        sa.Column("end_time", sa.DateTime(), nullable=True),
        sa.Column("subworkflow", sa.JSON(), nullable=True),
        sa.Column("subworkflow_output", sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(
            ["parent_task_id"],
            ["tasks.id"],
        ),
        sa.ForeignKeyConstraint(
            ["run_id"],
            ["runs.id"],
        ),
        sa.PrimaryKeyConstraint("_intid"),
        sa.UniqueConstraint("id"),
    )
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_table("tasks")
    op.drop_index(op.f("ix_runs_workflow_version_id"), table_name="runs")
    op.drop_index(op.f("ix_runs_workflow_id"), table_name="runs")
    op.drop_index(op.f("ix_runs_parent_run_id"), table_name="runs")
    op.drop_index(op.f("ix_runs_input_dataset_id"), table_name="runs")
    op.drop_table("runs")
    op.drop_index(op.f("ix_workflow_versions_workflow_id"), table_name="workflow_versions")
    op.drop_index(op.f("ix_workflow_versions_version"), table_name="workflow_versions")
    op.drop_table("workflow_versions")
    op.drop_table("workflows")
    op.drop_table("output_files")
    op.drop_table("eval_runs")
    op.drop_table("datasets")
    # ### end Alembic commands ###
