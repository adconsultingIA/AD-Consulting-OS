import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./coreflow-ui.css";
import "./index.css";
import "./coreflow-compat.css";

import AuthenticatedApp
  from "./AuthenticatedApp";

import {
  AuthProvider,
} from "./context/AuthContext";

import {
  WorkspaceProvider,
} from "./context/WorkspaceContext";


createRoot(
  document.getElementById("root")!
).render(
  <StrictMode>
    <AuthProvider>
      <WorkspaceProvider>
        <AuthenticatedApp />
      </WorkspaceProvider>
    </AuthProvider>
  </StrictMode>,
);
