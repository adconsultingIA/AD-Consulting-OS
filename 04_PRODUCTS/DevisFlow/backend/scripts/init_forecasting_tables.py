from app.core.database import engine

from app.models.database_models import (
    ForecastModelChampionDB,
    ForecastModelEvaluationDB,
    ForecastRunDB,
    ForecastPointDB,
)


def main() -> None:
    tables = [
        ForecastModelChampionDB.__table__,
        ForecastModelEvaluationDB.__table__,
        ForecastRunDB.__table__,
        ForecastPointDB.__table__,
    ]

    for table in tables:
        table.create(
            bind=engine,
            checkfirst=True,
        )

        print(
            f"✓ {table.name} ready"
        )


if __name__ == "__main__":
    main()
