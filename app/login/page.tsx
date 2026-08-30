import { LoginForm } from "@/components/shell/LoginForm";

export default function LoginPage() {
  return (
    <main className="login-screen">
      <p className="login-kicker">DoneCornerAI</p>
      <h1>Sign in to the Signal Room</h1>
      <p className="login-lede">
        Northstar Close is view-only until you authenticate. Org publish still
        waits for TrueForge approval.
      </p>
      <LoginForm />
    </main>
  );
}
