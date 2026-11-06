import { useState } from "react";
import { Link } from "react-router-dom";
import AuthCard from "../components/AuthCard";
import { useAuth } from "../contexts/AuthContext";

export default function ForgotPassword() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    setSubmitting(true);

    const { error: resetError } = await resetPassword(email.trim());

    setSubmitting(false);

    if (resetError) {
      const limited =
        resetError.status === 429 ||
        resetError.message?.toLowerCase().includes("rate limit");
      setError(
        limited
          ? "Muitos pedidos seguidos. Aguarde alguns minutos e tente de novo."
          : "Não foi possível enviar o e-mail. Tente novamente.",
      );
      return;
    }

    // Mensagem neutra: não revela se o e-mail existe.
    setInfo(
      "Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.",
    );
  }

  return (
    <AuthCard subtitle="Redefinir senha" onSubmit={handleSubmit}>
      <label htmlFor="email">E-mail</label>
      <input
        id="email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        required
      />

      {error && <p className="form-error">{error}</p>}
      {info && <p className="form-success">{info}</p>}

      <button type="submit" disabled={submitting}>
        {submitting ? "Enviando..." : "Enviar link"}
      </button>

      <div className="auth-links">
        <Link to="/login">Voltar ao login</Link>
      </div>
    </AuthCard>
  );
}
