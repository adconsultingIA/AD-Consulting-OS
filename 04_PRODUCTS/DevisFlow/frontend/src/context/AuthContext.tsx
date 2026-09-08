import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type {
  Session,
} from "@supabase/supabase-js";

import { API_URL } from "../config/api";
import { supabase } from "../lib/supabase";


export type CoreMembership = {
  id: string;
  organization_id: string;
  user_id: string;
  role: string;
  status: string;
  access_expires_at?: string | null;
};


export type CoreIdentity = {
  user_id: string;
  email: string;
  full_name: string;
  avatar_url?: string | null;
  memberships: CoreMembership[];
};


type AuthContextValue = {
  session: Session | null;
  identity: CoreIdentity | null;

  sessionLoading: boolean;
  identityLoading: boolean;

  error: string | null;

  signOut: () => Promise<void>;
};


const AuthContext =
  createContext<AuthContextValue | null>(
    null
  );


export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [session, setSession] =
    useState<Session | null>(null);

  const [identity, setIdentity] =
    useState<CoreIdentity | null>(null);

  const [sessionLoading, setSessionLoading] =
    useState(true);

  const [identityLoading, setIdentityLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);


  async function loadIdentity(
    nextSession: Session | null
  ) {
    setSession(nextSession);

    if (!nextSession?.access_token) {
      setIdentity(null);
      setIdentityLoading(false);
      setError(null);
      return;
    }

    try {
      setIdentityLoading(true);
      setError(null);

      const response = await fetch(
        `${API_URL}/coreflow/me`,
        {
          headers: {
            Authorization:
              `Bearer ${nextSession.access_token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          `Identité CoreFlow indisponible (${response.status})`
        );
      }

      const data =
        (await response.json()) as CoreIdentity;

      setIdentity(data);

    } catch (err) {
      setIdentity(null);

      setError(
        err instanceof Error
          ? err.message
          : "Impossible de charger l'identité."
      );

    } finally {
      setIdentityLoading(false);
    }
  }


  async function signOut() {
    setError(null);

    await supabase.auth.signOut();

    setSession(null);
    setIdentity(null);
  }


  useEffect(() => {
    let active = true;


    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) {
          return;
        }

        setSessionLoading(false);

        void loadIdentity(
          data.session
        );
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setSessionLoading(false);
        setSession(null);
        setIdentity(null);
      });


    const {
      data: { subscription },
    } =
      supabase.auth.onAuthStateChange(
        (_event, nextSession) => {
          if (!active) {
            return;
          }

          setSessionLoading(false);

          void loadIdentity(
            nextSession
          );
        }
      );


    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);


  const value = useMemo(
    () => ({
      session,
      identity,

      sessionLoading,
      identityLoading,

      error,

      signOut,
    }),
    [
      session,
      identity,
      sessionLoading,
      identityLoading,
      error,
    ]
  );


  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}


export function useAuth() {
  const context =
    useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth doit être utilisé dans AuthProvider."
    );
  }

  return context;
}
