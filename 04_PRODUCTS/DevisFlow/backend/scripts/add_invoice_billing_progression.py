import sqlite3
from pathlib import Path


DB_PATH = Path("devisflow.db")


def column_names(
    cursor: sqlite3.Cursor,
    table: str,
) -> set[str]:
    rows = cursor.execute(
        f"PRAGMA table_info({table})"
    ).fetchall()

    return {
        row[1]
        for row in rows
    }


def main():
    if not DB_PATH.exists():
        raise SystemExit(
            f"Database introuvable : {DB_PATH}"
        )

    db = sqlite3.connect(DB_PATH)

    try:
        cursor = db.cursor()

        invoice_columns = column_names(
            cursor,
            "invoices",
        )

        if "invoice_type" not in invoice_columns:
            cursor.execute(
                """
                ALTER TABLE invoices
                ADD COLUMN invoice_type
                VARCHAR(20)
                NOT NULL
                DEFAULT 'standard'
                """
            )
            print("invoice_type ajouté")
        else:
            print("invoice_type existe déjà")

        if (
            "billing_percentage"
            not in invoice_columns
        ):
            cursor.execute(
                """
                ALTER TABLE invoices
                ADD COLUMN billing_percentage
                NUMERIC(7, 4)
                NULL
                """
            )
            print(
                "billing_percentage ajouté"
            )
        else:
            print(
                "billing_percentage existe déjà"
            )

        if (
            "billing_sequence"
            not in invoice_columns
        ):
            cursor.execute(
                """
                ALTER TABLE invoices
                ADD COLUMN billing_sequence
                INTEGER
                NULL
                """
            )
            print(
                "billing_sequence ajouté"
            )
        else:
            print(
                "billing_sequence existe déjà"
            )

        item_columns = column_names(
            cursor,
            "invoice_items",
        )

        if (
            "quote_item_id"
            not in item_columns
        ):
            cursor.execute(
                """
                ALTER TABLE invoice_items
                ADD COLUMN quote_item_id
                VARCHAR
                NULL
                """
            )

            cursor.execute(
                """
                CREATE INDEX IF NOT EXISTS
                ix_invoice_items_quote_item_id
                ON invoice_items(
                    quote_item_id
                )
                """
            )

            print("quote_item_id ajouté")
        else:
            print("quote_item_id existe déjà")

        # Données historiques :
        # toutes les factures existantes sont
        # des factures standard.
        cursor.execute(
            """
            UPDATE invoices
            SET invoice_type = 'standard'
            WHERE invoice_type IS NULL
               OR invoice_type = ''
            """
        )

        db.commit()

        print()
        print(
            "Migration Billing Progression : OK"
        )

    finally:
        db.close()


if __name__ == "__main__":
    main()
