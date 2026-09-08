import {
  useEffect,
  useState,
} from "react";

import {
  getDocumentEmails,
  type DocumentEmail,
} from "../services/documentEmailsService";


interface DocumentEmailTraceProps {
    documentType:
      | "quote"
      | "invoice"
      | "proforma"
      | "purchase_order";
  documentId: string;
  documentStatus: string;
}


function formatEmailDate(
  value: string
) {
  const date = new Date(
    value.endsWith("Z")
      ? value
      : `${value}Z`
  );

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const datePart =
    new Intl.DateTimeFormat(
      "fr-CH",
      {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
      }
    ).format(date);

  const timePart =
    new Intl.DateTimeFormat(
      "fr-CH",
      {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }
    ).format(date);

  return `${datePart} à ${timePart}`;
}


export default function DocumentEmailTrace({
  documentType,
  documentId,
  documentStatus,
}: DocumentEmailTraceProps) {
  const [
    email,
    setEmail,
  ] = useState<DocumentEmail | null>(null);

  const [
    loading,
    setLoading,
  ] = useState(false);


  useEffect(() => {
    if (
      ![
        "sent",
        "accepted",
        "rejected",
        "expired",
        "partial",
        "paid",
        "overdue",
      ].includes(documentStatus)
    ) {
      setEmail(null);
      return;
    }

    let cancelled = false;

    async function loadTrace() {
      try {
        setLoading(true);

        const emails =
          await getDocumentEmails(
            documentType,
            documentId
          );

        if (!cancelled) {
          setEmail(
            emails.find(
              (item) =>
                item.status === "sent"
            ) ??
              emails[0] ??
              null
          );
        }
      } catch (error) {
        console.error(
          "Document email trace:",
          error
        );

        if (!cancelled) {
          setEmail(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadTrace();

    return () => {
      cancelled = true;
    };
  }, [
    documentType,
    documentId,
    documentStatus,
  ]);


  if (loading && !email) {
    return (
      <div className="document-email-trace">
        Chargement de l'envoi…
      </div>
    );
  }


  if (!email) {
    return null;
  }


  return (
    <div
      className="document-email-trace document-email-trace-compact"
      title={email.recipient}
    >
      <span>
        {email.status === "sent"
          ? `Envoyé le ${formatEmailDate(
              email.created_at
            )}`
          : "Envoi non confirmé"}
      </span>
    </div>
  );
}
