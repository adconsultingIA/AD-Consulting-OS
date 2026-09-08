import {
  useEffect,
  useMemo,
  useState,
} from "react";
import type { FormEvent } from "react";

import {
  createClient,
  getClients,
  updateClient,
} from "../services/api";

import type { Client } from "../types";


type ClientPeriodFilter =
  | "current"
  | "previous"
  | "three_months"
  | "year"
  | "all";


function isClientInPeriod(
  client: Client,
  period: ClientPeriodFilter
) {
  if (period === "all") {
    return true;
  }

  const date = new Date(
    client.created_at
  );

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const now = new Date();

  const currentYear =
    now.getFullYear();

  const currentMonth =
    now.getMonth();

  if (period === "current") {
    return (
      date.getFullYear() ===
        currentYear &&
      date.getMonth() ===
        currentMonth
    );
  }

  if (period === "previous") {
    const previous =
      new Date(
        currentYear,
        currentMonth - 1,
        1
      );

    return (
      date.getFullYear() ===
        previous.getFullYear() &&
      date.getMonth() ===
        previous.getMonth()
    );
  }

  if (period === "three_months") {
    const start =
      new Date(
        currentYear,
        currentMonth - 2,
        1
      );

    const end =
      new Date(
        currentYear,
        currentMonth + 1,
        1
      );

    return (
      date >= start &&
      date < end
    );
  }

  return (
    date.getFullYear() ===
    currentYear
  );
}


function formatMonthLabel(
  offset = 0
) {
  const now = new Date();

  const date =
    new Date(
      now.getFullYear(),
      now.getMonth() + offset,
      1
    );

  const label =
    new Intl.DateTimeFormat(
      "fr-CH",
      {
        month: "long",
        year:
          offset === 0
            ? "numeric"
            : undefined,
      }
    ).format(date);

  return (
    label.charAt(0).toUpperCase() +
    label.slice(1)
  );
}


export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [showForm, setShowForm] = useState(false);

  const [
    editingClientId,
    setEditingClientId,
  ] = useState<string | null>(null);

  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [
    periodFilter,
    setPeriodFilter,
  ] = useState<ClientPeriodFilter>(
    "current"
  );

  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");


  async function loadClients() {
    try {
      setLoading(true);
      setError("");

      const data = await getClients();

      setClients(data);
    } catch (err) {
      console.error(err);

      setError(
        "Impossible de charger les clients."
      );
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    loadClients();
  }, []);


  function resetForm() {
    setCompanyName("");
    setContactName("");
    setEmail("");
    setPhone("");
    setAddress("");
    setNotes("");
  }


  function closeForm() {
    resetForm();
    setEditingClientId(null);
    setShowForm(false);
    setError("");
  }


  function openCreateForm() {
    resetForm();
    setEditingClientId(null);
    setError("");
    setShowForm(true);
  }


  function openEditForm(
    client: Client
  ) {
    setEditingClientId(client.id);

    setCompanyName(
      client.company_name ?? ""
    );

    setContactName(
      client.contact_name ?? ""
    );

    setEmail(
      client.email ?? ""
    );

    setPhone(
      client.phone ?? ""
    );

    setAddress(
      client.address ?? ""
    );

    setNotes(
      client.notes ?? ""
    );

    setError("");
    setShowForm(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }


  async function handleSubmit(
    event: FormEvent
  ) {
    event.preventDefault();

    try {
      setSubmitting(true);
      setError("");

      const payload = {
        company_name: companyName.trim(),
        contact_name: contactName.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
        notes: notes.trim() || null,
      };

      if (editingClientId) {
        const updatedClient =
          await updateClient(
            editingClientId,
            payload
          );

        setClients((current) =>
          current.map((client) =>
            client.id === updatedClient.id
              ? updatedClient
              : client
          )
        );
      } else {
        const client =
          await createClient(payload);

        setClients((current) => [
          ...current,
          client,
        ]);
      }

      closeForm();
    } catch (err) {
      console.error(err);

      setError(
        editingClientId
          ? "Impossible de modifier le client."
          : "Impossible de créer le client."
      );
    } finally {
      setSubmitting(false);
    }
  }


  const periodClients = useMemo(
    () =>
      clients.filter(
        (client) =>
          isClientInPeriod(
            client,
            periodFilter
          )
      ),
    [
      clients,
      periodFilter,
    ]
  );

  const activeClients = useMemo(
    () =>
      periodClients.filter(
        (client) =>
          client.active
      ).length,
    [periodClients]
  );

  const inactiveClients =
    periodClients.length -
    activeClients;

  const contactsProvided =
    useMemo(
      () =>
        periodClients.filter(
          (client) =>
            Boolean(
              client.contact_name?.trim()
            )
        ).length,
      [periodClients]
    );

  const filteredClients = useMemo(() => {
    const query =
      search
        .trim()
        .toLowerCase();

    return periodClients.filter(
      (client) => {
        if (!query) {
          return true;
        }

        const haystack = [
          client.company_name,
          client.contact_name,
          client.email,
          client.phone ?? "",
          client.address ?? "",
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(
          query
        );
      }
    );
  }, [
    periodClients,
    search,
  ]);


  return (
    <div>
      <div className="page-header">
        <div>
          <span className="eyebrow">
            Relation client
          </span>

          <h1>Clients</h1>

          <p>
            Centralisez les entreprises et
            contacts utilisés dans vos demandes,
            devis et factures.
          </p>
        </div>

        <button
          type="button"
          className="business-button business-button-primary"
          onClick={() => {
            if (showForm) {
              closeForm();
            } else {
              openCreateForm();
            }
          }}
        >
          {showForm
            ? "Fermer"
            : "Nouveau client"}
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

        <section className="df-premium-kpi-grid">
          <article
            className="df-premium-kpi-card"
            data-tone="primary"
          >
            <span>Total clients</span>

            <strong>
              {loading ? "—" : periodClients.length}
            </strong>

              <small>Clients acquis sur la période</small>
          </article>

          <article
            className="df-premium-kpi-card"
            data-tone="success"
          >
            <span>Clients actifs</span>

            <strong>
              {loading ? "—" : activeClients}
            </strong>

              <small>Acquis et actifs</small>
          </article>

          <article
            className="df-premium-kpi-card"
            data-tone="neutral"
          >
            <span>Clients inactifs</span>

            <strong>
              {loading ? "—" : inactiveClients}
            </strong>

              <small>Acquis et inactifs</small>
          </article>

          <article
            className="df-premium-kpi-card"
            data-tone="cyan"
          >
            <span>Contacts renseignés</span>

              <strong>
                {loading
                  ? "—"
                  : contactsProvided}
              </strong>

              <small>Contacts sur la période</small>
          </article>
        </section>

      {showForm && (
        <div className="business-form-overlay">
<form
          className="client-form"
          onSubmit={handleSubmit}
        >
          <div className="form-header">
            <div>
              <h2>
                {editingClientId
                  ? "Modifier le client"
                  : "Nouveau client"}
              </h2>

              <p>
                {editingClientId
                  ? "Mettez à jour les informations du client."
                  : "Ajoutez les informations principales du client."}
              </p>
            </div>

            <button
              type="button"
              className="business-button business-button-secondary"
              onClick={closeForm}
            >
              Annuler
            </button>
          </div>

          <div className="form-grid">
            <label>
              Entreprise
              <input
                required
                autoFocus
                placeholder="Ex. Entreprise SA"
                value={companyName}
                onChange={(event) =>
                  setCompanyName(
                    event.target.value
                  )
                }
              />
            </label>

            <label>
              Contact principal
              <input
                required
                placeholder="Nom du contact"
                value={contactName}
                onChange={(event) =>
                  setContactName(
                    event.target.value
                  )
                }
              />
            </label>

            <label>
              Email
              <input
                required
                type="email"
                placeholder="contact@entreprise.ch"
                value={email}
                onChange={(event) =>
                  setEmail(
                    event.target.value
                  )
                }
              />
            </label>

            <label>
              Téléphone
              <input
                type="tel"
                placeholder="+41 ..."
                value={phone}
                onChange={(event) =>
                  setPhone(
                    event.target.value
                  )
                }
              />
            </label>

            <label className="full-width">
              Adresse
              <input
                placeholder="Adresse complète"
                value={address}
                onChange={(event) =>
                  setAddress(
                    event.target.value
                  )
                }
              />
            </label>

            <label className="full-width">
              Notes
              <textarea
                rows={3}
                placeholder="Informations utiles sur le client..."
                value={notes}
                onChange={(event) =>
                  setNotes(
                    event.target.value
                  )
                }
              />
            </label>
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="business-button business-button-primary"
              disabled={submitting}
            >
              {submitting
                ? editingClientId
                  ? "Enregistrement..."
                  : "Création..."
                : editingClientId
                  ? "Enregistrer"
                  : "Créer le client"}
            </button>
          </div>
        </form>
        </div>
      )}

      <section className="table-card">
        <div className="client-list-header">
          <div>
            <h2>Répertoire clients</h2>

            <p>
              {loading
                ? "Chargement..."
                : `${filteredClients.length} client${
                    filteredClients.length > 1
                      ? "s"
                      : ""
                  } affiché${
                    filteredClients.length > 1
                      ? "s"
                      : ""
                  }`}
            </p>
          </div>

          <input
            className="client-search"
            type="search"
            placeholder="Rechercher un client..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />
        </div>

          <div className="list-foundation-toolbar">
            <div className="list-period-chips">
              <button
                type="button"
                className={`list-filter-chip ${
                  periodFilter === "current"
                    ? "list-filter-chip-active"
                    : ""
                }`}
                onClick={() =>
                  setPeriodFilter("current")
                }
              >
                {formatMonthLabel()}
              </button>

              <button
                type="button"
                className={`list-filter-chip ${
                  periodFilter === "previous"
                    ? "list-filter-chip-active"
                    : ""
                }`}
                onClick={() =>
                  setPeriodFilter("previous")
                }
              >
                {formatMonthLabel(-1)}
              </button>

              <button
                type="button"
                className={`list-filter-chip ${
                  periodFilter === "three_months"
                    ? "list-filter-chip-active"
                    : ""
                }`}
                onClick={() =>
                  setPeriodFilter("three_months")
                }
              >
                3 mois
              </button>

              <button
                type="button"
                className={`list-filter-chip ${
                  periodFilter === "year"
                    ? "list-filter-chip-active"
                    : ""
                }`}
                onClick={() =>
                  setPeriodFilter("year")
                }
              >
                {new Date().getFullYear()}
              </button>

              <button
                type="button"
                className={`list-filter-chip ${
                  periodFilter === "all"
                    ? "list-filter-chip-active"
                    : ""
                }`}
                onClick={() =>
                  setPeriodFilter("all")
                }
              >
                Toutes
              </button>
            </div>
          </div>

        {loading ? (
          <div className="empty-state">
            Chargement des clients...
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="empty-state">
            {search
              ? "Aucun client ne correspond à votre recherche."
              : "Aucun client pour le moment."}
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table df-premium-table">
              <thead>
                <tr>
                  <th>Entreprise</th>
                  <th>Contact</th>
                  <th>Email</th>
                  <th>Téléphone</th>
                  <th>Adresse</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredClients.map(
                  (client) => (
                    <tr key={client.id}>
                        <td
                            title={client.company_name}
                        >
                          <strong
                            className="df-cell-truncate"
                          >
                              {client.company_name.replace(
                                /^Entreprise\s+/i,
                                ""
                              )}
                          </strong>
                        </td>

                      <td>
                        {client.contact_name}
                      </td>

                      <td>
                        <a
                          className="client-link"
                          href={`mailto:${client.email}`}
                        >
                          {client.email}
                        </a>
                      </td>

                      <td>
                        {client.phone ? (
                          <a
                            className="client-link"
                            href={`tel:${client.phone}`}
                          >
                            {client.phone}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>

                        <td
                          title={client.address || "—"}
                        >
                          <span
                            className="df-cell-truncate"
                          >
                            {client.address || "—"}
                          </span>
                        </td>

                      <td>
                        <span
                          className={
                            client.active
                              ? "status-badge"
                              : "status-badge status-badge-inactive"
                          }
                        >
                          {client.active
                            ? "Actif"
                            : "Inactif"}
                        </span>
                      </td>

                        <td>
                          <div className="df-table-actions">
                            <button
                              type="button"
                              className="business-button business-button-secondary business-button-sm"
                              onClick={() =>
                                openEditForm(client)
                              }
                            >
                              Modifier
                            </button>

                              <button
                                type="button"
                                className="business-button business-button-secondary business-button-sm"
                                onClick={async () => {
                                  try {
                                    const updatedClient =
                                      await updateClient(
                                        client.id,
                                        {
                                          active:
                                            !client.active,
                                        }
                                      );

                                    setClients(
                                      (current) =>
                                        current.map(
                                          (item) =>
                                            item.id ===
                                            updatedClient.id
                                              ? updatedClient
                                              : item
                                        )
                                    );
                                  } catch (err) {
                                    console.error(err);
                                    setError(
                                      client.active
                                        ? "Impossible de désactiver le client."
                                        : "Impossible de réactiver le client."
                                    );
                                  }
                                }}
                              >
                                {client.active
                                  ? "Désactiver"
                                  : "Réactiver"}
                              </button>
                          </div>
                        </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
