import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import AppLayout from "../components/AppLayout";
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
  const { user } = useAuth();
  const location = useLocation();
  const notice = location.state?.notice;
  const [events, setEvents] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // Somente os eventos em que o usuário é administrador.
      const { data, error: loadError } = await supabase
        .from("event_members")
        .select("events ( id, title, status, start_date )")
        .eq("user_id", user.id)
        .eq("role", "administrator");

      if (loadError) {
        setError(loadError.message);
      } else {
        const list = (data ?? [])
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
    <AppLayout>
      <div className="page-header">
        <h2>Meus eventos</h2>
        <Link to="/eventos/novo" className="button-link">
          Novo evento
        </Link>
      </div>

      {notice && <p className="notice">{notice}</p>}
      {loading && <p className="muted">Carregando...</p>}
      {error && <p className="form-error">{error}</p>}
      {!loading && !error && events.length === 0 && (
        <p className="muted">Você ainda não administra nenhum evento.</p>
      )}

      <ul className="event-list">
        {events.map((ev) => (
          <li key={ev.id}>
            <Link to={`/eventos/${ev.id}`} className="event-row">
              <div>
                <strong>{ev.title}</strong>
                <small className="muted" style={{ display: "block" }}>
                  {formatDate(ev.start_date)}
                </small>
              </div>
              <span className={`badge badge-${ev.status}`}>
                {STATUS_LABEL[ev.status] ?? ev.status}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </AppLayout>
  );
}
