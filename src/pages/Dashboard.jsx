import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabaseClient";

const STATUS_LABEL = {
  draft: "Rascunho",
  published: "Publicado",
  cancelled: "Cancelado",
};

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString("pt-BR") : "";
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const [name, setName] = useState("");
  const [events, setEvents] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [profileRes, membersRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle(),
        // Somente os eventos em que o usuário é administrador.
        supabase
          .from("event_members")
          .select("events ( id, title, status, start_date )")
          .eq("user_id", user.id)
          .eq("role", "administrator"),
      ]);

      const failure = profileRes.error || membersRes.error;

      if (failure) {
        setError(failure.message);
      } else {
        setName(profileRes.data?.full_name ?? "");

        const list = (membersRes.data ?? [])
          .map((row) => row.events)
          .filter(Boolean)
          .sort((a, b) => new Date(b.start_date) - new Date(a.start_date));

        setEvents(list);
      }

      setLoading(false);
    }

    load();
  }, [user.id]);

  return (
    <div className="dashboard">
      <header className="topbar">
        <strong>Connect IF</strong>
        <div>
          <span>{name || user.email}</span>
          <button onClick={signOut}>Sair</button>
        </div>
      </header>

      <main className="content">
        <h2>Meus eventos</h2>

        {loading && <p className="muted">Carregando...</p>}
        {error && <p className="form-error">{error}</p>}
        {!loading && !error && events.length === 0 && (
          <p className="muted">Você ainda não administra nenhum evento.</p>
        )}

        <ul className="event-list">
          {events.map((ev) => (
            <li key={ev.id}>
              <div>
                <strong>{ev.title}</strong>
                <small className="muted" style={{ display: "block" }}>
                  {formatDate(ev.start_date)}
                </small>
              </div>
              <span className={`badge badge-${ev.status}`}>
                {STATUS_LABEL[ev.status] ?? ev.status}
              </span>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
