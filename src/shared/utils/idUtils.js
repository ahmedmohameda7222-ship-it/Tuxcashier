import { toMillis, toMs } from "./dateUtils";

export function orderDayBucket(order = {}) {
  const dt = order.date ? new Date(order.date) : null;
  if (!dt || Number.isNaN(+dt)) return "unknown_day";
  return dt.toISOString().slice(0, 10);
}

export function getStableRecordKey(record, fallbackPrefix = "row", index = 0) {
  if (!record || typeof record !== "object") return `${fallbackPrefix}_${index}`;

  const isOrderLike =
    fallbackPrefix === "order" ||
    record.orderNo != null ||
    record.cloudId ||
    record.idemKey ||
    record.onlineOrderId ||
    record.onlineOrderKey;

  const candidates = isOrderLike
    ? [
        record.cloudId ? `cloud_${record.cloudId}` : "",
        record.idemKey ? `idem_${record.idemKey}` : "",
        record.onlineOrderKey ? `online_key_${record.onlineOrderKey}` : "",
        record.onlineOrderId ? `online_id_${record.onlineOrderId}` : "",
        record.id,
        record.orderNo != null
          ? `order_${record.dayId || orderDayBucket(record)}_${record.orderNo}`
          : "",
        record.channelOrderNo
          ? `channel_${record.dayId || orderDayBucket(record)}_${record.channelOrderNo}`
          : "",
      ]
    : [
        record.id,
        record.sessionId,
        record.dayId,
        record.name && (record.signInAt || record.date || record.at)
          ? `${record.name}_${record.signInAt || record.date || record.at}`
          : "",
      ];

  return String(
    candidates.find((v) => v !== undefined && v !== null && String(v) !== "") ||
      `${fallbackPrefix}_${index}`
  );
}

export function recordUpdatedMs(record) {
  if (!record || typeof record !== "object") return 0;
  const candidates = [
    record.updatedAt,
    record.savedAt,
    record.reconciledAt,
    record.endedAt,
    record.endAt,
    record.signOutAt,
    record.createdAt,
    record.date,
    record.at,
    record.signInAt,
  ];
  return candidates.reduce((max, value) => Math.max(max, toMs(value)), 0);
}

export function getOrderIdentity(order = {}) {
  if (!order || typeof order !== "object") return "";

  const strong =
    order.orderKey ||
    order.idemKey ||
    order.cloudId ||
    order.id;
  if (strong) return String(strong);

  const dayKey = order.dayId || orderDayBucket(order);
  const ts = toMillis(order.date) || toMillis(order.createdAt) || 0;
  return [
    "fallback",
    dayKey,
    order.orderNo != null ? String(order.orderNo) : "",
    order.worker || "",
    order.payment || "",
    order.orderType || "",
    order.total != null ? String(order.total) : "",
    String(ts || ""),
  ]
    .filter(Boolean)
    .join("_");
}

export function orderDedupeKey(order = {}) {
  return getOrderIdentity(order);
}

export function dedupeOrders(list) {
  const byKey = new Map();
  for (const o of list || []) {
    if (!o || typeof o !== "object") continue;
    const key = getOrderIdentity(o);
    const prev = byKey.get(key);
    const currentUpdated = recordUpdatedMs(o) || toMillis(o.date) || 0;
    const previousUpdated = recordUpdatedMs(prev) || toMillis(prev?.date) || 0;
    if (!prev || currentUpdated >= previousUpdated) byKey.set(key, o);
  }
  return Array.from(byKey.values()).sort(
    (a, b) => +(new Date(b.date || b.createdAt || 0)) - +(new Date(a.date || a.createdAt || 0))
  );
}
