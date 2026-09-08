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


def index_exists(
    cursor: sqlite3.Cursor,
    index_name: str,
) -> bool:
    row = cursor.execute(
        """
        SELECT name
        FROM sqlite_master
        WHERE type = 'index'
          AND name = ?
        """,
        (index_name,),
    ).fetchone()

    return row is not None


def main():
    if not DB_PATH.exists():
        raise SystemExit(
            f"Database introuvable : {DB_PATH}"
        )

    connection = sqlite3.connect(DB_PATH)

    try:
        cursor = connection.cursor()

        # --------------------------------------------------
        # CLIENTS
        # --------------------------------------------------

        if not column_exists(
            cursor,
            "clients",
            "organization_id",
        ):
            cursor.execute(
                """
                ALTER TABLE clients
                ADD COLUMN organization_id
                TEXT
                NULL
                """
            )

            print(
                "clients.organization_id ajouté"
            )
        else:
            print(
                "clients.organization_id existe déjà"
            )

        if not index_exists(
            cursor,
            "ix_clients_organization_id",
        ):
            cursor.execute(
                """
                CREATE INDEX
                ix_clients_organization_id
                ON clients (organization_id)
                """
            )

            print(
                "ix_clients_organization_id ajouté"
            )
        else:
            print(
                "ix_clients_organization_id existe déjà"
            )

        # --------------------------------------------------
        # REQUESTS
        # --------------------------------------------------

        if not column_exists(
            cursor,
            "requests",
            "organization_id",
        ):
            cursor.execute(
                """
                ALTER TABLE requests
                ADD COLUMN organization_id
                TEXT
                NULL
                """
            )

            print(
                "requests.organization_id ajouté"
            )
        else:
            print(
                "requests.organization_id existe déjà"
            )

        if not index_exists(
            cursor,
            "ix_requests_organization_id",
        ):
            cursor.execute(
                """
                CREATE INDEX
                ix_requests_organization_id
                ON requests (organization_id)
                """
            )

            print(
                "ix_requests_organization_id ajouté"
            )
        else:
            print(
                "ix_requests_organization_id existe déjà"
            )

        connection.commit()

        print()
        print(
            "Migration Client / Request Organization : OK"
        )

    finally:
        connection.close()


if __name__ == "__main__":
    main()
