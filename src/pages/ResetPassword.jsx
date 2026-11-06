import { useState } from "react";
import { Link } from "react-router-dom";
import AuthCard from "../components/AuthCard";
import { useAuth } from "../contexts/AuthContext";

function translateError(message) {
  if (message?.includes("different from the old password")) {
    return "A nova senha deve ser diferente da anterior.";
  }
  if (message?.toLowerCase().includes("password")) {
    return "Senha não aceita. Escolha outra senha, com pelo menos 6 caracteres.";
  }
  return "Não foi possível alterar a senha. Peça um novo link e tente de novo.";
}

export default function ResetPassword() {
  const { user, loading, updatePassword, signOut } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  if (loading) return <p className="page-message">Carregando...</p>;

  // Fica antes da checagem de "user": depois do signOut não há mais sessão.
  if (done) {
    return (
      <AuthCard subtitle="Senha alterada!">
        <p className="confirm-icon" aria-hidden="true">
          ✓
        </p>
        <p>
          Sua senha foi alterada com sucesso. Você já pode fechar esta página e
          entrar no aplicativo ou no painel com a nova senha.
        </p>
      </AuthCard>
    );
  }

  // Sem sessão de recuperação, o link é inválido ou expirou.
  if (!user) {
    return (
      <AuthCard subtitle="Link inválido ou expirado">
        <p className="muted">Peça um novo link para redefinir a senha.</p>
        <div className="auth-links">
          <Link to="/esqueci-senha">Pedir novo link</Link>
          <Link to="/login">Voltar ao login</Link>
        </div>
      </AuthCard>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não conferem.");
      return;
    }

    setSubmitting(true);
    const { error: updateError } = await updatePassword(password);

    if (updateError) {
      setSubmitting(false);
      setError(translateError(updateError.message));
      return;
    }

    setDone(true);
    await signOut();
  }

  return (
    <AuthCard subtitle="Nova senha" onSubmit={handleSubmit}>
      <label htmlFor="password">Nova senha</label>
      <input
        id="password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="new-password"
        required
      />

      <label htmlFor="confirm">Confirmar nova senha</label>
      <input
        id="confirm"
        type="password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        autoComplete="new-password"
        required
      />

      {error && <p className="form-error">{error}</p>}

      <button type="submit" disabled={submitting}>
        {submitting ? "Salvando..." : "Salvar nova senha"}
      </button>
    </AuthCard>
  );
}
