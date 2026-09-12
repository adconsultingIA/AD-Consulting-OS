import os

import requests

from app.models.database_models import (
    AutomationExecutionDB,
    AutomationRuleDB,
)


DEFAULT_TIMEOUT = 15


def get_make_automation_webhook_url() -> str:
    url = os.getenv(
        "MAKE_DEVISFLOW_AUTOMATION_WEBHOOK_URL"
    )

    if not url:
        raise RuntimeError(
            "MAKE_DEVISFLOW_AUTOMATION_WEBHOOK_URL "
            "n'est pas configurée."
        )

    return url


def get_make_automation_secret() -> str:
    secret = os.getenv(
        "MAKE_DEVISFLOW_AUTOMATION_SECRET"
    )

    if not secret:
        raise RuntimeError(
            "MAKE_DEVISFLOW_AUTOMATION_SECRET "
            "n'est pas configuré."
        )

    return secret


def dispatch_automation_to_make(
    *,
    rule: AutomationRuleDB,
    execution: AutomationExecutionDB,
) -> dict:
    payload = {
        "event": "automation_execution",
        "product": "devisflow",
        "organization_id": rule.organization_id,
        "automation_rule_id": rule.id,
        "automation_type": rule.automation_type,
        "execution_id": execution.id,
        "entity_type": execution.entity_type,
        "entity_id": execution.entity_id,
        "trigger_payload": (
            execution.trigger_payload or {}
        ),
        "action_config": (
            rule.action_config or {}
        ),
    }

    headers = {
        "Content-Type": "application/json",
        "X-DevisFlow-Automation-Secret": (
            get_make_automation_secret()
        ),
    }

    try:
        response = requests.post(
            get_make_automation_webhook_url(),
            json=payload,
            headers=headers,
            timeout=DEFAULT_TIMEOUT,
        )
    except requests.RequestException as exc:
        raise RuntimeError(
            "Make est indisponible."
        ) from exc

    if not response.ok:
        raise RuntimeError(
            "Erreur Make "
            f"{response.status_code}: "
            f"{response.text}"
        )

    try:
        return response.json()
    except ValueError:
        return {
            "status": "accepted",
            "raw_response": response.text,
        }
