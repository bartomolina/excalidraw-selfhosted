import { useState } from "react";
import type { FormEvent } from "react";

import { authClient } from "../data/authClient";

import "./AuthScreen.scss";

export const AuthScreen = () => {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const result = await authClient.signIn.magicLink({
      email,
      callbackURL: `${window.location.origin}/`,
    });

    setIsSubmitting(false);

    if (result.error) {
      setErrorMessage(result.error.message || "Unable to send sign-in email.");
      return;
    }

    setSuccessMessage(`Magic link sent to ${email}.`);
  };

  return (
    <div className="excalidraw-auth-screen">
      <div className="excalidraw-auth-card">
        <div className="excalidraw-auth-card__halo" aria-hidden="true" />
        <div className="excalidraw-auth-card__eyebrow-row">
          <div className="excalidraw-auth-card__eyebrow">Private Excalidraw</div>
        </div>

        <div className="excalidraw-auth-card__header">
          <h1>Sign in</h1>
        </div>

        <form className="excalidraw-auth-card__form" onSubmit={onSubmit}>
          <label>
            Email
            <input
              autoComplete="email"
              autoFocus
              disabled={isSubmitting}
              inputMode="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              type="email"
              value={email}
            />
          </label>
          <button disabled={isSubmitting || !email.trim()} type="submit">
            {isSubmitting ? "Sending…" : "Send magic link"}
          </button>
        </form>

        {errorMessage ? (
          <div className="excalidraw-auth-card__message excalidraw-auth-card__message--error">
            {errorMessage}
          </div>
        ) : null}
        {successMessage ? (
          <div className="excalidraw-auth-card__message excalidraw-auth-card__message--success">
            {successMessage}
          </div>
        ) : null}

        <p className="excalidraw-auth-card__hint">We’ll email you a one-time sign-in link.</p>
      </div>
    </div>
  );
};
