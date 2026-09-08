import os
import smtplib

from dataclasses import dataclass
from email.message import EmailMessage
from email.utils import formataddr
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv


load_dotenv(".env")


@dataclass
class EmailAttachment:
    filename: str
    content: bytes
    mime_type: str = "application/pdf"


@dataclass
class EmailSendResult:
    success: bool
    provider: str
    provider_message_id: Optional[str] = None
    error_message: Optional[str] = None


def _get_required_env(name: str) -> str:
    value = os.getenv(name)

    if not value:
        raise RuntimeError(
            f"{name} non configuré."
        )

    return value


def send_email(
    *,
    recipient: str,
    subject: str,
    body: str,
    attachment: Optional[EmailAttachment] = None,
) -> EmailSendResult:
    try:
        smtp_host = _get_required_env("SMTP_HOST")
        smtp_port = int(
            os.getenv("SMTP_PORT", "587")
        )

        smtp_username = _get_required_env(
            "SMTP_USERNAME"
        )
        smtp_password = _get_required_env(
            "SMTP_PASSWORD"
        )

        from_email = os.getenv(
            "SMTP_FROM_EMAIL",
            smtp_username,
        )

        from_name = os.getenv(
            "SMTP_FROM_NAME",
            "DevisFlow",
        )

        security = os.getenv(
            "SMTP_SECURITY",
            "starttls",
        ).strip().lower()

        message = EmailMessage()

        message["From"] = formataddr(
            (
                from_name,
                from_email,
            )
        )
        message["To"] = recipient
        message["Subject"] = subject

        message.set_content(body)

        if attachment:
            main_type, sub_type = (
                attachment.mime_type.split(
                    "/",
                    maxsplit=1,
                )
            )

            message.add_attachment(
                attachment.content,
                maintype=main_type,
                subtype=sub_type,
                filename=attachment.filename,
            )

        if security == "ssl":
            smtp = smtplib.SMTP_SSL(
                smtp_host,
                smtp_port,
                timeout=30,
            )
        else:
            smtp = smtplib.SMTP(
                smtp_host,
                smtp_port,
                timeout=30,
            )

        try:
            if security == "starttls":
                smtp.starttls()

            smtp.login(
                smtp_username,
                smtp_password,
            )

            response = smtp.send_message(
                message
            )

        finally:
            try:
                smtp.quit()
            except Exception:
                pass

        if response:
            return EmailSendResult(
                success=False,
                provider="smtp",
                error_message=(
                    f"SMTP rejected recipients: "
                    f"{response}"
                ),
            )

        return EmailSendResult(
            success=True,
            provider="smtp",
        )

    except Exception as exc:
        return EmailSendResult(
            success=False,
            provider="smtp",
            error_message=str(exc),
        )
