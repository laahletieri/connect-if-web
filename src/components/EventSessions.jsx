import { useCallback, useEffect, useState } from "react";
import { formatRange, toInputValue, toIso } from "../lib/dates";
import { supabase } from "../lib/supabaseClient";

const EMPTY_SESSION = {
  title: "",
  description: "",
  location: "",
  start_date: "",
  end_date: "",
  capacity: "",
};

function validateSession(form, eventStart, eventEnd, selectedCount) {
  if (form.title.trim().length < 2) return "Informe o título da sessão.";
  if (!form.start_date || !form.end_date) {
    return "Informe o início e o término da sessão.";
  }

  const start = new Date(form.start_date);
  const end = new Date(form.end_date);

  if (end <= start) return "O término da sessão deve ser depois do início.";

  if (start < new Date(eventStart) || end > new Date(eventEnd)) {
    return `A sessão deve acontecer dentro do período do evento (${formatRange(
      eventStart,
      eventEnd,
    )}).`;
  }

  if (form.capacity !== "") {
    const capacity = Number(form.capacity);

    if (!Number.isInteger(capacity) || capacity <= 0) {
      return "As vagas devem ser um número inteiro maior que zero.";
    }
    if (capacity < selectedCount) {
      return `Esta sessão já tem ${selectedCount} inscrito(s); as vagas não podem ser menores que isso.`;
    }
  }

  return "";
}

export default function EventSessions({ eventId, eventStart, eventEnd }) {
  const [sessions, setSessions] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [editing, setEditing] = useState(null); // null | 'new' | id da sessão
  const [form, setForm] = useState(EMPTY_SESSION);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const loadSessions = useCallback(async () => {
    const [sessionsRes, selectionsRes] = await Promise.all([
      supabase
        .from("event_sessions")
        .select(
          "id, title, description, location, start_date, end_date, capacity",
        )
        .eq("event_id", eventId)
        .order("start_date", { ascending: true }),
      // Cancelar a inscrição remove as seleções, então só restam as confirmadas.
      supabase
        .from("registration_sessions")
        .select("session_id")
        .eq("event_id", eventId),
    ]);

    if (sessionsRes.error || selectionsRes.error) {
      setLoadError("Não foi possível carregar as sessões.");
    } else {
      setLoadError("");
      setSessions(sessionsRes.data ?? []);

      const next = {};
      for (const row of selectionsRes.data ?? []) {
        next[row.session_id] = (next[row.session_id] ?? 0) + 1;
      }
      setCounts(next);
    }

    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  function startNew() {
    setForm(EMPTY_SESSION);
    setEditing("new");
    setError("");
    setNotice("");
  }

  function startEdit(session) {
    setForm({
      title: session.title ?? "",
      description: session.description ?? "",
      location: session.location ?? "",
      start_date: toInputValue(session.start_date),
      end_date: toInputValue(session.end_date),
      capacity: session.capacity ?? "",
    });
    setEditing(session.id);
    setError("");
    setNotice("");
  }

  function cancelForm() {
    setEditing(null);
    setError("");
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((old) => ({ ...old, [name]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setError("");

    const selectedCount = editing === "new" ? 0 : (counts[editing] ?? 0);
    const problem = validateSession(form, eventStart, eventEnd, selectedCount);

    if (problem) {
      setError(problem);
      return;
    }

    setSaving(true);

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      location: form.location.trim(),
      start_date: toIso(form.start_date),
      end_date: toIso(form.end_date),
      capacity: form.capacity === "" ? null : Number(form.capacity),
    };

    if (editing === "new") {
      const { error: insertError } = await supabase
        .from("event_sessions")
        .insert({ ...payload, event_id: eventId });

      if (insertError) {
        setSaving(false);
        setError(`Não foi possível criar a sessão: ${insertError.message}`);
        return;
      }
    } else {
      const { data, error: updateError } = await supabase
        .from("event_sessions")
        .update(payload)
        .eq("id", editing)
        .select("id");

      if (updateError || !data?.length) {
        setSaving(false);
        setError(
          updateError
            ? `Não foi possível salvar a sessão: ${updateError.message}`
            : "Não foi possível salvar. Você não tem permissão para editar esta sessão.",
        );
        return;
      }
    }

    await loadSessions();
    setSaving(false);
    setEditing(null);
    setNotice("Sessão salva.");
  }

  async function handleDelete(session) {
    setError("");
    setNotice("");
    setDeletingId(session.id);

    // Antes de excluir, confere se há inscritos ou presenças (a exclusão apagaria tudo em cascata).
    const [selectedRes, attendanceRes] = await Promise.all([
      supabase
        .from("registration_sessions")
        .select("id", { count: "exact", head: true })
        .eq("session_id", session.id),
      supabase
        .from("attendance")
        .select("id, registration_sessions!inner(session_id)", {
          count: "exact",
          head: true,
        })
        .eq("registration_sessions.session_id", session.id),
    ]);

    if (selectedRes.error || attendanceRes.error) {
      setDeletingId(null);
      setError(
        "Não foi possível verificar as inscrições desta sessão. Tente novamente.",
      );
      return;
    }

    const selected = selectedRes.count ?? 0;
    const attended = attendanceRes.count ?? 0;

    if (selected > 0 || attended > 0) {
      setDeletingId(null);
      setError(
        `A sessão "${session.title}" tem ${selected} inscrito(s) e ${attended} presença(s) registrada(s), por isso não pode ser excluída.`,
      );
      return;
    }

    if (!window.confirm(`Excluir a sessão "${session.title}"?`)) {
      setDeletingId(null);
      return;
    }

    const { data, error: deleteError } = await supabase
      .from("event_sessions")
      .delete()
      .eq("id", session.id)
      .select("id");

    setDeletingId(null);

    if (deleteError || !data?.length) {
      setError("Não foi possível excluir a sessão.");
      return;
    }

    await loadSessions();
    setNotice("Sessão excluída.");
  }

  return (
    <section className="sessions-card">
      <div className="page-header">
        <h3>Sessões do evento</h3>
        {editing === null && (
          <button type="button" onClick={startNew}>
            Adicionar sessão
          </button>
        )}
      </div>

      <p className="form-hint">
        Use sessões para atividades como palestras e minicursos. A duração de
        cada sessão é usada para calcular as horas do certificado. Eventos sem
        sessões registram a presença no próprio evento.
      </p>

      {notice && <p className="notice">{notice}</p>}
      {error && <p className="form-error">{error}</p>}

      {editing !== null && (
        <form className="session-form" onSubmit={handleSave}>
          <h4>{editing === "new" ? "Nova sessão" : "Editar sessão"}</h4>

          <div className="form-field">
            <label htmlFor="session_title">Título</label>
            <input
              id="session_title"
              name="title"
              value={form.title}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="session_description">Descrição (opcional)</label>
            <textarea
              id="session_description"
              name="description"
              value={form.description}
              onChange={handleChange}
            />
          </div>

          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="session_start">Início</label>
              <input
                id="session_start"
                name="start_date"
                type="datetime-local"
                value={form.start_date}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="session_end">Término</label>
              <input
                id="session_end"
                name="end_date"
                type="datetime-local"
                value={form.end_date}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="session_location">Local (opcional)</label>
              <input
                id="session_location"
                name="location"
                value={form.location}
                onChange={handleChange}
              />
            </div>

            <div className="form-field">
              <label htmlFor="session_capacity">Vagas</label>
              <input
                id="session_capacity"
                name="capacity"
                type="number"
                min="1"
                step="1"
                value={form.capacity}
                onChange={handleChange}
              />
              <p className="form-hint">Deixe em branco para não limitar.</p>
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" disabled={saving}>
              {saving ? "Salvando..." : "Salvar sessão"}
            </button>
            <button
              type="button"
              className="button-secondary"
              onClick={cancelForm}
              disabled={saving}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {loading && <p className="muted">Carregando sessões...</p>}
      {loadError && <p className="form-error">{loadError}</p>}
      {!loading && !loadError && sessions.length === 0 && editing === null && (
        <p className="muted">Nenhuma sessão cadastrada.</p>
      )}

      <ul className="session-list">
        {sessions.map((session) => (
          <li key={session.id} className="session-item">
            <div>
              <strong>{session.title}</strong>
              <small className="muted">
                {formatRange(session.start_date, session.end_date)}
              </small>
              {session.location && (
                <small className="muted">{session.location}</small>
              )}
              <small className="muted">
                {counts[session.id] ?? 0} inscrito(s)
                {session.capacity ? ` de ${session.capacity} vagas` : ""}
              </small>
            </div>

            <div className="session-actions">
              <button
                type="button"
                className="button-secondary"
                onClick={() => startEdit(session)}
                disabled={editing !== null}
              >
                Editar
              </button>
              <button
                type="button"
                className="link-danger"
                onClick={() => handleDelete(session)}
                disabled={editing !== null || deletingId === session.id}
              >
                {deletingId === session.id ? "Verificando..." : "Excluir"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
