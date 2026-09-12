from datetime import date, datetime
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.database_models import (
    AutomationRuleDB,
    InvoiceDB,
)

from app.services.automation_orchestrator import (
    dispatch_automation_to_make,
)

from app.services.automation_service import (
    create_automation_execution,
    get_active_automation_execution,
    mark_automation_execution_failed,
    mark_automation_execution_running,
)


def scan_due_invoice_payment_reminders(
    db: Session,
    *,
    dry_run: bool = False,
) -> dict:
    today = date.today()

    rules = (
        db.query(AutomationRuleDB)
        .filter(
            AutomationRuleDB.automation_type
            == "invoice_payment_reminder",
            AutomationRuleDB.enabled.is_(True),
        )
        .order_by(
            AutomationRuleDB.updated_at.desc()
        )
        .all()
    )

    # One effective active rule per organization.
    rules_by_organization: dict[
        str,
        AutomationRuleDB,
    ] = {}

    for rule in rules:
        if (
            rule.organization_id
            not in rules_by_organization
        ):
            rules_by_organization[
                rule.organization_id
            ] = rule

    scanned = 0
    eligible = 0
    dispatched = 0
    skipped_active = 0
    failed = 0

    executions: list[dict] = []

    for organization_id, rule in (
        rules_by_organization.items()
    ):
        invoices = (
            db.query(InvoiceDB)
            .filter(
                InvoiceDB.organization_id
                == organization_id,
                InvoiceDB.status.in_(
                    [
                        "sent",
                        "partial",
                        "overdue",
                    ]
                ),
                InvoiceDB.amount_due
                > Decimal("0"),
                InvoiceDB.due_date.isnot(
                    None
                ),
                InvoiceDB.due_date < today,
                InvoiceDB.reminder_paused.is_(
                    False
                ),
            )
            .order_by(
                InvoiceDB.due_date.asc()
            )
            .all()
        )

        for invoice in invoices:
            scanned += 1

            if (
                invoice.next_reminder_date
                is not None
                and invoice.next_reminder_date
                > today
            ):
                continue

            eligible += 1

            # Keep status coherent with business reality.
            if invoice.status in {
                "sent",
                "partial",
            }:
                invoice.status = "overdue"
                db.commit()
                db.refresh(invoice)

            active_execution = (
                get_active_automation_execution(
                    db,
                    rule=rule,
                    entity_type="invoice",
                    entity_id=invoice.id,
                )
            )

            if active_execution:
                skipped_active += 1

                executions.append(
                    {
                        "invoice_id": (
                            invoice.id
                        ),
                        "invoice_number": (
                            invoice.invoice_number
                        ),
                        "status": "skipped",
                        "reason": (
                            "active_execution"
                        ),
                        "execution_id": (
                            active_execution.id
                        ),
                    }
                )

                continue

            if dry_run:
                executions.append(
                    {
                        "invoice_id": invoice.id,
                        "invoice_number": (
                            invoice.invoice_number
                        ),
                        "status": "dry_run",
                        "amount_due": str(
                            invoice.amount_due
                        ),
                        "due_date": (
                            invoice.due_date.isoformat()
                            if invoice.due_date
                            else None
                        ),
                        "next_reminder_date": (
                            invoice.next_reminder_date.isoformat()
                            if invoice.next_reminder_date
                            else None
                        ),
                    }
                )

                continue

            execution = (
                create_automation_execution(
                    db,
                    rule,
                    entity_type="invoice",
                    entity_id=invoice.id,
                    trigger_payload={
                        "trigger": (
                            "invoice_overdue"
                        ),
                        "invoice_id": (
                            invoice.id
                        ),
                        "invoice_number": (
                            invoice.invoice_number
                        ),
                        "amount_due": str(
                            invoice.amount_due
                        ),
                        "due_date": (
                            invoice.due_date.isoformat()
                            if invoice.due_date
                            else None
                        ),
                        "next_reminder_date": (
                            invoice
                            .next_reminder_date
                            .isoformat()
                            if (
                                invoice
                                .next_reminder_date
                            )
                            else None
                        ),
                        "scanner_date": (
                            today.isoformat()
                        ),
                    },
                )
            )

            execution = (
                mark_automation_execution_running(
                    db,
                    execution,
                )
            )

            try:
                dispatch_automation_to_make(
                    rule=rule,
                    execution=execution,
                )

                dispatched += 1

                executions.append(
                    {
                        "invoice_id": (
                            invoice.id
                        ),
                        "invoice_number": (
                            invoice.invoice_number
                        ),
                        "status": (
                            "dispatched"
                        ),
                        "execution_id": (
                            execution.id
                        ),
                    }
                )

            except Exception as exc:
                failed += 1

                execution = (
                    mark_automation_execution_failed(
                        db,
                        execution,
                        error_message=str(exc),
                    )
                )

                executions.append(
                    {
                        "invoice_id": (
                            invoice.id
                        ),
                        "invoice_number": (
                            invoice.invoice_number
                        ),
                        "status": "failed",
                        "execution_id": (
                            execution.id
                        ),
                        "error": str(exc),
                    }
                )

        rule.last_run_at = datetime.utcnow()
        db.commit()

    return {
        "ok": True,
        "dry_run": dry_run,
        "scanner_date": today.isoformat(),
        "organizations": len(
            rules_by_organization
        ),
        "scanned": scanned,
        "eligible": eligible,
        "dispatched": dispatched,
        "skipped_active": skipped_active,
        "failed": failed,
        "executions": executions,
    }
