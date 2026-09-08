import sqlite3
from pathlib import Path


DB_PATH = (
    Path(__file__).resolve().parents[1]
    / "devisflow.db"
)


def column_exists(
    cursor: sqlite3.Cursor,
    table_name: str,
    column_name: str,
) -> bool:
    rows = cursor.execute(
        f"PRAGMA table_info({table_name})"
    ).fetchall()

    return any(
        row[1] == column_name
        for row in rows
    )


def main():
    if not DB_PATH.exists():
        raise SystemExit(
            f"Database introuvable : {DB_PATH}"
        )

    connection = sqlite3.connect(DB_PATH)

    try:
        cursor = connection.cursor()

        if not column_exists(
            cursor,
            "invoices",
            "next_reminder_date",
        ):
            cursor.execute(
                """
                ALTER TABLE invoices
                ADD COLUMN next_reminder_date
                DATE
                NULL
                """
            )

            print(
                "next_reminder_date ajouté"
            )
        else:
            print(
                "next_reminder_date existe déjà"
            )

        if not column_exists(
            cursor,
            "invoices",
            "reminder_interval_days",
        ):
            cursor.execute(
                """
                ALTER TABLE invoices
                ADD COLUMN reminder_interval_days
                INTEGER
                NOT NULL
                DEFAULT 7
                """
            )

            print(
                "reminder_interval_days ajouté"
            )
        else:
            print(
                "reminder_interval_days existe déjà"
            )

        if not column_exists(
            cursor,
            "invoices",
            "reminder_paused",
        ):
            cursor.execute(
                """
                ALTER TABLE invoices
                ADD COLUMN reminder_paused
                BOOLEAN
                NOT NULL
                DEFAULT 0
                """
            )

            print(
                "reminder_paused ajouté"
            )
        else:
            print(
                "reminder_paused existe déjà"
            )

        # Sécurise les anciennes données.
        cursor.execute(
            """
            UPDATE invoices
            SET reminder_interval_days = 7
            WHERE reminder_interval_days IS NULL
               OR reminder_interval_days <= 0
            """
        )

        cursor.execute(
            """
            UPDATE invoices
            SET reminder_paused = 0
            WHERE reminder_paused IS NULL
            """
        )

        connection.commit()

        print()
        print(
            "Migration Invoice Reminder Schedule : OK"
        )

    finally:
        connection.close()


if __name__ == "__main__":
    main()
