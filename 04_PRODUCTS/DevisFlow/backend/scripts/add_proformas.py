import sqlite3
from pathlib import Path


DB_PATH = Path(__file__).resolve().parents[1] / "devisflow.db"


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


def table_exists(
    cursor: sqlite3.Cursor,
    table_name: str,
) -> bool:
    row = cursor.execute(
        """
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name = ?
        """,
        (table_name,),
    ).fetchone()

    return row is not None


def main() -> None:
    print(f"Database: {DB_PATH}")

    connection = sqlite3.connect(DB_PATH)

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS proformas (
                id VARCHAR PRIMARY KEY,
                quote_id VARCHAR NOT NULL,
                organization_id VARCHAR,
                issuer_snapshot JSON,
                proforma_number VARCHAR(100)
                    NOT NULL UNIQUE,
                status VARCHAR(50)
                    NOT NULL DEFAULT 'draft',
                issue_date DATE,
                valid_until DATE,
                notes TEXT,
                subtotal NUMERIC(12, 2)
                    NOT NULL DEFAULT 0,
                vat_amount NUMERIC(12, 2)
                    NOT NULL DEFAULT 0,
                total NUMERIC(12, 2)
                    NOT NULL DEFAULT 0,
                created_at DATETIME
                    NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME
                    NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (quote_id)
                    REFERENCES quotes(id)
            )
            """
        )

        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS
            ix_proformas_quote_id
            ON proformas(quote_id)
            """
        )

        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS
            ix_proformas_organization_id
            ON proformas(organization_id)
            """
        )

        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS
            ix_proformas_proforma_number
            ON proformas(proforma_number)
            """
        )

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS proforma_items (
                id VARCHAR PRIMARY KEY,
                proforma_id VARCHAR NOT NULL,
                quote_item_id VARCHAR,
                description TEXT NOT NULL,
                quantity NUMERIC(12, 2) NOT NULL,
                unit_price NUMERIC(12, 2) NOT NULL,
                vat_rate NUMERIC(5, 2)
                    NOT NULL DEFAULT 0,
                tax_type VARCHAR(50),
                tax_treatment VARCHAR(50),
                tax_reason TEXT,
                requires_manual_review BOOLEAN
                    NOT NULL DEFAULT 0,
                subtotal NUMERIC(12, 2) NOT NULL,
                vat_amount NUMERIC(12, 2) NOT NULL,
                total NUMERIC(12, 2) NOT NULL,
                FOREIGN KEY (proforma_id)
                    REFERENCES proformas(id),
                FOREIGN KEY (quote_item_id)
                    REFERENCES quote_items(id)
            )
            """
        )

        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS
            ix_proforma_items_proforma_id
            ON proforma_items(proforma_id)
            """
        )

        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS
            ix_proforma_items_quote_item_id
            ON proforma_items(quote_item_id)
            """
        )

        connection.commit()

        print()
        print("Migration Proforma: OK")
        print(
            "proformas:",
            table_exists(
                cursor,
                "proformas",
            ),
        )
        print(
            "proforma_items:",
            table_exists(
                cursor,
                "proforma_items",
            ),
        )

    finally:
        connection.close()


if __name__ == "__main__":
    main()
