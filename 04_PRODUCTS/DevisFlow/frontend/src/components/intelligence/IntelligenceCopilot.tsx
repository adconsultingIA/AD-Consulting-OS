import {
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  useAuth,
} from "../../context/AuthContext";

import {
  useWorkspace,
} from "../../context/WorkspaceContext";

import {
  executeCopilotAction,
  sendCopilotMessage,
  type CopilotMessageResponse,
} from "../../services/copilotService";

import "../../styles/intelligence-copilot.css";


type ConversationItem = {
  id: number;

  role:
    | "user"
    | "assistant";

  text: string;

  response?:
    CopilotMessageResponse;
};


const EXECUTABLE_ACTIONS =
  new Set([
    "create_request",
    "create_quote",
  ]);


function formatMoney(
  value?: number | null
) {
  if (value == null) {
    return "—";
  }

  return new Intl.NumberFormat(
    "fr-CH",
    {
      style: "currency",
      currency: "CHF",
      maximumFractionDigits: 0,
    }
  ).format(value);
}


export default function IntelligenceCopilot() {
  const navigate =
    useNavigate();

  const {
    session,
  } = useAuth();

  const {
    workspace,
    hasEntitlement,
  } = useWorkspace();


  const enabled =
    hasEntitlement(
      "ai_copilot"
    );


  const [
    message,
    setMessage,
  ] = useState("");


  const [
    conversation,
    setConversation,
  ] = useState<
    ConversationItem[]
  >([]);


  const [
    sending,
    setSending,
  ] = useState(false);


  const [
    executingProposal,
    setExecutingProposal,
  ] = useState<
    string | null
  >(null);


  const [
    error,
    setError,
  ] = useState("");


  const auth = useMemo(
    () => {
      const accessToken =
        session?.access_token;

      const organizationId =
        workspace
          ?.organization
          .id;

      if (
        !accessToken
        || !organizationId
      ) {
        return null;
      }

      return {
        accessToken,
        organizationId,
      };
    },
    [
      session?.access_token,
      workspace?.organization.id,
    ]
  );


  if (!enabled) {
    return null;
  }


  async function handleSend() {
    const cleanMessage =
      message.trim();

    if (
      !cleanMessage
      || !auth
      || sending
    ) {
      return;
    }

    setError("");
    setSending(true);


    const userItem:
      ConversationItem = {
        id: Date.now(),

        role: "user",

        text:
          cleanMessage,
      };


    setConversation(
      (current) => [
        ...current,
        userItem,
      ]
    );


    setMessage("");


    try {
      const response =
        await sendCopilotMessage(
          auth,
          cleanMessage
        );


      setConversation(
        (current) => [
          ...current,
          {
            id:
              Date.now() + 1,

            role:
              "assistant",

            text:
              response.answer,

            response,
          },
        ]
      );

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : (
            "Le Copilot "
            + "est indisponible."
          )
      );

    } finally {
      setSending(false);
    }
  }


  async function handleExecute(
    response:
      CopilotMessageResponse
  ) {
    if (
      !auth
      || executingProposal
    ) {
      return;
    }


    const proposalId =
      response.proposal_id;


    if (!proposalId) {
      setError(
        "Cette action ne possède "
        + "pas de confirmation "
        + "serveur valide."
      );

      return;
    }


    setError("");

    setExecutingProposal(
      proposalId
    );


    try {
      const result =
        await executeCopilotAction(
          auth,
          proposalId
        );


      let createdLabel:
        string;


      if (result.replayed) {
        createdLabel =
          (
            "Cette action avait déjà "
            + "été exécutée. "
            + "Aucun doublon créé."
          );

      } else if (
        result.request_id
      ) {
        createdLabel =
          (
            "Demande créée "
            + "avec succès."
          );

      } else if (
        result.quote_id
      ) {
        createdLabel =
          (
            "Devis créé "
            + "avec succès."
          );

      } else {
        createdLabel =
          (
            "Action exécutée "
            + "avec succès."
          );
      }


      setConversation(
        (current) => [
          ...current,
          {
            id:
              Date.now(),

            role:
              "assistant",

            text:
              createdLabel,
          },
        ]
      );

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : (
            "Impossible "
            + "d'exécuter "
            + "l'action."
          )
      );

    } finally {
      setExecutingProposal(
        null
      );
    }
  }


  function handleNavigationAction(
    actionCode: string
  ) {
    const normalized =
      actionCode
        .toLowerCase();


    if (
      normalized.includes(
        "invoice"
      )
      || normalized.includes(
        "overdue"
      )
      || normalized.includes(
        "facture"
      )
    ) {
      navigate(
        "/invoices?status=overdue"
      );

      return;
    }


    if (
      normalized.includes(
        "request"
      )
      || normalized.includes(
        "demande"
      )
    ) {
      navigate(
        "/requests"
      );

      return;
    }


    if (
      normalized.includes(
        "quote"
      )
      || normalized.includes(
        "devis"
      )
    ) {
      navigate(
        "/quotes"
      );

      return;
    }


    setError(
      "Cette action n'est "
      + "pas encore disponible "
      + "dans le Copilot."
    );
  }


  function handleSuggestedAction(
    response:
      CopilotMessageResponse,

    actionCode:
      string
  ) {
    if (
      EXECUTABLE_ACTIONS.has(
        actionCode
      )
    ) {
      void handleExecute(
        response
      );

      return;
    }


    handleNavigationAction(
      actionCode
    );
  }


  return (
    <section
      className={
        "intelligence-copilot"
      }
      id={
        "intelligence-copilot"
      }
    >

      <div
        className={
          "intelligence-copilot-header"
        }
      >
        <div>
          <span
            className="eyebrow"
          >
            Intelligence
          </span>

          <h2>
            AI Copilot
          </h2>

          <p>
            Comprenez votre activité,
            préparez vos demandes et vos
            devis, puis agissez après
            confirmation.
          </p>
        </div>


        <span
          className={
            "intelligence-copilot-status"
          }
        >
          Actif
        </span>
      </div>


      <div
        className={
          "intelligence-copilot-body"
        }
      >

        {
          conversation.length
          === 0
          && (
            <div
              className={
                "intelligence-copilot-empty"
              }
            >
              <strong>
                Que souhaitez-vous
                faire ?
              </strong>

              <p>
                Exemple :
                « Prépare une demande
                de refonte de site pour
                France Tax à 12 000 CHF. »
              </p>
            </div>
          )
        }


        <div
          className={
            "intelligence-copilot-conversation"
          }
        >

          {
            conversation.map(
              (item) => (
                <div
                  key={item.id}
                  className={
                    item.role
                    === "user"
                      ? (
                        "copilot-message "
                        + "copilot-message-user"
                      )
                      : (
                        "copilot-message "
                        + "copilot-message-assistant"
                      )
                  }
                >

                  <p>
                    {item.text}
                  </p>


                  {
                    item.response
                      ?.draft
                    && (
                      <div
                        className={
                          "copilot-draft-card"
                        }
                      >

                        <span
                          className={
                            "copilot-draft-label"
                          }
                        >
                          Demande préparée
                        </span>


                        <strong>
                          {
                            item
                              .response
                              .draft
                              .title
                            ?? (
                              "Nouvelle "
                              + "demande"
                            )
                          }
                        </strong>


                        <dl>

                          <div>
                            <dt>
                              Client
                            </dt>

                            <dd>
                              {
                                item
                                  .response
                                  .draft
                                  .client_name
                                ?? (
                                  "À préciser"
                                )
                              }
                            </dd>
                          </div>


                          <div>
                            <dt>
                              Budget
                            </dt>

                            <dd>
                              {
                                formatMoney(
                                  item
                                    .response
                                    .draft
                                    .budget
                                )
                              }
                            </dd>
                          </div>


                          <div>
                            <dt>
                              Échéance
                            </dt>

                            <dd>
                              {
                                item
                                  .response
                                  .draft
                                  .deadline
                                ?? (
                                  "À préciser"
                                )
                              }
                            </dd>
                          </div>

                        </dl>


                        {
                          item
                            .response
                            .draft
                            .missing_fields
                            .length
                          > 0
                          && (
                            <div
                              className={
                                "copilot-missing-fields"
                              }
                            >
                              À compléter :{" "}
                              {
                                item
                                  .response
                                  .draft
                                  .missing_fields
                                  .join(", ")
                              }
                            </div>
                          )
                        }

                      </div>
                    )
                  }


                  {
                    item.response
                      ?.quote_draft
                    && (
                      <div
                        className={
                          "copilot-draft-card"
                        }
                      >

                        <span
                          className={
                            "copilot-draft-label"
                          }
                        >
                          Devis préparé
                        </span>


                        <strong>
                          {
                            item
                              .response
                              .quote_draft
                              .request_title
                            ?? (
                              "Nouveau devis"
                            )
                          }
                        </strong>


                        <dl>

                          <div>
                            <dt>
                              Client
                            </dt>

                            <dd>
                              {
                                item
                                  .response
                                  .quote_draft
                                  .client_name
                                ?? "—"
                              }
                            </dd>
                          </div>


                          <div>
                            <dt>
                              Lignes
                            </dt>

                            <dd>
                              {
                                item
                                  .response
                                  .quote_draft
                                  .items
                                  .length
                              }
                            </dd>
                          </div>


                          <div>
                            <dt>
                              Montant proposé
                            </dt>

                            <dd>
                              {
                                formatMoney(
                                  item
                                    .response
                                    .quote_draft
                                    .items
                                    .reduce(
                                      (
                                        total,
                                        line
                                      ) =>
                                        (
                                          total
                                          + (
                                            line
                                              .quantity
                                            * line
                                              .unit_price
                                          )
                                        ),
                                      0
                                    )
                                )
                              }
                            </dd>
                          </div>

                        </dl>


                        <small>
                          La fiscalité sera
                          calculée par
                          DevisFlow / CoreFlow.
                        </small>

                      </div>
                    )
                  }


                  {
                    item
                      .response
                      ?.suggested_actions
                      ?.map(
                        (action) => {
                          const
                            isExecutable =
                              EXECUTABLE_ACTIONS
                                .has(
                                  action.code
                                );


                          const
                            hasMissingFields =
                              (
                                item
                                  .response
                                  ?.draft
                                  ?.missing_fields
                                  ?.length
                                ?? 0
                              ) > 0
                              || (
                                item
                                  .response
                                  ?.quote_draft
                                  ?.missing_fields
                                  ?.length
                                ?? 0
                              ) > 0;


                          const
                            proposalId =
                              item
                                .response
                                ?.proposal_id
                              ?? null;


                          const
                            isExecuting =
                              (
                                proposalId
                                !== null
                                && (
                                  executingProposal
                                  === proposalId
                                )
                              );


                          const
                            missingProposal =
                              (
                                isExecutable
                                && !proposalId
                              );


                          return (
                            <button
                              key={
                                action.code
                              }

                              type="button"

                              className={
                                "business-button "
                                + "business-button-primary "
                                + "copilot-action-button"
                              }

                              disabled={
                                isExecutable
                                && (
                                  isExecuting
                                  || hasMissingFields
                                  || missingProposal
                                )
                              }

                              onClick={() =>
                                handleSuggestedAction(
                                  item.response!,
                                  action.code
                                )
                              }
                            >
                              {
                                isExecuting
                                  ? "Exécution..."
                                  : action.label
                              }
                            </button>
                          );
                        }
                      )
                  }

                </div>
              )
            )
          }

        </div>


        {
          error
          && (
            <div
              className={
                "error-message"
              }
            >
              {error}
            </div>
          )
        }


        <div
          className={
            "intelligence-copilot-composer"
          }
        >
          <textarea
            value={message}

            placeholder={
              "Demandez au Copilot "
              + "d'analyser, préparer "
              + "une demande ou créer "
              + "un devis..."
            }

            rows={3}

            disabled={
              sending
            }

            onChange={
              (event) =>
                setMessage(
                  event.target.value
                )
            }

            onKeyDown={
              (event) => {
                if (
                  event.key
                  === "Enter"
                  && !event.shiftKey
                ) {
                  event.preventDefault();

                  void handleSend();
                }
              }
            }
          />


          <button
            type="button"

            className={
              "business-button "
              + "business-button-primary"
            }

            disabled={
              sending
              || !message.trim()
              || !auth
            }

            onClick={() =>
              void handleSend()
            }
          >
            {
              sending
                ? "Analyse..."
                : "Envoyer"
            }
          </button>
        </div>


        <div
          className={
            "intelligence-copilot-links"
          }
        >

          <button
            type="button"

            onClick={() =>
              navigate(
                "/requests"
              )
            }
          >
            Voir les demandes
          </button>


          <button
            type="button"

            onClick={() =>
              navigate(
                "/quotes"
              )
            }
          >
            Voir les devis
          </button>

        </div>

      </div>

    </section>
  );
}
