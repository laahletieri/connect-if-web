function pad(n) {
  return String(n).padStart(2, "0");
}

// ISO (banco) -> valor do input datetime-local, no fuso do navegador.
export function toInputValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

// Valor do input datetime-local (fuso do navegador) -> ISO para o banco.
export function toIso(value) {
  return new Date(value).toISOString();
}

// Ex.: "10/11/2026, 14:00 às 16:00" ou "10/11/2026 08:00 até 12/11/2026 18:00".
export function formatRange(startIso, endIso) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const day = (d) => d.toLocaleDateString("pt-BR");
  const time = (d) =>
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  if (day(start) === day(end)) {
    return `${day(start)}, ${time(start)} às ${time(end)}`;
  }

  return `${day(start)} ${time(start)} até ${day(end)} ${time(end)}`;
}
