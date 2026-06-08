export function loadLocalState(key) {
  if (typeof localStorage === "undefined") return {};

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (err) {
    console.warn("Local data could not be parsed:", err);
    return {};
  }
}

export function saveLocalState(key, state) {
  if (typeof localStorage === "undefined") return false;

  try {
    localStorage.setItem(key, JSON.stringify(state || {}));
    return true;
  } catch (err) {
    console.warn("Local data could not be saved:", err);
    return false;
  }
}

export function readLocalTimestamp(value) {
  if (!value) return 0;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}
