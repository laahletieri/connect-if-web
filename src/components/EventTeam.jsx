import { useCallback, useEffect, useState } from "react";
import { formatCpf, onlyDigits } from "../lib/cpf";
import { supabase } from "../lib/supabaseClient";

const ROLE_LABEL = {
  administrator: "Administrador",
  attendance_manager: "Responsável pela presença",
};

export default function EventTeam({ eventId }) {
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [cpf, setCpf] = useState("");
  const [found, setFound] = useState(null); // { profile_id, full_name }
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadTeam = useCallback(async () => {
    const { data, error: rpcError } = await supabase.rpc("list_event_team", {
      p_event_id: eventId,
    });

    if (rpcError) {
      setLoadError("Não foi possível carregar a equipe.");
    } else {
      setLoadError("");
      setTeam(data ?? []);
    }

    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    loadTeam();
  }, [loadTeam]);

  async function handleSearch(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    setFound(null);

    const digits = onlyDigits(cpf);

    if (digits.length !== 11) {
      setError("Informe um CPF com 11 dígitos.");
      return;
    }

    setSearching(true);

    const { data, error: rpcError } = await supabase.rpc(
      "find_profile_by_cpf",
      { p_event_id: eventId, p_cpf: digits },
    );

    setSearching(false);

    if (rpcError) {
      setError(`Não foi possível buscar: ${rpcError.message}`);
      return;
    }

    const profile = Array.isArray(data) ? data[0] : data;

    if (!profile) {
      setError(
        "Nenhuma pessoa cadastrada com este CPF. Peça para ela criar a conta no aplicativo ou no painel primeiro.",
      );
      return;
    }

    const existing = team.find((m) => m.member_user_id === profile.profile_id);

    if (existing) {
      setError(
        `${profile.full_name} já faz parte da equipe (${
          ROLE_LABEL[existing.member_role] ?? existing.member_role
        }).`,
      );
      return;
    }

    setFound(profile);
  }

  async function handleAdd() {
    if (!found) return;

    setError("");
    setAdding(true);

    const { error: insertError } = await supabase.from("event_members").insert({
      event_id: eventId,
      user_id: found.profile_id,
      role: "attendance_manager",
    });

    setAdding(false);

    if (insertError) {
      setError(
        insertError.code === "23505"
          ? "Esta pessoa já faz parte da equipe."
          : `Não foi possível adicionar: ${insertError.message}`,
      );
      return;
    }

    setNotice(
      `${found.full_name} agora é responsável pela presença deste evento. Peça para a pessoa atualizar o aplicativo (puxar a tela para baixo) ou reabri-lo.`,
    );
    setFound(null);
    setCpf("");
    await loadTeam();
  }

  async function handleRemove(member) {
    if (member.member_role !== "attendance_manager") return;

    if (!window.confirm(`Remover ${member.member_name} da equipe?`)) return;

    setError("");
    setNotice("");
    setRemovingId(member.member_id);

    // Só responsáveis pela presença podem ser removidos por aqui.
    const { data, error: deleteError } = await supabase
      .from("event_members")
      .delete()
      .eq("id", member.member_id)
      .eq("role", "attendance_manager")
      .select("id");

    setRemovingId(null);

    if (deleteError || !data?.length) {
      setError("Não foi possível remover esta pessoa da equipe.");
      return;
    }

    setNotice(`${member.member_name} foi removido(a) da equipe.`);
    await loadTeam();
  }

  return (
    <section className="sessions-card">
      <div className="page-header">
        <h3>Equipe do evento</h3>
      </div>

      <p className="form-hint">
        Quem criou o evento é o administrador. Os responsáveis pela presença
        validam a presença dos participantes pelo aplicativo. Busque a pessoa
        pelo CPF; ela precisa já ter uma conta.
      </p>

      {notice && <p className="notice">{notice}</p>}
      {error && <p className="form-error">{error}</p>}

      <form className="team-search" onSubmit={handleSearch}>
        <div className="form-field">
          <label htmlFor="team_cpf">CPF</label>
          <input
            id="team_cpf"
            value={cpf}
            onChange={(e) => setCpf(formatCpf(e.target.value))}
            inputMode="numeric"
            placeholder="000.000.000-00"
          />
        </div>
        <button type="submit" disabled={searching}>
          {searching ? "Buscando..." : "Buscar"}
        </button>
      </form>

      {found && (
        <div className="team-found">
          <span>
            <strong>{found.full_name}</strong> encontrado(a).
          </span>
          <button type="button" onClick={handleAdd} disabled={adding}>
            {adding
              ? "Adicionando..."
              : "Adicionar como responsável pela presença"}
          </button>
        </div>
      )}

      {loading && <p className="muted">Carregando equipe...</p>}
      {loadError && <p className="form-error">{loadError}</p>}

      <ul className="session-list">
        {team.map((member) => (
          <li key={member.member_id} className="session-item">
            <div>
              <strong>{member.member_name}</strong>
              <small className="muted">
                {ROLE_LABEL[member.member_role] ?? member.member_role}
              </small>
            </div>

            {member.member_role === "attendance_manager" && (
              <button
                type="button"
                className="link-danger"
                onClick={() => handleRemove(member)}
                disabled={removingId === member.member_id}
              >
                {removingId === member.member_id ? "Removendo..." : "Remover"}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
