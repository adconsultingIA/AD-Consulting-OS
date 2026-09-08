import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { API_URL } from "../config/api";
import { useAuth } from "./AuthContext";


export type WorkspaceOrganization = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
};


export type WorkspaceProduct = {
  code: string;
  name: string;
  description?: string | null;
  category?: string | null;
  status?: string | null;
  active: boolean;
};


export type WorkspaceAccess = {
  organization_product_id?: string | null;
  product_code: string;
  enabled: boolean;
  status?: string | null;
  plan?: string | null;
  activated_at?: string | null;
  expires_at?: string | null;
  entitlements: Record<string, unknown>;
};


export type WorkspaceBranding = {
  organization: Record<string, unknown>;
  product: Record<string, unknown>;
};


export type WorkspaceContextData = {
  organization: WorkspaceOrganization;
  product: WorkspaceProduct;
  access: WorkspaceAccess;
  branding: WorkspaceBranding;
};


type WorkspaceContextValue = {
  workspace: WorkspaceContextData | null;
  loading: boolean;
  error: string | null;
  refreshWorkspace: () => Promise<void>;
};


const WorkspaceContext =
  createContext<WorkspaceContextValue | null>(
    null
  );


export function WorkspaceProvider({
  children,
}: {
  children: ReactNode;
}) {
  const {
    session,
    identity,
    identityLoading,
  } = useAuth();

  const [workspace, setWorkspace] =
    useState<WorkspaceContextData | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);


  async function refreshWorkspace() {
    if (
      identityLoading
      || !session?.access_token
      || !identity
    ) {
      return;
    }

    const params =
      new URLSearchParams(
        window.location.search
      );

    const requestedOrganizationId =
      params.get("organization_id");

    const storedOrganizationId =
      sessionStorage.getItem(
        "devisflow.organization_id"
      );

    const organizationId =
      requestedOrganizationId
      ?? storedOrganizationId
      ?? identity.memberships[0]
        ?.organization_id
      ?? null;

    if (!organizationId) {
      setWorkspace(null);
      setError(
        "Aucune organisation CoreFlow active."
      );
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `${API_URL}/coreflow/authenticated-workspace-context`,
        {
          headers: {
            Authorization:
              `Bearer ${session.access_token}`,
            "X-Organization-Id":
              organizationId,
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          `Workspace CoreFlow indisponible (${response.status})`
        );
      }

      const data =
        (await response.json()) as WorkspaceContextData;

      sessionStorage.setItem(
        "devisflow.organization_id",
        data.organization.id
      );

      setWorkspace(data);

    } catch (err) {
      setWorkspace(null);

      setError(
        err instanceof Error
          ? err.message
          : "Impossible de charger le workspace."
      );

    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (
      identityLoading
      || !session?.access_token
      || !identity
    ) {
      return;
    }

    void refreshWorkspace();
  }, [
    identityLoading,
    session?.access_token,
    identity,
  ]);


  const value = useMemo(
    () => ({
      workspace,
      loading,
      error,
      refreshWorkspace,
    }),
    [
      workspace,
      loading,
      error,
    ]
  );


  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}


export function useWorkspace() {
  const context =
    useContext(WorkspaceContext);

  if (!context) {
    throw new Error(
      "useWorkspace doit être utilisé dans WorkspaceProvider."
    );
  }

  return context;
}
