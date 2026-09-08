import os
import sqlite3
from pathlib import Path
from uuid import UUID

from dotenv import load_dotenv


ROOT_DIR = Path(__file__).resolve().parents[1]

DB_PATH = (
    ROOT_DIR
    / "devisflow.db"
)


def get_organization_id() -> str:
    load_dotenv(
        ROOT_DIR / ".env"
    )

    organization_id = os.getenv(
        "DEVISFLOW_ORGANIZATION_ID"
    )

    if not organization_id:
        raise SystemExit(
            "DEVISFLOW_ORGANIZATION_ID "
            "n'est pas configuré."
        )

    try:
        UUID(organization_id)
    except ValueError as exc:
        raise SystemExit(
            "DEVISFLOW_ORGANIZATION_ID "
            "n'est pas un UUID valide."
        ) from exc

    return organization_id


def main():
    if not DB_PATH.exists():
        raise SystemExit(
            f"Database introuvable : {DB_PATH}"
        )

    organization_id = (
        get_organization_id()
    )

    connection = sqlite3.connect(
        DB_PATH
    )

    try:
        cursor = connection.cursor()

        # --------------------------------------------------
        # CLIENTS
        # --------------------------------------------------

        cursor.execute(
            """
            UPDATE clients
            SET organization_id = ?
            WHERE organization_id IS NULL
               OR TRIM(organization_id) = ''
            """,
            (organization_id,),
        )

        clients_updated = (
            cursor.rowcount
        )

        # --------------------------------------------------
        # REQUESTS
        # Héritage depuis le client parent.
        # --------------------------------------------------

        cursor.execute(
            """
            UPDATE requests
            SET organization_id = (
                SELECT clients.organization_id
                FROM clients
                WHERE clients.id =
                      requests.client_id
            )
            WHERE organization_id IS NULL
               OR TRIM(organization_id) = ''
            """
        )

        requests_updated = (
            cursor.rowcount
        )

        # --------------------------------------------------
        # VALIDATION
        # --------------------------------------------------

        clients_without_org = (
            cursor.execute(
                """
                SELECT COUNT(*)
                FROM clients
                WHERE organization_id IS NULL
                   OR TRIM(organization_id) = ''
                """
            ).fetchone()[0]
        )

        requests_without_org = (
            cursor.execute(
                """
                SELECT COUNT(*)
                FROM requests
                WHERE organization_id IS NULL
                   OR TRIM(organization_id) = ''
                """
            ).fetchone()[0]
        )

        mismatched_requests = (
            cursor.execute(
                """
                SELECT COUNT(*)
                FROM requests
                JOIN clients
                  ON clients.id =
                     requests.client_id
                WHERE requests.organization_id
                      != clients.organization_id
                """
            ).fetchone()[0]
        )

        if clients_without_org:
            raise RuntimeError(
                f"{clients_without_org} client(s) "
                "sans organization_id."
            )

        if requests_without_org:
            raise RuntimeError(
                f"{requests_without_org} demande(s) "
                "sans organization_id."
            )

        if mismatched_requests:
            raise RuntimeError(
                f"{mismatched_requests} demande(s) "
                "avec organisation différente "
                "du client parent."
            )

        connection.commit()

        print(
            f"{clients_updated} client(s) mis à jour"
        )

        print(
            f"{requests_updated} demande(s) mise(s) à jour"
        )

        print(
            "0 incohérence Client → Demande"
        )

        print(
            "Backfill Client / Request Organization : OK"
        )

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


if __name__ == "__main__":
    main()
