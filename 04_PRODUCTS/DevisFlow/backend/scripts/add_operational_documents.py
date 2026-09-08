import sqlite3
from pathlib import Path


DB_PATH = Path("devisflow.db")


def main():
    if not DB_PATH.exists():
        raise SystemExit(
            f"Base introuvable : {DB_PATH}"
        )

    db = sqlite3.connect(DB_PATH)

    try:
        db.execute("PRAGMA foreign_keys = ON")

        db.executescript(
            """
            CREATE TABLE IF NOT EXISTS
            operational_documents (
                id TEXT PRIMARY KEY,

                quote_id TEXT NOT NULL,
                organization_id TEXT,
                issuer_snapshot JSON,

                document_type TEXT NOT NULL,
                document_number TEXT NOT NULL UNIQUE,

                status TEXT NOT NULL
                    DEFAULT 'draft',

                issue_date DATE,
                execution_date DATE,

                location_address TEXT,
                notes TEXT,

                subtotal NUMERIC(12, 2)
                    NOT NULL DEFAULT 0,

                vat_amount NUMERIC(12, 2)
                    NOT NULL DEFAULT 0,

                total NUMERIC(12, 2)
                    NOT NULL DEFAULT 0,

                created_at DATETIME
                    NOT NULL
                    DEFAULT CURRENT_TIMESTAMP,

                updated_at DATETIME
                    NOT NULL
                    DEFAULT CURRENT_TIMESTAMP,

                FOREIGN KEY (quote_id)
                    REFERENCES quotes(id)
            );


            CREATE INDEX IF NOT EXISTS
            ix_operational_documents_quote_id
            ON operational_documents (
                quote_id
            );


            CREATE INDEX IF NOT EXISTS
            ix_operational_documents_organization_id
            ON operational_documents (
                organization_id
            );


            CREATE INDEX IF NOT EXISTS
            ix_operational_documents_document_type
            ON operational_documents (
                document_type
            );


            CREATE UNIQUE INDEX IF NOT EXISTS
            ix_operational_documents_document_number
            ON operational_documents (
                document_number
            );


            CREATE TABLE IF NOT EXISTS
            operational_document_items (
                id TEXT PRIMARY KEY,

                operational_document_id TEXT
                    NOT NULL,

                quote_item_id TEXT,

                description TEXT NOT NULL,

                quantity NUMERIC(12, 2)
                    NOT NULL,

                unit_price NUMERIC(12, 2)
                    NOT NULL,

                vat_rate NUMERIC(5, 2)
                    NOT NULL DEFAULT 0,

                tax_type TEXT,
                tax_treatment TEXT,
                tax_reason TEXT,

                requires_manual_review BOOLEAN
                    NOT NULL DEFAULT 0,

                subtotal NUMERIC(12, 2)
                    NOT NULL,

                vat_amount NUMERIC(12, 2)
                    NOT NULL,

                total NUMERIC(12, 2)
                    NOT NULL,

                FOREIGN KEY (
                    operational_document_id
                )
                    REFERENCES
                    operational_documents(id),

                FOREIGN KEY (quote_item_id)
                    REFERENCES quote_items(id)
            );


            CREATE INDEX IF NOT EXISTS
            ix_operational_document_items_document_id
            ON operational_document_items (
                operational_document_id
            );


            CREATE INDEX IF NOT EXISTS
            ix_operational_document_items_quote_item_id
            ON operational_document_items (
                quote_item_id
            );
            """
        )

        db.commit()

        print(
            "Migration operational_documents: OK"
        )

    finally:
        db.close()


if __name__ == "__main__":
    main()
