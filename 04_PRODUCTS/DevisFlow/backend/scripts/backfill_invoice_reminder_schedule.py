import sqlite3
from datetime import date, timedelta
from pathlib import Path


DB_PATH = (
    Path(__file__).resolve().parents[1]
    / "devisflow.db"
)


def main():
    if not DB_PATH.exists():
        raise SystemExit(
            f"Database introuvable : {DB_PATH}"
        )

    connection = sqlite3.connect(DB_PATH)

    try:
        cursor = connection.cursor()

        invoices = cursor.execute(
            """
            SELECT
                id,
                reminder_interval_days
            FROM invoices
            WHERE next_reminder_date IS NULL
              AND amount_due > 0
            """
        ).fetchall()

        updated = 0

        for invoice_id, interval_days in invoices:
            row = cursor.execute(
                """
                SELECT reminder_date
                FROM payment_reminders
                WHERE invoice_id = ?
                ORDER BY
                    reminder_date DESC,
                    created_at DESC
                LIMIT 1
                """,
                (invoice_id,),
            ).fetchone()

            if not row:
                continue

            last_reminder_date = date.fromisoformat(
                row[0]
            )

            interval = int(
                interval_days or 7
            )

            if interval <= 0:
                interval = 7

            next_reminder_date = (
                last_reminder_date
                + timedelta(days=interval)
            )

            cursor.execute(
                """
                UPDATE invoices
                SET next_reminder_date = ?
                WHERE id = ?
                """,
                (
                    next_reminder_date.isoformat(),
                    invoice_id,
                ),
            )

            updated += 1

        connection.commit()

        print(
            f"{updated} facture(s) mise(s) à jour"
        )
        print(
            "Backfill Reminder Schedule : OK"
        )

    finally:
        connection.close()


if __name__ == "__main__":
    main()
