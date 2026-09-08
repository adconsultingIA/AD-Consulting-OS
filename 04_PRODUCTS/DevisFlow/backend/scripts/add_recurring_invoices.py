import sqlite3
from pathlib import Path


DB_PATH = (
    Path(__file__).resolve().parents[1]
    / "devisflow.db"
)


def column_exists(
    cursor,
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
    connection = sqlite3.connect(DB_PATH)

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS
            recurring_invoices (
                id VARCHAR PRIMARY KEY,
                quote_id VARCHAR NOT NULL,
                organization_id VARCHAR,
                issuer_snapshot JSON,
                service_name VARCHAR(250) NOT NULL,
                frequency VARCHAR(30) NOT NULL,
                start_date DATE NOT NULL,
                next_invoice_date DATE NOT NULL,
                status VARCHAR(30)
                    NOT NULL
                    DEFAULT 'active',
                last_generated_at DATETIME,
                created_at DATETIME
                    DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME
                    DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(quote_id)
                    REFERENCES quotes(id)
            )
            """
        )

        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS
            ix_recurring_invoices_quote_id
            ON recurring_invoices(quote_id)
            """
        )

        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS
            ix_recurring_invoices_organization_id
            ON recurring_invoices(organization_id)
            """
        )

        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS
            ix_recurring_invoices_next_invoice_date
            ON recurring_invoices(next_invoice_date)
            """
        )

        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS
            ix_recurring_invoices_status
            ON recurring_invoices(status)
            """
        )

        if not column_exists(
            cursor,
            "invoices",
            "recurring_invoice_id",
        ):
            cursor.execute(
                """
                ALTER TABLE invoices
                ADD COLUMN recurring_invoice_id VARCHAR
                REFERENCES recurring_invoices(id)
                """
            )

        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS
            ix_invoices_recurring_invoice_id
            ON invoices(recurring_invoice_id)
            """
        )

        connection.commit()

        print(
            "Migration recurring invoices : OK"
        )

    finally:
        connection.close()


if __name__ == "__main__":
    main()
