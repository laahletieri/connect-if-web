import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import { formatCpf } from "../lib/cpf";
import { formatRange } from "../lib/dates";
import { supabase } from "../lib/supabaseClient";

// 4.5 -> "4h30"
function formatHours(value) {
  const totalMinutes = Math.round(Number(value) * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return minutes === 0
    ? `${hours}h`
    : `${hours}h${String(minutes).padStart(2, "0")}`;
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function slugify(text) {
  return (
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "evento"
  );
}

export default function AttendanceReport() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [hasSessions, setHasSessions] = useState(false);
  const [report, setReport] = useState([]);
  const [scope, setScope] = useState("present"); // 'present' | 'all'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [issuedAt] = useState(() => new Date());

  useEffect(() => {
    let active = true;

    async function load() {
      const [eventRes, sessionsRes, reportRes] = await Promise.all([
        supabase
          .from("events")
          .select("id, title, campus, start_date, end_date")
          .eq("id", id)
          .maybeSingle(),
        supabase
          .from("event_sessions")
          .select("id", { count: "exact", head: true })
          .eq("event_id", id),
        supabase.rpc("get_event_attendance_report", { p_event_id: id }),
      ]);

      if (!active) return;

      if (reportRes.error) {
        setError(reportRes.error.message);
      } else if (eventRes.error || sessionsRes.error) {
        setError("Não foi possível carregar os dados do evento.");
      } else if (!eventRes.data) {
        setError("Evento não encontrado.");
      } else {
        setEvent(eventRes.data);
        setHasSessions((sessionsRes.count ?? 0) > 0);
        setReport(reportRes.data ?? []);
      }

      setLoading(false);
    }

    load();

    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <AppLayout>
        <p className="muted">Carregando...</p>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <p className="form-error">{error}</p>
        <p>
          <Link to="/" className="button-link button-secondary">
            Voltar para meus eventos
          </Link>
        </p>
      </AppLayout>
    );
  }

  const present = report.filter((row) => row.attended);
  const rows = scope === "present" ? present : report;
  const title =
    scope === "present" ? "Lista de presença" : "Lista de inscritos";

  function handleDownload() {
    const header = ["Nome", "CPF", "RA"];
    if (scope === "all") header.push("Presença");
    if (hasSessions) {
      header.push(
        "Sessões presentes",
        "Sessões inscritas",
        "Horas (decimal)",
        "Horas",
      );
    }

    const lines = rows.map((row) => {
      const cols = [
        row.participant_name,
        formatCpf(row.participant_cpf),
        row.participant_ra ?? "",
      ];
      if (scope === "all") cols.push(row.attended ? "Presente" : "Ausente");
      if (hasSessions) {
        cols.push(
          row.sessions_present,
          row.sessions_selected,
          Number(row.total_hours).toFixed(2).replace(".", ","),
          formatHours(row.total_hours),
        );
      }
      return cols;
    });

    // BOM + ponto e vírgula: o Excel em português abre acentos e colunas corretamente.
    const content =
      "\uFEFF" +
      [header, ...lines]
        .map((cols) => cols.map(csvEscape).join(";"))
        .join("\r\n");

    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${scope === "present" ? "lista-presenca" : "lista-inscritos"}-${slugify(
      event.title,
    )}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <AppLayout>
      <div className="page-header">
        <h2>{title}</h2>
        <Link
          to={`/eventos/${id}`}
          className="button-link button-secondary no-print"
        >
          Voltar ao evento
        </Link>
      </div>

      <div className="report-toolbar no-print">
        <div className="segmented" role="group" aria-label="Filtro da lista">
          <button
            type="button"
            className={scope === "present" ? "active" : ""}
            onClick={() => setScope("present")}
          >
            Somente presentes
          </button>
          <button
            type="button"
            className={scope === "all" ? "active" : ""}
            onClick={() => setScope("all")}
          >
            Todos os inscritos
          </button>
        </div>

        <button
          type="button"
          onClick={handleDownload}
          disabled={rows.length === 0}
        >
          Baixar CSV
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          disabled={rows.length === 0}
        >
          Imprimir / salvar em PDF
        </button>
      </div>

      <section className="report-header">
        <p>
          <strong>{event.title}</strong>
        </p>
        <p className="muted">
          {event.campus ? `Campus ${event.campus} · ` : ""}
          {formatRange(event.start_date, event.end_date)}
        </p>
        <p className="muted">Emitido em {issuedAt.toLocaleString("pt-BR")}</p>
        <p className="report-summary">
          {present.length} presente(s) de {report.length} inscrito(s)
          confirmado(s)
        </p>
        {!hasSessions && (
          <p className="muted">
            Evento sem sessões: a presença é registrada no próprio evento e a
            carga horária fica a cargo da secretaria.
          </p>
        )}
      </section>

      {rows.length === 0 ? (
        <p className="muted">
          {scope === "present"
            ? "Nenhuma presença registrada até o momento."
            : "Nenhuma inscrição confirmada neste evento."}
        </p>
      ) : (
        <table className="report-table">
          <thead>
            <tr>
              <th className="num">#</th>
              <th>Nome</th>
              <th>CPF</th>
              <th>RA</th>
              {scope === "all" && <th>Presença</th>}
              {hasSessions && <th className="num">Sessões presentes</th>}
              {hasSessions && <th className="num">Horas</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.report_registration_id}>
                <td className="num">{index + 1}</td>
                <td>{row.participant_name}</td>
                <td>{formatCpf(row.participant_cpf)}</td>
                <td>{row.participant_ra || "—"}</td>
                {scope === "all" && (
                  <td>{row.attended ? "Presente" : "Ausente"}</td>
                )}
                {hasSessions && (
                  <td className="num">
                    {row.sessions_present} de {row.sessions_selected}
                  </td>
                )}
                {hasSessions && (
                  <td className="num">
                    {row.attended ? formatHours(row.total_hours) : "—"}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AppLayout>
  );
}
