from sqlalchemy import text
from sqlalchemy.orm import Session


def next_document_number(
    db: Session,
    *,
    document_type: str,
    prefix: str,
    table_name: str,
    column_name: str,
    year: int,
) -> str:
    """
    Retourne le prochain numéro documentaire.

    Le compteur est persistant par type de document et année.

    Lors de la première utilisation, il est initialisé depuis
    le numéro maximal déjà présent afin de rester compatible
    avec les documents existants.
    """

    number_prefix = f"{prefix}-{year}-"

    # Table technique créée une seule fois.
    db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS
            document_number_counters (
                document_type TEXT NOT NULL,
                year INTEGER NOT NULL,
                current_value INTEGER NOT NULL,
                PRIMARY KEY (
                    document_type,
                    year
                )
            )
            """
        )
    )

    # Recherche du plus grand numéro réellement existant.
    #
    # table_name / column_name proviennent exclusivement
    # de constantes internes aux API DevisFlow.
    result = db.execute(
        text(
            f"""
            SELECT MAX(
                CAST(
                    substr(
                        {column_name},
                        :start_position
                    )
                    AS INTEGER
                )
            )
            FROM {table_name}
            WHERE {column_name}
                LIKE :number_pattern
            """
        ),
        {
            "start_position":
                len(number_prefix) + 1,
            "number_pattern":
                f"{number_prefix}%",
        },
    )

    max_existing = (
        result.scalar()
        or 0
    )

    try:
        max_existing = int(
            max_existing
        )
    except (
        TypeError,
        ValueError,
    ):
        max_existing = 0

    # Premier appel :
    # initialise le compteur sur le maximum historique.
    db.execute(
        text(
            """
            INSERT OR IGNORE INTO
            document_number_counters (
                document_type,
                year,
                current_value
            )
            VALUES (
                :document_type,
                :year,
                :current_value
            )
            """
        ),
        {
            "document_type":
                document_type,
            "year":
                year,
            "current_value":
                max_existing,
        },
    )

    # Sécurité en cas d'import manuel de documents
    # ou de compteur ancien inférieur aux données réelles.
    db.execute(
        text(
            """
            UPDATE document_number_counters
            SET current_value =
                CASE
                    WHEN current_value
                        < :minimum_value
                    THEN :minimum_value
                    ELSE current_value
                END
            WHERE document_type =
                :document_type
              AND year =
                :year
            """
        ),
        {
            "document_type":
                document_type,
            "year":
                year,
            "minimum_value":
                max_existing,
        },
    )

    # L'UPDATE obtient le verrou d'écriture SQLite.
    # Deux créations concurrentes ne récupèrent donc
    # pas le même numéro.
    db.execute(
        text(
            """
            UPDATE document_number_counters
            SET current_value =
                current_value + 1
            WHERE document_type =
                :document_type
              AND year =
                :year
            """
        ),
        {
            "document_type":
                document_type,
            "year":
                year,
        },
    )

    sequence = db.execute(
        text(
            """
            SELECT current_value
            FROM document_number_counters
            WHERE document_type =
                :document_type
              AND year =
                :year
            """
        ),
        {
            "document_type":
                document_type,
            "year":
                year,
        },
    ).scalar_one()

    return (
        f"{number_prefix}"
        f"{int(sequence):04d}"
    )
