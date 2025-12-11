"""
Utility script to delete every user record (and dependent rows) from the BragBoard database.

Usage:
    cd backend
    python scripts/clear_users.py --yes
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import List, Tuple, Type

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session


# Ensure the backend directory (where app/ lives) is on sys.path
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.append(str(BACKEND_ROOT))

from app.database import SessionLocal, init_db  # noqa: E402
from app.models import (  # noqa: E402
    AdminNotification,
    Attachment,
    Comment,
    Notification,
    Reaction,
    Report,
    ShoutOut,
    ShoutOutRecipient,
    User,
)


DEPENDENT_TABLES_IN_DELETE_ORDER: List[Type] = [
    AdminNotification,
    Notification,
    Report,
    Comment,
    Reaction,
    ShoutOutRecipient,
    Attachment,
    ShoutOut,
]


def purge_users(db: Session) -> List[Tuple[str, int]]:
    """
    Delete dependent rows first to satisfy FK constraints, then wipe the users table.
    Returns a list of (table_name, deleted_row_count).
    """
    deleted_counts: List[Tuple[str, int]] = []

    for model in DEPENDENT_TABLES_IN_DELETE_ORDER:
        count = db.query(model).delete(synchronize_session=False)
        deleted_counts.append((model.__tablename__, count))

    user_count = db.query(User).delete(synchronize_session=False)
    deleted_counts.append((User.__tablename__, user_count))

    return deleted_counts


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Delete all users (and dependent data) from the BragBoard database."
    )
    parser.add_argument(
        "--yes",
        action="store_true",
        help="Skip the interactive confirmation prompt.",
    )
    args = parser.parse_args()

    if not args.yes:
        confirm = input(
            "This will permanently delete every user and related data. Type 'DELETE' to continue: "
        ).strip()
        if confirm != "DELETE":
            print("Aborted. No changes were made.")
            return

    init_db()

    db = SessionLocal()
    try:
        deleted_counts = purge_users(db)
        db.commit()
    except SQLAlchemyError as exc:
        db.rollback()
        raise SystemExit(f"Failed to purge users: {exc}") from exc
    finally:
        db.close()

    print("Purge complete:")
    for table, count in deleted_counts:
        print(f"  - {table}: {count} rows deleted")


if __name__ == "__main__":
    main()

