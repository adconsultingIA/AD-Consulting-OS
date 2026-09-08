import {
  useEffect,
  useState,
} from "react";

import {
  getDocumentEmails,
  type DocumentEmail,
  type DocumentEmailDocumentType,
} from "../services/documentEmailsService";

import {
  getInvoicePayments,
  type Payment,
} from "../services/paymentsService";

import {
  getInvoiceReminders,
  type PaymentReminder,
} from "../services/remindersService";

import {
  getInvoiceCreditNotes,
  type CreditNote,
} from "../services/creditNotesService";

import {
  getInvoiceRefunds,
  type Refund,
} from "../services/refundsService";


export type InvoiceActivityType =
  | "email"
  | "payment"
  | "reminder"
  | "credit_note"
  | "refund";


interface InvoiceActivityPopupProps {
  invoiceId: string;
  invoiceNumber: string;
  type: InvoiceActivityType;
  onClose: () => void;
  actionLabel?: string;
  onAction?: () => void;
  documentType?: DocumentEmailDocumentType;
  contextLabel?: string;
}


function formatDate(
  value?: string | null
) {
  if (!value) {
    return "—";
  }

  const date = new Date(
    value.length === 10
      ? `${value}T12:00:00`
      : value
  );

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "fr-CH",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour:
        value.length > 10
          ? "2-digit"
          : undefined,
      minute:
        value.length > 10
          ? "2-digit"
          : undefined,
    }
  ).format(date);
}


function formatCurrency(
  value?: number | string | null
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "—";
  }

  return new Intl.NumberFormat(
    "fr-CH",
    {
      style: "currency",
      currency: "CHF",
    }
  ).format(Number(value));
}


function getTitle(
  type: InvoiceActivityType
) {
  const titles: Record<
    InvoiceActivityType,
    string
  > = {
    email: "Historique des envois",
    payment: "Historique des paiements",
    reminder: "Historique des relances",
    credit_note: "Historique des avoirs",
    refund: "Historique des remboursements",
  };

  return titles[type];
}


export default function InvoiceActivityPopup({
  invoiceId,
  invoiceNumber,
  type,
  onClose,
  actionLabel,
  onAction,
  documentType = "invoice",
  contextLabel = "Activité facture",
}: InvoiceActivityPopupProps) {
  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    emails,
    setEmails,
  ] = useState<DocumentEmail[]>([]);

  const [
    payments,
    setPayments,
  ] = useState<Payment[]>([]);

  const [
    reminders,
    setReminders,
  ] = useState<PaymentReminder[]>([]);

  const [
    creditNotes,
    setCreditNotes,
  ] = useState<CreditNote[]>([]);

  const [
    refunds,
    setRefunds,
  ] = useState<Refund[]>([]);


  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        setLoading(true);
        setError("");

        if (type === "email") {
          const data =
            await getDocumentEmails(
              documentType,
              invoiceId
            );

          if (!cancelled) {
            setEmails(data);
          }
        }

        if (type === "payment") {
          const data =
            await getInvoicePayments(
              invoiceId
            );

          if (!cancelled) {
            setPayments(data);
          }
        }

        if (type === "reminder") {
          const data =
            await getInvoiceReminders(
              invoiceId
            );

          if (!cancelled) {
            setReminders(data);
          }
        }

        if (type === "credit_note") {
          const data =
            await getInvoiceCreditNotes(
              invoiceId
            );

          if (!cancelled) {
            setCreditNotes(data);
          }
        }

        if (type === "refund") {
          const data =
            await getInvoiceRefunds(
              invoiceId
            );

          if (!cancelled) {
            setRefunds(data);
          }
        }
      } catch (err) {
        console.error(err);

        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Impossible de charger l'historique."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [
    invoiceId,
    type,
    documentType,
  ]);


  const isEmpty =
    type === "email"
      ? emails.length === 0
      : type === "payment"
        ? payments.length === 0
        : type === "reminder"
          ? reminders.length === 0
          : type === "credit_note"
            ? creditNotes.length === 0
            : refunds.length === 0;


  return (
    <div className="payment-modal-backdrop">
      <div className="payment-modal">

        <div className="payment-modal-header">
          <div>
            <span className="eyebrow">
              {contextLabel}
            </span>

            <h2>
              {getTitle(type)}
            </h2>

            <p>
              {invoiceNumber}
            </p>
          </div>

          <div className="business-row-actions">
            {actionLabel && onAction && (
              <button
                type="button"
                className="business-button business-button-primary"
                onClick={onAction}
              >
                {actionLabel}
              </button>
            )}

            <button
              type="button"
              className="business-button business-button-secondary"
              onClick={onClose}
            >
              Fermer
            </button>
          </div>
        </div>


        {error && (
          <div className="error-message">
            {error}
          </div>
        )}


        {loading ? (
          <div className="smart-empty-state">
            Chargement...
          </div>
        ) : isEmpty ? (
          <div className="smart-empty-state">
            Aucun élément enregistré.
          </div>
        ) : (
          <div className="payment-history">
            <div className="payment-history-list">

              {type === "email" &&
                emails.map((email, index) => (
                  <div
                    className="payment-history-item"
                    key={email.id}
                  >
                    <div>
                      <strong>
                        Envoi #{emails.length - index}
                      </strong>

                      <span>
                        {formatDate(
                          email.sent_at ??
                            email.created_at
                        )}
                      </span>
                    </div>

                    <div>
                      <strong>
                        {email.recipient}
                      </strong>

                      <span>
                        {email.subject}
                      </span>
                    </div>

                    <p>
                      Statut : {email.status}
                    </p>
                  </div>
                ))}


              {type === "payment" &&
                payments.map((payment, index) => (
                  <div
                    className="payment-history-item"
                    key={payment.id}
                  >
                    <div>
                      <strong>
                        Paiement #{index + 1}
                      </strong>

                      <span>
                        {formatDate(
                          payment.payment_date
                        )}
                      </span>
                    </div>

                    <div>
                      <strong>
                        {formatCurrency(
                          payment.amount
                        )}
                      </strong>

                      <span>
                        {payment.payment_method ??
                          "Mode non renseigné"}
                      </span>
                    </div>

                    {payment.reference && (
                      <p>
                        Réf. {payment.reference}
                      </p>
                    )}
                  </div>
                ))}


              {type === "reminder" &&
                reminders.map((reminder, index) => (
                  <div
                    className="payment-history-item"
                    key={reminder.id}
                  >
                    <div>
                      <strong>
                        Relance #{index + 1}
                      </strong>

                      <span>
                        {formatDate(
                          reminder.reminder_date
                        )}
                      </span>
                    </div>

                    <div>
                      <strong>
                        {reminder.channel}
                      </strong>

                      <span>
                        {reminder.subject ??
                          "Sans objet"}
                      </span>
                    </div>

                    {reminder.message && (
                      <p>
                        {reminder.message}
                      </p>
                    )}
                  </div>
                ))}


              {type === "credit_note" &&
                creditNotes.map((credit) => (
                  <div
                    className="payment-history-item"
                    key={credit.id}
                  >
                    <div>
                      <strong>
                        {credit.credit_note_number}
                      </strong>

                      <span>
                        {formatDate(
                          credit.issue_date
                        )}
                      </span>
                    </div>

                    <div>
                      <strong>
                        {formatCurrency(
                          credit.amount
                        )}
                      </strong>

                      <span>
                        {credit.reason}
                      </span>
                    </div>

                    {credit.notes && (
                      <p>
                        {credit.notes}
                      </p>
                    )}
                  </div>
                ))}


              {type === "refund" &&
                refunds.map((refund, index) => (
                  <div
                    className="payment-history-item"
                    key={refund.id}
                  >
                    <div>
                      <strong>
                        Remboursement #{index + 1}
                      </strong>

                      <span>
                        {formatDate(
                          refund.refund_date
                        )}
                      </span>
                    </div>

                    <div>
                      <strong>
                        {formatCurrency(
                          refund.amount
                        )}
                      </strong>

                      <span>
                        {refund.refund_method ??
                          "Mode non renseigné"}
                      </span>
                    </div>

                    {refund.reference && (
                      <p>
                        Réf. {refund.reference}
                      </p>
                    )}
                  </div>
                ))}

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
