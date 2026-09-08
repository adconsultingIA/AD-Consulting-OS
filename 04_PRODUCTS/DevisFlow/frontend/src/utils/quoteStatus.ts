export function getQuoteStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: "Brouillon",
    ready: "Prêt",
    sent: "Envoyé",
    accepted: "Accepté",
    rejected: "Refusé",
    expired: "Expiré",
    cancelled: "Annulé",
  };

  return labels[status] ?? status;
}

export function getQuoteStatusClass(status: string): string {
  const classes: Record<string, string> = {
    draft: "status-draft",
    ready: "status-ready",
    sent: "status-sent",
    accepted: "status-accepted",
    rejected: "status-rejected",
    expired: "status-expired",
    cancelled: "status-cancelled",
  };

  return classes[status] ?? "status-default";
}
