import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import AuthCard from "../components/AuthCard";
import { useAuth } from "../contexts/AuthContext";
import { formatCpf, isValidCpf, onlyDigits } from "../lib/cpf";

function translateError(message) {
  if (message?.includes("already registered")) {
    return "Este e-mail já está cadastrado.";
  }
  if (message?.includes("Database error saving new user")) {
    return "Não foi possível concluir o cadastro. Verifique se o CPF e o RA já não estão cadastrados.";
  }
  if (message?.includes("at least")) {
    return "A senha deve ter pelo menos 6 caracteres.";
  }
  if (message?.toLowerCase().includes("rate limit")) {
    return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  }
  return "Não foi possível criar a conta. Tente novamente.";
}

export default function Register() {
  const { user, loading, signUp } = useAuth();
  const [fullName, setFullName] = useState("");
  const [cpf, setCpf] = useState("");
  const [ra, setRa] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setInfo("");

    if (fullName.trim().length < 3) {
      setError("Informe o nome completo.");
      return;
    }
    if (!isValidCpf(cpf)) {
      setError("CPF inválido.");
      return;
    }
    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não conferem.");
      return;
    }

    setSubmitting(true);

    const { data, error: signUpError } = await signUp({
      email: email.trim(),
      password,
      fullName: fullName.trim(),
      cpf: onlyDigits(cpf),
      ra: ra.trim(),
    });

    setSubmitting(false);

    if (signUpError) {
      setError(translateError(signUpError.message));
      return;
    }

    // Com confirmação de e-mail ativa, um e-mail já cadastrado volta sem erro e sem identidades.
    if (data.user && data.user.identities?.length === 0) {
      setError("Este e-mail já está cadastrado.");
      return;
    }

    // Sem sessão = o Supabase exige confirmação por e-mail.
    if (!data.session) {
      setInfo(
        "Conta criada. Enviamos um e-mail de confirmação; confirme-o para entrar.",
      );
    }
    // Com sessão, o redirecionamento acima leva ao painel.
  }

  return (
    <AuthCard subtitle="Criar conta" onSubmit={handleSubmit}>
      <label htmlFor="fullName">Nome completo</label>
      <input
        id="fullName"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        autoComplete="name"
        required
      />

      <label htmlFor="cpf">CPF</label>
      <input
        id="cpf"
        value={cpf}
        onChange={(e) => setCpf(formatCpf(e.target.value))}
        inputMode="numeric"
        placeholder="000.000.000-00"
        required
      />

      <label htmlFor="ra">RA (opcional)</label>
      <input id="ra" value={ra} onChange={(e) => setRa(e.target.value)} />

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
        autoComplete="new-password"
        required
      />

      <label htmlFor="confirm">Confirmar senha</label>
      <input
        id="confirm"
        type="password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        autoComplete="new-password"
        required
      />

      {error && <p className="form-error">{error}</p>}
      {info && <p className="form-success">{info}</p>}

      <button type="submit" disabled={submitting}>
        {submitting ? "Criando conta..." : "Criar conta"}
      </button>

      <div className="auth-links">
        <Link to="/login">Já tenho conta</Link>
      </div>
    </AuthCard>
  );
}
