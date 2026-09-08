import {
  BrowserRouter,
  NavLink,
  Route,
  Routes,
} from "react-router-dom";

import DashboardPage from "./pages/DashboardPage";
import ClientsPage from "./pages/ClientsPage";
import RequestsPage from "./pages/RequestsPage";
import QuotesPage from "./pages/QuotesPage";
import InvoicesPage from "./pages/InvoicesPage";
import RecurringInvoicesPage from "./pages/RecurringInvoicesPage";
import ProformasPage from "./pages/ProformasPage";
import OperationalDocumentsPage from "./pages/OperationalDocumentsPage";
import PurchaseOrdersPage from "./pages/PurchaseOrdersPage";
import PaymentsPage from "./pages/PaymentsPage";
import CreditNotesPage from "./pages/CreditNotesPage";
import RemindersPage from "./pages/RemindersPage";
import HistoryPage from "./pages/HistoryPage";
import TopbarControls from "./components/TopbarControls";
import { useWorkspace } from "./context/WorkspaceContext";
import "./index.css";
import type { CSSProperties } from "react";

function App() {

    const { workspace } = useWorkspace();

    const productName =
      workspace?.product.name
      ?? "DevisFlow";

    const productBranding =
      workspace?.branding.product
      ?? {};

    const organizationBranding =
      workspace?.branding.organization
      ?? {};

    const productLogo =
      typeof productBranding.logo_mark_url === "string"
        && productBranding.logo_mark_url
          ? productBranding.logo_mark_url
          : null;

    const primaryColor =
      typeof productBranding.primary_color === "string"
        && productBranding.primary_color
          ? productBranding.primary_color
          : typeof organizationBranding.primary_color === "string"
            ? organizationBranding.primary_color
            : null;

    const secondaryColor =
      typeof productBranding.secondary_color === "string"
        && productBranding.secondary_color
          ? productBranding.secondary_color
          : typeof organizationBranding.secondary_color === "string"
            ? organizationBranding.secondary_color
            : null;

    const accentColor =
      typeof productBranding.accent_color === "string"
        && productBranding.accent_color
          ? productBranding.accent_color
          : typeof organizationBranding.accent_color === "string"
            ? organizationBranding.accent_color
            : null;
  return (
    <BrowserRouter>
      <div className="df-app-shell">

        {/* ==================================================
            PRODUCT TOPBAR
            ================================================== */}
        <header className="df-topbar">
          <div
            className="df-topbar-brand"
            style={{
              "--df-brand-primary":
                primaryColor ?? undefined,
              "--df-brand-secondary":
                secondaryColor ?? undefined,
              "--df-brand-accent":
                accentColor ?? undefined,
            } as CSSProperties}
          >
            <div className="df-topbar-mark">
              {productLogo ? (
                <img
                  src={productLogo}
                  alt=""
                  className="df-topbar-product-logo"
                />
              ) : (
                "DF"
              )}
            </div>

            <div className="df-topbar-product">
              <strong>
                {productName}
              </strong>

              <span>
                Gestion commerciale
              </span>
            </div>
          </div>
       


          <TopbarControls />

        </header>


        {/* ==================================================
            BUSINESS NAVIGATION
            ================================================== */}
        <nav
          className="df-business-nav"
          aria-label="Navigation DevisFlow"
        >
          <div className="df-business-nav-inner">

            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                isActive
                  ? "df-nav-link df-nav-link-active"
                  : "df-nav-link"
              }
            >
              Dashboard
            </NavLink>

            <NavLink
              to="/clients"
              className={({ isActive }) =>
                isActive
                  ? "df-nav-link df-nav-link-active"
                  : "df-nav-link"
              }
            >
              Clients
            </NavLink>

            <NavLink
              to="/requests"
              className={({ isActive }) =>
                isActive
                  ? "df-nav-link df-nav-link-active"
                  : "df-nav-link"
              }
            >
              Demandes
            </NavLink>

            <NavLink
              to="/quotes"
              className={({ isActive }) =>
                isActive
                  ? "df-nav-link df-nav-link-active"
                  : "df-nav-link"
              }
            >
              Devis
            </NavLink>

            <NavLink
              to="/proformas"
              className={({ isActive }) =>
                isActive
                  ? "df-nav-link df-nav-link-active"
                  : "df-nav-link"
              }
            >
              Proformas
            </NavLink>

            <NavLink
              to="/purchase-orders"
              className={({ isActive }) =>
                isActive
                  ? "df-nav-link df-nav-link-active"
                  : "df-nav-link"
              }
            >
              Bons de commande
            </NavLink>

            <NavLink
              to="/execution"
              className={({ isActive }) =>
                isActive
                  ? "df-nav-link df-nav-link-active"
                  : "df-nav-link"
              }
            >
              Exécution
            </NavLink>

            <NavLink
              to="/invoices"
              className={({ isActive }) =>
                isActive
                  ? "df-nav-link df-nav-link-active"
                  : "df-nav-link"
              }
            >
              Factures
            </NavLink>

            <NavLink
              to="/recurrences"
              className={({ isActive }) =>
                isActive
                  ? "df-nav-link df-nav-link-active"
                  : "df-nav-link"
              }
            >
              Récurrences
            </NavLink>

            <NavLink
              to="/payments"
              className={({ isActive }) =>
                isActive
                  ? "df-nav-link df-nav-link-active"
                  : "df-nav-link"
              }
            >
              Paiements
            </NavLink>

            <NavLink
              to="/credit-notes"
              className={({ isActive }) =>
                isActive
                  ? "df-nav-link df-nav-link-active"
                  : "df-nav-link"
              }
            >
              Avoirs
            </NavLink>

            <NavLink
              to="/reminders"
              className={({ isActive }) =>
                isActive
                  ? "df-nav-link df-nav-link-active"
                  : "df-nav-link"
              }
            >
              Relances
            </NavLink>

            <NavLink
              to="/history"
              className={({ isActive }) =>
                isActive
                  ? "df-nav-link df-nav-link-active"
                  : "df-nav-link"
              }
            >
              Historique
            </NavLink>

          </div>
        </nav>


        {/* ==================================================
            FULL WIDTH BUSINESS WORKSPACE
            ================================================== */}
        <main className="df-main-content">
          <Routes>

            <Route
              path="/"
              element={<DashboardPage />}
            />

            <Route
              path="/clients"
              element={<ClientsPage />}
            />

            <Route
              path="/requests"
              element={<RequestsPage />}
            />

            <Route
              path="/quotes"
              element={<QuotesPage />}
            />

            <Route
              path="/proformas"
              element={<ProformasPage />}
            />

            <Route
              path="/purchase-orders"
              element={<PurchaseOrdersPage />}
            />

            <Route
              path="/execution"
              element={<OperationalDocumentsPage />}
            />

            <Route
              path="/invoices"
              element={<InvoicesPage />}
            />

            <Route
              path="/recurrences"
              element={<RecurringInvoicesPage />}
            />

            <Route
              path="/payments"
              element={<PaymentsPage />}
            />

            <Route
              path="/credit-notes"
              element={<CreditNotesPage />}
            />

            <Route
              path="/reminders"
              element={<RemindersPage />}
            />

            <Route
              path="/history"
              element={<HistoryPage />}
            />

          </Routes>
        </main>

      </div>
    </BrowserRouter>
  );
}

export default App;
