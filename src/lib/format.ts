const DATE = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const DATE_TIME = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(value: Date | string): string {
  return DATE.format(typeof value === "string" ? new Date(value) : value);
}

export function formatDateTime(value: Date | string): string {
  return DATE_TIME.format(typeof value === "string" ? new Date(value) : value);
}

/** Value for an <input type="date">. */
export function toDateInput(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toISOString().slice(0, 10);
}

/** Value for an <input type="datetime-local">, in the viewer's local time. */
export function toDateTimeInput(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  const offset = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
