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

export function orderDedupeKey(order = {}) {
  const firstStrongKey = [
    order.cloudId ? `cloud_${order.cloudId}` : "",
    order.id ? `id_${order.id}` : "",
    order.idemKey ? `idem_${order.idemKey}` : "",
    order.onlineOrderId ? `online_id_${order.onlineOrderId}` : "",
    order.onlineOrderKey ? `online_key_${order.onlineOrderKey}` : "",
  ].find(Boolean);
  if (firstStrongKey) return firstStrongKey;

  const dayKey = order.dayId || orderDayBucket(order);
  if (order.channelOrderNo) return `channel_${dayKey}_${order.channelOrderNo}`;
  if (order.orderNo != null) return `order_${dayKey}_${order.orderNo}`;
  return [
    "fallback",
    dayKey,
    toMillis(order.date) || toMillis(order.createdAt) || "",
    order.worker || "",
    order.total || "",
  ].join("_");
}

export function dedupeOrders(list) {
  const byKey = new Map();
  for (const o of list || []) {
    const key = orderDedupeKey(o);
    const prev = byKey.get(key);
    const currentUpdated = recordUpdatedMs(o) || toMillis(o.date) || 0;
    const previousUpdated = recordUpdatedMs(prev) || toMillis(prev?.date) || 0;
    if (!prev || currentUpdated >= previousUpdated) byKey.set(key, o);
  }
  return Array.from(byKey.values()).sort(
    (a, b) => +(new Date(b.date || b.createdAt || 0)) - +(new Date(a.date || a.createdAt || 0))
  );
}
