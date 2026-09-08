import sqlite3
from pathlib import Path


DB_PATH = (
    Path(__file__).resolve().parents[1]
    / "devisflow.db"
)


def main():
    connection = sqlite3.connect(DB_PATH)

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS receipts (
                id VARCHAR PRIMARY KEY,
                payment_id VARCHAR NOT NULL UNIQUE,
                invoice_id VARCHAR NOT NULL,
                organization_id VARCHAR,
                receipt_number VARCHAR(100) NOT NULL UNIQUE,
                issue_date DATE NOT NULL,
                amount NUMERIC(12, 2) NOT NULL,
                cumulative_paid NUMERIC(12, 2) NOT NULL,
                remaining_due NUMERIC(12, 2) NOT NULL,
                payment_method VARCHAR(50),
                payment_reference VARCHAR(250),
                issuer_snapshot JSON,
                status VARCHAR(50) NOT NULL DEFAULT 'issued',
                sent_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(payment_id) REFERENCES payments(id),
                FOREIGN KEY(invoice_id) REFERENCES invoices(id)
            )
            """
        )

        cursor.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS
            ix_receipts_payment_id
            ON receipts(payment_id)
            """
        )

        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS
            ix_receipts_invoice_id
            ON receipts(invoice_id)
            """
        )

        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS
            ix_receipts_organization_id
            ON receipts(organization_id)
            """
        )

        cursor.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS
            ix_receipts_receipt_number
            ON receipts(receipt_number)
            """
        )

        connection.commit()

        print("Migration receipts : OK")

    finally:
        connection.close()


if __name__ == "__main__":
    main()
