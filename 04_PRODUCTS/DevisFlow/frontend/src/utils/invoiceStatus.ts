export function getInvoiceStatusLabel(
  status: string
): string {
  const labels: Record<string, string> = {
    draft: "Brouillon",
    issued: "Émise",
    sent: "Envoyée",
    partial: "Partiellement payée",
    paid: "Payée",
    overdue: "En retard",
    cancelled: "Annulée",
  };

  return labels[status] ?? status;
}

export function getInvoiceStatusClass(
  status: string
): string {
  const classes: Record<string, string> = {
    draft: "status-draft",
    issued: "status-ready",
    sent: "status-sent",
    partial: "status-partial",
    paid: "status-accepted",
    overdue: "status-expired",
    cancelled: "status-cancelled",
  };

  return classes[status] ?? "status-default";
}
