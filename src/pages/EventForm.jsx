import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import EventSessions from "../components/EventSessions";
import EventTeam from "../components/EventTeam";
import { useAuth } from "../contexts/AuthContext";
import { CAMPUSES } from "../lib/constants";
import { toInputValue, toIso } from "../lib/dates";
import { supabase } from "../lib/supabaseClient";

const BUCKET = "event-images";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const EMPTY_FORM = {
  title: "",
  description: "",
  campus: "",
  location: "",
  start_date: "",
  end_date: "",
  registration_start: "",
  registration_end: "",
  capacity: "",
  status: "draft",
};

function validate(form) {
  if (form.title.trim().length < 3) {
    return "Informe o título do evento (mínimo de 3 caracteres).";
  }
  if (!form.campus) return "Selecione o campus.";
  if (!form.start_date || !form.end_date) {
    return "Informe a data de início e a de término do evento.";
  }
  if (!form.registration_start || !form.registration_end) {
    return "Informe o período de inscrições.";
  }

  const start = new Date(form.start_date);
  const end = new Date(form.end_date);
  const regStart = new Date(form.registration_start);
  const regEnd = new Date(form.registration_end);

  if (end < start) {
    return "O término do evento não pode ser antes do início.";
  }
  if (regEnd <= regStart) {
    return "O fim das inscrições deve ser depois do início das inscrições.";
  }
  if (regEnd > end) {
    return "O fim das inscrições não pode ser depois do término do evento.";
  }

  if (form.capacity !== "") {
    const capacity = Number(form.capacity);
    if (!Number.isInteger(capacity) || capacity <= 0) {
      return "As vagas devem ser um número inteiro maior que zero.";
    }
  }

  return "";
}

// Apaga do Storage o arquivo apontado por uma URL pública (se for do nosso bucket).
async function removeStoredImage(url) {
  const marker = `/${BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return;

  const path = decodeURIComponent(
    url.slice(index + marker.length).split("?")[0],
  );
  const { error } = await supabase.storage.from(BUCKET).remove([path]);

  if (error) console.error("Erro ao remover a imagem antiga:", error.message);
}

export default function EventForm() {
  const { id } = useParams();

  // A chave recria o formulário ao passar de "novo" para "editar".
  return <EventFormContent key={id ?? "novo"} id={id} />;
}

function EventFormContent({ id }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isEdit = Boolean(id);
  const notice = location.state?.notice;
  const warning = location.state?.warning;

  const [form, setForm] = useState(EMPTY_FORM);
  const [savedDates, setSavedDates] = useState({ start: "", end: "" });
  const [originalStatus, setOriginalStatus] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [removeImage, setRemoveImage] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEdit) return undefined;

    let active = true;

    async function load() {
      const [eventRes, memberRes] = await Promise.all([
        supabase.from("events").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("event_members")
          .select("id")
          .eq("event_id", id)
          .eq("user_id", user.id)
          .eq("role", "administrator")
          .maybeSingle(),
      ]);

      if (!active) return;

      if (eventRes.error || memberRes.error) {
        setLoadError("Não foi possível carregar o evento.");
      } else if (!eventRes.data || !memberRes.data) {
        setLoadError(
          "Evento não encontrado ou você não tem permissão para editá-lo.",
        );
      } else {
        const ev = eventRes.data;
        setForm({
          title: ev.title ?? "",
          description: ev.description ?? "",
          campus: ev.campus ?? "",
          location: ev.location ?? "",
          start_date: toInputValue(ev.start_date),
          end_date: toInputValue(ev.end_date),
          registration_start: toInputValue(ev.registration_start),
          registration_end: toInputValue(ev.registration_end),
          capacity: ev.capacity ?? "",
          status: ev.status ?? "draft",
        });
        setSavedDates({ start: ev.start_date, end: ev.end_date });
        setOriginalStatus(ev.status ?? "");
        setImageUrl(ev.image_url ?? "");
      }

      setLoading(false);
    }

    load();

    return () => {
      active = false;
    };
  }, [id, isEdit, user.id]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((old) => ({ ...old, [name]: value }));
  }

  function chooseImage(file) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(file ? URL.createObjectURL(file) : "");
    setImageFile(file);
  }

  function handleImageChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";

    if (!file) return;

    if (!IMAGE_TYPES[file.type]) {
      setError("Use uma imagem JPG, PNG ou WebP.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("A imagem deve ter no máximo 5 MB.");
      return;
    }

    setError("");
    setRemoveImage(false);
    chooseImage(file);
  }

  function handleRemoveImage() {
    if (imageFile) {
      // Descarta a imagem recém-escolhida e volta para a atual (se houver).
      chooseImage(null);
      return;
    }
    setRemoveImage(true);
  }

  // Envia/remove a imagem depois que o evento já foi salvo. Devolve uma mensagem em caso de erro.
  async function syncImage(eventId) {
    try {
      if (imageFile) {
        const path = `${eventId}/${Date.now()}.${IMAGE_TYPES[imageFile.type]}`;

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, imageFile, { contentType: imageFile.type });
        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);

        const { error: updateError } = await supabase
          .from("events")
          .update({ image_url: data.publicUrl })
          .eq("id", eventId);
        if (updateError) throw updateError;

        if (imageUrl) await removeStoredImage(imageUrl);
      } else if (removeImage && imageUrl) {
        const { error: clearError } = await supabase
          .from("events")
          .update({ image_url: null })
          .eq("id", eventId);
        if (clearError) throw clearError;

        await removeStoredImage(imageUrl);
      }

      return "";
    } catch (err) {
      console.error("Erro ao salvar a imagem:", err);
      return "O evento foi salvo, mas houve um problema com a imagem. Selecione a imagem novamente e salve de novo.";
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const problem = validate(form);
    if (problem) {
      setError(problem);
      return;
    }

    if (form.status === "cancelled" && originalStatus !== "cancelled") {
      const confirmed = window.confirm(
        "Eventos cancelados deixam de aparecer no aplicativo e não aceitam inscrições. Deseja continuar?",
      );
      if (!confirmed) return;
    }

    setSaving(true);

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      campus: form.campus,
      // Vazio é salvo como texto vazio; o aplicativo mostra "Local a definir".
      location: form.location.trim(),
      start_date: toIso(form.start_date),
      end_date: toIso(form.end_date),
      registration_start: toIso(form.registration_start),
      registration_end: toIso(form.registration_end),
      capacity: form.capacity === "" ? null : Number(form.capacity),
      status: form.status,
    };

    let eventId = id;

    if (isEdit) {
      const { data, error: updateError } = await supabase
        .from("events")
        .update(payload)
        .eq("id", id)
        .select("id");

      if (updateError || !data?.length) {
        setSaving(false);
        setError(
          updateError
            ? `Não foi possível salvar: ${updateError.message}`
            : "Não foi possível salvar. Você não tem permissão para editar este evento.",
        );
        return;
      }
    } else {
      const { data, error: insertError } = await supabase
        .from("events")
        .insert({ ...payload, created_by: user.id })
        .select("id")
        .single();

      if (insertError) {
        setSaving(false);
        setError(`Não foi possível criar o evento: ${insertError.message}`);
        return;
      }

      eventId = data.id;
    }

    const imageError = await syncImage(eventId);
    setSaving(false);

    if (!isEdit) {
      // Evento criado: abre a edição, onde já dá para cadastrar as sessões.
      navigate(`/eventos/${eventId}`, {
        replace: true,
        state: {
          notice:
            "Evento criado. Se ele tiver atividades (palestras, minicursos etc.), adicione as sessões abaixo.",
          warning: imageError,
        },
      });
      return;
    }

    if (imageError) {
      setError(imageError);
      return;
    }

    navigate("/", { state: { notice: "Evento atualizado." } });
  }

  if (loading) {
    return (
      <AppLayout>
        <p className="muted">Carregando...</p>
      </AppLayout>
    );
  }

  if (loadError) {
    return (
      <AppLayout>
        <p className="form-error">{loadError}</p>
        <p>
          <Link to="/" className="button-link button-secondary">
            Voltar para meus eventos
          </Link>
        </p>
      </AppLayout>
    );
  }

  const campusOptions =
    form.campus && !CAMPUSES.includes(form.campus)
      ? [form.campus, ...CAMPUSES]
      : CAMPUSES;

  const shownImage = previewUrl || (removeImage ? "" : imageUrl);

  return (
    <AppLayout>
      <div className="page-header">
        <h2>{isEdit ? "Editar evento" : "Novo evento"}</h2>
        {isEdit && (
          <Link to={`/eventos/${id}/presenca`} className="button-link">
            Lista de presença
          </Link>
        )}
      </div>

      {notice && <p className="notice">{notice}</p>}
      {warning && <p className="warning">{warning}</p>}

      <form className="event-form" onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="title">Título</label>
          <input
            id="title"
            name="title"
            value={form.title}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-field">
          <label htmlFor="description">Descrição</label>
          <textarea
            id="description"
            name="description"
            value={form.description}
            onChange={handleChange}
          />
        </div>

        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="campus">Campus</label>
            <select
              id="campus"
              name="campus"
              value={form.campus}
              onChange={handleChange}
              required
            >
              <option value="">Selecione...</option>
              {campusOptions.map((campus) => (
                <option key={campus} value={campus}>
                  {campus}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="location">Local (opcional)</label>
            <input
              id="location"
              name="location"
              value={form.location}
              onChange={handleChange}
              placeholder="Ex.: Auditório principal"
            />
          </div>

          <div className="form-field">
            <label htmlFor="start_date">Início do evento</label>
            <input
              id="start_date"
              name="start_date"
              type="datetime-local"
              value={form.start_date}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="end_date">Término do evento</label>
            <input
              id="end_date"
              name="end_date"
              type="datetime-local"
              value={form.end_date}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="registration_start">Inscrições a partir de</label>
            <input
              id="registration_start"
              name="registration_start"
              type="datetime-local"
              value={form.registration_start}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="registration_end">Inscrições até</label>
            <input
              id="registration_end"
              name="registration_end"
              type="datetime-local"
              value={form.registration_end}
              onChange={handleChange}
              required
            />
            <p className="form-hint">
              Não pode ser depois do término do evento.
            </p>
          </div>

          <div className="form-field">
            <label htmlFor="capacity">Vagas</label>
            <input
              id="capacity"
              name="capacity"
              type="number"
              min="1"
              step="1"
              value={form.capacity}
              onChange={handleChange}
            />
            <p className="form-hint">
              Deixe em branco para não limitar as vagas.
            </p>
          </div>

          <div className="form-field">
            <label htmlFor="status">Status</label>
            <select
              id="status"
              name="status"
              value={form.status}
              onChange={handleChange}
            >
              <option value="draft">Rascunho</option>
              <option value="published">Publicado</option>
              <option value="cancelled">Cancelado</option>
            </select>
            <p className="form-hint">
              Rascunho fica visível só para a organização. Publicado aparece no
              aplicativo.
            </p>
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="image">Imagem do evento</label>

          {shownImage && (
            <img
              src={shownImage}
              alt="Imagem do evento"
              className="image-preview"
            />
          )}

          <input
            id="image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleImageChange}
          />
          <p className="form-hint">JPG, PNG ou WebP, até 5 MB.</p>

          <div className="image-actions">
            {imageFile && (
              <span className="muted">Nova imagem: {imageFile.name}</span>
            )}

            {shownImage && (
              <button
                type="button"
                className="link-danger"
                onClick={handleRemoveImage}
              >
                {imageFile ? "Descartar nova imagem" : "Remover imagem"}
              </button>
            )}

            {removeImage && imageUrl && !imageFile && (
              <button
                type="button"
                className="link-danger"
                onClick={() => setRemoveImage(false)}
              >
                Desfazer remoção
              </button>
            )}
          </div>
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="form-actions">
          <button type="submit" disabled={saving}>
            {saving
              ? "Salvando..."
              : isEdit
                ? "Salvar alterações"
                : "Criar evento"}
          </button>
          <Link to="/" className="button-link button-secondary">
            {isEdit ? "Voltar" : "Cancelar"}
          </Link>
        </div>
      </form>

      {isEdit ? (
        <>
          <EventSessions
            eventId={id}
            eventStart={savedDates.start}
            eventEnd={savedDates.end}
          />
          <EventTeam eventId={id} />
        </>
      ) : (
        <p className="sessions-note">
          Depois de criar o evento, você poderá adicionar as sessões (palestras,
          minicursos etc.) e a equipe de presença na tela de edição.
        </p>
      )}
    </AppLayout>
  );
}
