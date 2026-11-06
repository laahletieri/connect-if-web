import { useState } from "react";
import AuthCard from "../components/AuthCard";

// Quando o link do e-mail é inválido ou expirou, o Supabase devolve o erro na URL.
function hasLinkError() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);

  return (
    hash.has("error") ||
    hash.has("error_code") ||
    query.has("error") ||
    query.has("error_code")
  );
}

export default function EmailConfirmed() {
  const [failed] = useState(hasLinkError);

  if (failed) {
    return (
      <AuthCard subtitle="Link inválido ou expirado">
        <p className="muted">
          Não foi possível confirmar o e-mail com este link. Ele pode ter
          expirado ou já ter sido usado. Se você já confirmou, basta entrar
          normalmente. Se o problema continuar, tente se cadastrar novamente com
          o mesmo e-mail para receber um novo link.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard subtitle="E-mail confirmado!">
      <p className="confirm-icon" aria-hidden="true">
        ✓
      </p>
      <p>
        Seu cadastro foi confirmado com sucesso. Você já pode fechar esta página
        e entrar no aplicativo ou no painel do Connect IF.
      </p>
    </AuthCard>
  );
}
