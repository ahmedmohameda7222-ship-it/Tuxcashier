import { parseDateMaybe } from "./dateUtils";

export const normalizePhone = (s) => {
  let digits = String(s || "").replace(/\D/g, "");
  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }
  if (digits.startsWith("20")) {
    return digits.slice(0, 12);
  }
  if (digits.startsWith("2") && digits.length > 11) {
    return digits.slice(0, 12);
  }
  return digits.slice(0, 11);
};

export const extractLocalPhoneDigits = (raw) => {
  const digits = normalizePhone(raw);
  if (!digits) return "";
  if (digits.startsWith("20")) return digits.slice(2, 12);
  if (digits.startsWith("0")) return digits.slice(1, 11);
  return digits.slice(0, 10);
};

export const toCanonicalLocalPhone = (raw) => {
  const local = extractLocalPhoneDigits(raw);
  if (!local) return "";
  return `0${local}`.slice(0, 11);
};

export const formatPhoneForDisplay = (raw) => {
  const digits = normalizePhone(raw);
  if (!digits) return "";
  if (digits.startsWith("0") && digits.length >= 2) {
    return `+20${digits.slice(1)}`;
  }
  if (digits.startsWith("20")) return `+${digits}`;
  if (digits.startsWith("2")) return `+${digits}`;
  return `+20${digits}`;
};

export const upsertCustomer = (list, rec) => {
  const phone = normalizePhone(rec.phone);
  const existing = (list || []).find((c) => normalizePhone(c.phone) === phone) || {};
  const without = (list || []).filter((c) => normalizePhone(c.phone) !== phone);
  return [{ ...existing, ...rec, phone }, ...without];
};

export function dedupeCustomers(list = []) {
  const seen = new Set();
  const out = [];
  for (const c of list || []) {
    const p = normalizePhone(c.phone);
    if (seen.has(p)) continue;
    seen.add(p);
    out.push({
      ...c,
      phone: p,
      lastOrderAt: parseDateMaybe(c.lastOrderAt),
      firstOrderAt: parseDateMaybe(c.firstOrderAt),
      updatedAt: parseDateMaybe(c.updatedAt),
    });
  }
  return out;
}

export const calculateCustomerLifetimeSpend = (phone, orders = []) => {
  const target = normalizePhone(phone);
  if (!target) return 0;
  const total = (orders || []).reduce((sum, order) => {
    if (!order || order.voided) return sum;
    const orderPhone = normalizePhone(order.deliveryPhone);
    if (!orderPhone || orderPhone !== target) return sum;
    const amount = Number(order.total || 0);
    return Number.isFinite(amount) ? sum + amount : sum;
  }, 0);
  return Number(total.toFixed(2));
};

export const categorizeCustomerActivity = (contact = {}, now = new Date()) => {
  const last = parseDateMaybe(contact.lastOrderAt || contact.lastOrderDate);
  const count = Number(contact.orderCount || contact.ordersCount || 0);
  if (!count) {
    return last ? "dormant" : "new";
  }
  if (!last) return "dormant";
  const diffDays = Math.floor((now - last) / (1000 * 60 * 60 * 24));
  if (count <= 1) {
    return diffDays <= 30 ? "new" : "dormant";
  }
  if (diffDays <= 45) return "regular";
  if (count >= 4 && diffDays <= 90) return "regular";
  return "dormant";
};

export const buildCustomerContactRows = (
  contacts = [],
  liveOrders = [],
  historicalOrders = [],
  deliveryZones = []
) => {
  const zoneMap = new Map((deliveryZones || []).map((z) => [z.id, z]));
  const allOrders = [...(historicalOrders || []), ...(liveOrders || [])];
  return (contacts || [])
    .map((contact, idx) => {
      const phone = normalizePhone(contact.phone);
      const ordersForContact = allOrders.filter(
        (order) => normalizePhone(order?.deliveryPhone) === phone && !order?.voided
      );
      const latestOrder = ordersForContact.reduce(
        (acc, order) => {
          const when = parseDateMaybe(order?.date);
          if (!when) return acc;
          if (!acc || when > acc.when) return { when, order };
          return acc;
        },
        null
      );
      const firstOrder = ordersForContact.reduce(
        (acc, order) => {
          const when = parseDateMaybe(order?.date);
          if (!when) return acc;
          if (!acc || when < acc) return when;
          return acc;
        },
        parseDateMaybe(contact.firstOrderAt)
      );
      const totalSpend =
        contact.totalSpend != null
          ? Number(contact.totalSpend || 0)
          : calculateCustomerLifetimeSpend(phone, allOrders);
      const orderCount =
        contact.orderCount != null
          ? Number(contact.orderCount || 0)
          : ordersForContact.length;
      const lastOrderAt =
        parseDateMaybe(contact.lastOrderAt) || latestOrder?.when || null;
      const zoneId = contact.zoneId || latestOrder?.order?.deliveryZoneId || "";
      const zoneName = zoneId ? zoneMap.get(zoneId)?.name || zoneId : "";
      const tags = Array.isArray(contact.tags) ? contact.tags.map(String) : [];
      const activity = categorizeCustomerActivity(
        { ...contact, orderCount, lastOrderAt },
        new Date()
      );
      if (activity) {
        const label = activity.charAt(0).toUpperCase() + activity.slice(1);
        if (!tags.includes(label)) tags.push(label);
      }
      return {
        id: phone || contact.id || `contact_${idx}`,
        displayName:
          contact.name || latestOrder?.order?.deliveryName || "Unknown customer",
        phone,
        address: contact.address || latestOrder?.order?.deliveryAddress || "",
        zoneId,
        zoneName,
        tags,
        lastOrderAt,
        lastOrderTotal:
          latestOrder?.order?.total != null
            ? Number(latestOrder.order.total || 0)
            : contact.lastOrderTotal != null
            ? Number(contact.lastOrderTotal || 0)
            : 0,
        lastOrderNo:
          latestOrder?.order?.orderNo ?? contact.lastOrderNo ?? null,
        totalSpend: Number(totalSpend.toFixed(2)),
        orderCount,
        firstOrderAt: firstOrder,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.totalSpend - a.totalSpend || (b.lastOrderAt || 0) - (a.lastOrderAt || 0));
};
