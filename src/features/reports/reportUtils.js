import { toMillis, toValidDate } from "../../shared/utils/dateUtils";

export function isOrderInReportPeriod(order, start, end) {
  const when = toValidDate(order?.date);
  return Boolean(when && start && end && when >= start && when <= end);
}

export function isOrderInCurrentReportShift(order, dayMetaValue, activeDayId) {
  if (!order || order.voided) return false;
  const shiftDayIds = new Set(
    [activeDayId, dayMetaValue?.dayId].filter(Boolean).map((value) => String(value))
  );
  if (shiftDayIds.size && order.dayId) return shiftDayIds.has(String(order.dayId));

  const start = toValidDate(dayMetaValue?.startedAt);
  if (!start) return false;
  const end = toValidDate(dayMetaValue?.endedAt) || new Date();
  return isOrderInReportPeriod(order, start, end);
}

export function getReportOrderKey(order = {}, index = 0) {
  const when = toValidDate(order.date);
  const localDateKey = when
    ? [
        when.getFullYear(),
        String(when.getMonth() + 1).padStart(2, "0"),
        String(when.getDate()).padStart(2, "0"),
      ].join("-")
    : "";
  const candidates = [
    order.cloudId ? `cloud_${order.cloudId}` : "",
    order.idemKey ? `idem_${order.idemKey}` : "",
    order.onlineOrderKey ? `online_key_${order.onlineOrderKey}` : "",
    order.onlineOrderId ? `online_id_${order.onlineOrderId}` : "",
    order.dayId && order.orderNo != null ? `day_order_${order.dayId}_${order.orderNo}` : "",
    order.orderNo != null && localDateKey ? `date_order_${localDateKey}_${order.orderNo}` : "",
    order.id ? `id_${order.id}` : "",
  ];
  return String(candidates.find(Boolean) || `report_order_${index}`);
}

export function dedupeReportOrders(rows = []) {
  const byKey = new Map();
  for (const [index, order] of (rows || []).entries()) {
    if (!order) continue;
    const key = getReportOrderKey(order, index);
    const prev = byKey.get(key);
    const currentUpdated =
      toMillis(order.updatedAt) || toMillis(order.savedAt) || toMillis(order.date) || 0;
    const previousUpdated =
      toMillis(prev?.updatedAt) || toMillis(prev?.savedAt) || toMillis(prev?.date) || 0;
    if (!prev || currentUpdated >= previousUpdated) byKey.set(key, order);
  }
  return Array.from(byKey.values());
}
