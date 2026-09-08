import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  useWorkspace,
} from "../context/WorkspaceContext";

import {
  useAuth,
} from "../context/AuthContext";

import {
  getCoreFlowUrl,
  type CoreFlowDestination,
} from "../config/coreflow";

type TopbarMenu =
  | "products"
  | "plan"
  | "notifications"
  | "settings"
  | "profile"
  | null;


export default function TopbarControls() {
  const {
    workspace,
    loading: workspaceLoading,
    error: workspaceError,
  } = useWorkspace();

  const {
    identity,
    identityLoading,
    signOut,
  } = useAuth();


  const organizationName =
    workspace?.organization.name
    ?? "AD Consulting IA";

  const activeMembership =
    identity?.memberships.find(
      (membership) =>
        membership.organization_id ===
        workspace?.organization.id
    )
    ?? null;


  const userName =
    identity?.full_name?.trim()
    || "Utilisateur";


  const userRole =
    activeMembership?.role
    ?? null;


  const roleLabel =
    userRole === "owner"
      ? "Propriétaire"
      : userRole === "admin"
        ? "Administrateur"
        : userRole === "collaborator"
          ? "Collaborateur"
          : userRole === "viewer"
            ? "Lecteur"
            : identityLoading
              ? "Chargement…"
              : "Membre";


  const userInitials =
    userName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) =>
        part.charAt(0).toUpperCase()
      )
      .join("")
      || "U";


  const userAvatar =
    identity?.avatar_url
    ?? null;


  const productName =
    workspace?.product.name
    ?? "DevisFlow";


  const productEnabled =
    workspace?.access.enabled
    ?? true;


  const planCode =
    workspace?.access.plan
    ?? "starter";


  const planName =
    planCode.length > 0
      ? (
          planCode.charAt(0).toUpperCase()
          + planCode.slice(1)
        )
      : "Starter";


  const maxUsersValue =
    workspace?.access.entitlements[
      "max_users"
    ];


  const maxUsers =
    typeof maxUsersValue === "number"
      ? maxUsersValue
      : null;


  const aiCopilotEnabled =
    workspace?.access.entitlements[
      "ai_copilot"
    ] === true;


  const [openMenu, setOpenMenu] =
    useState<TopbarMenu>(null);

  const containerRef =
    useRef<HTMLDivElement>(null);


  useEffect(() => {
    function handleOutsideClick(
      event: MouseEvent
    ) {
      if (
        containerRef.current &&
        !containerRef.current.contains(
          event.target as Node
        )
      ) {
        setOpenMenu(null);
      }
    }


    function handleEscape(
      event: KeyboardEvent
    ) {
      if (event.key === "Escape") {
        setOpenMenu(null);
      }
    }


    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );

    document.addEventListener(
      "keydown",
      handleEscape
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );

      document.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, []);


  function openCoreFlow(
    destination: CoreFlowDestination
  ) {
    setOpenMenu(null);

    window.location.assign(
      getCoreFlowUrl(destination)
    );
  }


  function toggleMenu(
    menu: Exclude<TopbarMenu, null>
  ) {
    setOpenMenu(
      openMenu === menu
        ? null
        : menu
    );
  }


  return (
    <div
      className="df-topbar-transverse"
      ref={containerRef}
    >

      {/* ==================================================
          CENTRE — CONTROLES TRANSVERSES
          ================================================== */}

      <div className="df-topbar-center">

        {/* PRODUITS */}

        <div className="df-topbar-control-wrapper">
          <button
            type="button"
            className="df-topbar-control"
            onClick={() =>
              toggleMenu("products")
            }
          >
            <span className="df-control-icon">
              ▦
            </span>

            <span>
              Produits
            </span>

            <span className="df-control-chevron">
              ▾
            </span>
          </button>


          {openMenu === "products" && (
            <div className="df-topbar-popover df-products-popover">

              <div className="df-popover-heading">
                <span>
                  Écosystème
                </span>

                <strong>
                  {organizationName}
                </strong>
              </div>


              <div className="df-product-switcher-list">

                <button
                  type="button"
                  className="df-product-switcher-item df-product-switcher-active"
                >
                  <span className="df-product-mini-mark">
                    DF
                  </span>

                  <span>
                    <strong>
                      {productName}
                    </strong>

                    <small>
                      Gestion commerciale
                    </small>
                  </span>

                  <span className="df-product-state">
                    {productEnabled
                      ? "Actif"
                      : "Inactif"}
                  </span>
                </button>


                <div className="df-product-switcher-coming">
                  <span>
                    {workspaceLoading
                      ? "Connexion à CoreFlow…"
                      : workspaceError
                        ? "CoreFlow indisponible"
                        : "Écosystème évolutif"}
                  </span>

                  <p>
                    De nouvelles capacités apparaîtront ici
                    lorsqu'elles seront activées par CoreFlow.
                  </p>
                </div>

              </div>

            </div>
          )}
        </div>


        {/* PLAN */}

        <div className="df-topbar-control-wrapper">
          <button
            type="button"
            className="df-topbar-plan"
            onClick={() =>
              toggleMenu("plan")
            }
          >
            <span className="df-plan-dot" />

            Plan {planName}

            <span className="df-control-chevron">
              ▾
            </span>
          </button>


          {openMenu === "plan" && (
            <div className="df-topbar-popover df-plan-popover">

              <div className="df-popover-heading">
                <span>
                  Plan actuel
                </span>

                <strong>
                  {productName} {planName}
                </strong>
              </div>


              <div className="df-plan-summary">
                <div>
                  <span>
                    Produit
                  </span>

                  <strong>
                    {productName}
                  </strong>
                </div>

                <div>
                  <span>
                    Niveau
                  </span>

                  <strong>
                    {planName}
                  </strong>
                </div>
              </div>


              <div className="df-plan-features">
                <span>
                  Droits CoreFlow
                </span>

                <p>
                  ✓ Accès produit{" "}
                  {productEnabled
                    ? "actif"
                    : "inactif"}
                </p>

                {maxUsers !== null && (
                  <p>
                    ✓ Jusqu'à {maxUsers} utilisateur
                    {maxUsers > 1 ? "s" : ""}
                  </p>
                )}

                <p>
                  {aiCopilotEnabled
                    ? "✓ Copilot IA activé"
                    : "— Copilot IA non inclus"}
                </p>
              </div>


              <div className="df-popover-note">
                Plan et droits synchronisés
                avec CoreFlow.
              </div>

            </div>
          )}
        </div>


        {/* NOTIFICATIONS */}

        <div className="df-topbar-control-wrapper">
          <button
            type="button"
            className="df-topbar-control df-topbar-notifications"
            onClick={() =>
              toggleMenu("notifications")
            }
          >
            <span className="df-control-icon">
              ◌
            </span>

            <span>
              Notifications
            </span>

            <span className="df-notification-indicator" />
          </button>


          {openMenu === "notifications" && (
            <div className="df-topbar-popover df-notifications-popover">

              <div className="df-popover-heading">
                <span>
                  Centre
                </span>

                <strong>
                  Notifications
                </strong>
              </div>


              <div className="df-notification-empty">
                <span className="df-notification-empty-icon">
                  ✓
                </span>

                <strong>
                  Tout est à jour
                </strong>

                <p>
                  Les alertes métier et événements
                  CoreFlow apparaîtront ici.
                </p>
              </div>

            </div>
          )}
        </div>


        {/* PARAMETRES */}

        <div className="df-topbar-control-wrapper">
          <button
            type="button"
            className="df-topbar-control"
            onClick={() =>
              toggleMenu("settings")
            }
          >
            <span className="df-control-icon">
              ⚙
            </span>

            <span>
              Paramètres
            </span>
          </button>


          {openMenu === "settings" && (
            <div className="df-topbar-popover df-settings-popover">

              <div className="df-popover-heading">
                <span>
                  Configuration
                </span>

                <strong>
                  Paramètres
                </strong>
              </div>


              <div className="df-settings-list">
                <button type="button">
                  <span>Organisation</span>
                  <small>
                    Informations légales et commerciales
                  </small>
                </button>

                <button type="button">
                  <span>Branding</span>
                  <small>
                    Logo, couleurs et identité
                  </small>
                </button>

                <button type="button">
                  <span>Facturation</span>
                  <small>
                    Numérotation, taxes et documents
                  </small>
                </button>

                <button type="button">
                  <span>Paiements</span>
                  <small>
                    Moyens de paiement et coordonnées
                  </small>
                </button>
              </div>


              <div className="df-popover-note">
                Ces paramètres seront progressivement
                hérités de CoreFlow.
              </div>

            </div>
          )}
        </div>


        {/* RECHERCHE */}

        <button
          type="button"
          className="df-topbar-control df-topbar-future-control"
          title="Recherche globale — bientôt disponible"
        >
          <span className="df-control-icon">
            ⌕
          </span>

          <span>
            Recherche
          </span>
        </button>


        {/* AIDE */}

        <button
          type="button"
          className="df-topbar-control df-topbar-future-control"
          title="Aide et support — bientôt disponible"
        >
          <span className="df-control-icon">
            ?
          </span>

          <span>
            Aide
          </span>
        </button>

      </div>


      {/* ==================================================
          DROITE — ORGANISATION + UTILISATEUR
          ================================================== */}

      <div className="df-topbar-identity">

        <div className="df-topbar-control-wrapper">
          <button
            type="button"
            className="df-topbar-profile df-topbar-profile-v2"
            onClick={() =>
              toggleMenu("profile")
            }
          >

            <span className="df-profile-avatar">
              {userAvatar ? (
                <img
                  src={userAvatar}
                  alt=""
                  className="df-user-avatar"
                />
              ) : (
                userInitials
              )}
            </span>


            <span className="df-profile-copy df-profile-copy-v2">

              <small>
                {organizationName}
              </small>

              <strong>
                {userName}
              </strong>

              <span>
                {roleLabel}
              </span>

            </span>


            <span className="df-control-chevron">
              ▾
            </span>

          </button>


          {openMenu === "profile" && (
            <div className="df-topbar-popover df-profile-popover">

              <div className="df-profile-popover-head">

                <span className="df-profile-avatar df-profile-avatar-large">
                  {userAvatar ? (
                    <img
                      src={userAvatar}
                      alt=""
                      className="df-user-avatar"
                    />
                  ) : (
                    userInitials
                  )}
                </span>


                <div>
                  <strong>
                    {userName}
                  </strong>

                  <span>
                    {roleLabel}
                  </span>
                </div>

              </div>


              <div className="df-identity-context">

                <span>
                  Organisation active
                </span>

                <strong>
                  {organizationName}
                </strong>

              </div>


              <div className="df-settings-list">

                <button 
                    type="button"
                    onClick={() =>
                          openCoreFlow("profile")
                      }
                  >
                  <span>
                    Mon profil
                  </span>

                  <small>
                    Identité et préférences
                  </small>
                </button>


                <button
                  type="button"
                  onClick={() =>
                    openCoreFlow("users")
                  }
                
                >
                  <span>
                    Utilisateurs & rôles
                  </span>

                  <small>
                    Membres et autorisations
                  </small>
                </button>


                <button
                  type="button"
                  onClick={() =>
                    openCoreFlow("organizations")
                  }
                
                >
                  <span>
                    Changer d'organisation
                  </span>

                  <small>
                    Organisations accessibles
                  </small>
                </button>


                <button
                  type="button"
                  onClick={() =>
                    openCoreFlow("settings")
                  }
                >
                  <span>
                    Préférences
                  </span>

                  <small>
                    Interface et notifications
                  </small>
                </button>

              </div>


              <div className="df-profile-logout">
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenu(null);
                    void signOut();
                  }}
                >
                  Déconnexion
                </button>
              </div>


              <div className="df-popover-note">
                Identité, rôle et organisation seront
                fournis dynamiquement par CoreFlow.
              </div>

            </div>
          )}
        </div>

      </div>

    </div>
  );
}
