"use client";

import { useState } from "react";

export function LoginForm() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const next = new URLSearchParams(window.location.search).get("next") || "/";
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
      }),
    });
    if (!res.ok) {
      setBusy(false);
      setError("Invalid email or password.");
      return;
    }
    window.location.assign(next.startsWith("/") ? next : "/");
  }

  return (
    <form className="login-form" onSubmit={(event) => void onSubmit(event)}>
      <label>
        Email
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          defaultValue="cfo@donecorner.ai"
        />
      </label>
      <label>
        Password
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      {error ? <p className="login-error">{error}</p> : null}
      <button type="submit" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
