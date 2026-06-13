export const toIso = (v) => {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  if (v && typeof v.toDate === "function") return v.toDate().toISOString();
  const d = new Date(v);
  return isNaN(d) ? null : d.toISOString();
};

export function toMillis(value) {
  if (!value) return undefined;
  if (value instanceof Date) return value.getTime();
  if (value && typeof value.toMillis === "function") return value.toMillis();
  const parsed = new Date(value);
  return Number.isNaN(+parsed) ? undefined : parsed.getTime();
}

export function toValidDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(+value) ? null : value;
  if (value && typeof value.toDate === "function") {
    const d = value.toDate();
    return d instanceof Date && !Number.isNaN(+d) ? d : null;
  }
  if (typeof value === "string") {
    const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnly) {
      const [, y, m, d] = dateOnly;
      const localDate = new Date(Number(y), Number(m) - 1, Number(d), 0, 0, 0, 0);
      return Number.isNaN(+localDate) ? null : localDate;
    }
  }
  const d = new Date(value);
  return Number.isNaN(+d) ? null : d;
}

export function toMs(value) {
  if (!value) return 0;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

export const parseDateMaybe = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  const d = new Date(value);
  return Number.isNaN(+d) ? null : d;
};
