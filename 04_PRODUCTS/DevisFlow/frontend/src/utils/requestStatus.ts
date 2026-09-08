export function getRequestStatusLabel(status: string) {
  switch (status) {
    case "new":
      return "Nouvelle";

    case "pending":
      return "En attente";

    case "qualified":
      return "Qualifiée";

    case "quoted":
      return "Devis créé";

    case "accepted":
      return "Acceptée";

    case "rejected":
      return "Refusée";

    case "cancelled":
      return "Annulée";

    case "closed":
      return "Clôturée";

    default:
      return status;
  }
}
