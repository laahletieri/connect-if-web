import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import AuthCard from "../components/AuthCard";
import { useAuth } from "../contexts/AuthContext";

function translateError(message) {
  if (message?.includes("Invalid login credentials")) {
    return "E-mail ou senha incorretos.";
  }
  if (message?.includes("Email not confirmed")) {
    return "Confirme seu e-mail antes de entrar.";
  }
  return "Não foi possível entrar. Tente novamente.";
}

export default function Login() {
  const { user, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const { error: signInError } = await signIn(email.trim(), password);

    setSubmitting(false);

    if (signInError) {
      setError(translateError(signInError.message));
      return;
    }

    navigate("/", { replace: true });
  }

  return (
    <AuthCard subtitle="Painel do organizador" onSubmit={handleSubmit}>
      {location.state?.passwordReset && (
        <p className="form-success">Senha alterada. Entre com a nova senha.</p>
      )}

      <label htmlFor="email">E-mail</label>
      <input
        id="email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        required
      />

      <label htmlFor="password">Senha</label>
      <input
        id="password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
        required
      />

      {error && <p className="form-error">{error}</p>}

      <button type="submit" disabled={submitting}>
        {submitting ? "Entrando..." : "Entrar"}
      </button>

      <div className="auth-links">
        <Link to="/esqueci-senha">Esqueci minha senha</Link>
        <Link to="/cadastro">Criar conta</Link>
      </div>
    </AuthCard>
  );
}
