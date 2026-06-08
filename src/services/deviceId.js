const DEVICE_ID_KEY = "tux_cashier_device_id_v1";

function createDeviceId() {
  const cryptoObj =
    typeof window !== "undefined" && window.crypto
      ? window.crypto
      : typeof crypto !== "undefined"
      ? crypto
      : null;

  if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
    return `device_${cryptoObj.randomUUID()}`;
  }

  return `device_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

export function getDeviceId() {
  if (typeof localStorage === "undefined") return createDeviceId();

  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;

    const next = createDeviceId();
    localStorage.setItem(DEVICE_ID_KEY, next);
    return next;
  } catch (err) {
    console.warn("Unable to read device id:", err);
    return createDeviceId();
  }
}

export { DEVICE_ID_KEY };
