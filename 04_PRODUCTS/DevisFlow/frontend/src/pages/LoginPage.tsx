import {
  useState,
  type FormEvent,
} from "react";

import { supabase } from "../lib/supabase";


export default function LoginPage() {
  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);


  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setLoading(true);
    setError(null);

    try {
      const {
        error: authError,
      } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (authError) {
        throw authError;
      }

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Connexion impossible."
      );

    } finally {
      setLoading(false);
    }
  }


  return (
    <main className="df-login-page">
      <section className="df-login-card">

        <div className="df-login-brand">
          <div className="df-login-mark">
            DF
          </div>

          <div>
            <strong>
              DevisFlow
            </strong>

            <span>
              Gestion commerciale
            </span>
          </div>
        </div>


        <div className="df-login-heading">
          <span>
            AD Consulting IA
          </span>

          <h1>
            Connexion
          </h1>

          <p>
            Connectez-vous avec votre compte
            AD Consulting IA.
          </p>
        </div>


        <form
          className="df-login-form"
          onSubmit={handleSubmit}
        >
          <label>
            <span>
              Adresse e-mail
            </span>

            <input
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              autoComplete="email"
              required
            />
          </label>


          <label>
            <span>
              Mot de passe
            </span>

            <input
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              autoComplete="current-password"
              required
            />
          </label>


          {error && (
            <div
              className="df-login-error"
              role="alert"
            >
              {error}
            </div>
          )}


          <button
            type="submit"
            className="df-login-submit"
            disabled={loading}
          >
            {loading
              ? "Connexion…"
              : "Se connecter"}
          </button>
        </form>

      </section>
    </main>
  );
}
