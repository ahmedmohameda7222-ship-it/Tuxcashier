const DB_NAME = "tux_cashier_local_db_v1";
const DB_VERSION = 1;
const ORDER_STORE = "orders";
const OUTBOX_STORE = "sync_outbox";
const META_STORE = "meta";

function hasIndexedDb() {
  return typeof indexedDB !== "undefined";
}

function openLocalDb() {
  if (!hasIndexedDb()) return Promise.resolve(null);

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(ORDER_STORE)) {
        const store = db.createObjectStore(ORDER_STORE, { keyPath: "orderKey" });
        store.createIndex("syncStatus", "syncStatus", { unique: false });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        const store = db.createObjectStore(OUTBOX_STORE, { keyPath: "eventId" });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function requestToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function toIso(value) {
  if (!value) return value;
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value);
  return Number.isNaN(+d) ? value : d.toISOString();
}

function toDate(value) {
  if (!value) return value;
  const d = new Date(value);
  return Number.isNaN(+d) ? value : d;
}

function orderDayBucket(order = {}) {
  const d = order.date ? new Date(order.date) : null;
  if (!d || Number.isNaN(+d)) return "unknown_day";
  return d.toISOString().slice(0, 10);
}

export function getOrderLocalKey(order = {}) {
  const dayKey = order.dayId || orderDayBucket(order);
  return String(
    order.idemKey ||
      order.cloudId ||
      order.id ||
      (order.orderNo != null ? `order_${dayKey}_${order.orderNo}` : "") ||
      `order_${Date.now()}_${Math.random().toString(36).slice(2)}`
  );
}

function serializeOrder(order = {}) {
  const orderKey = getOrderLocalKey(order);
  return {
    ...order,
    orderKey,
    date: toIso(order.date),
    createdAt: toIso(order.createdAt),
    updatedAt: toIso(order.updatedAt) || new Date().toISOString(),
    restockedAt: toIso(order.restockedAt),
    whatsappSentAt: toIso(order.whatsappSentAt),
  };
}

function deserializeOrder(order = {}) {
  return {
    ...order,
    date: toDate(order.date) || new Date(),
    createdAt: toDate(order.createdAt),
    updatedAt: toDate(order.updatedAt),
    restockedAt: toDate(order.restockedAt),
    whatsappSentAt: toDate(order.whatsappSentAt),
  };
}

export async function loadLocalOrdersFromDb() {
  const db = await openLocalDb();
  if (!db) return [];
  const tx = db.transaction(ORDER_STORE, "readonly");
  const rows = await requestToPromise(tx.objectStore(ORDER_STORE).getAll());
  return (rows || [])
    .map(deserializeOrder)
    .sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0));
}

export async function saveLocalOrdersToDb(orders = []) {
  const db = await openLocalDb();
  if (!db) return false;
  const tx = db.transaction([ORDER_STORE, OUTBOX_STORE, META_STORE], "readwrite");
  const orderStore = tx.objectStore(ORDER_STORE);
  const outboxStore = tx.objectStore(OUTBOX_STORE);
  const now = new Date().toISOString();

  for (const order of Array.isArray(orders) ? orders : []) {
    if (!order) continue;
    const row = serializeOrder(order);
    orderStore.put(row);
    if (row.syncStatus === "pending") {
      outboxStore.put({
        eventId: `order.upsert:${row.orderKey}`,
        type: "order.upsert",
        orderKey: row.orderKey,
        status: "pending",
        payload: row,
        createdAt: row.createdAt || now,
        updatedAt: now,
        attempts: 0,
      });
    }
  }

  tx.objectStore(META_STORE).put({ key: "lastLocalWriteAt", value: now });
  await txDone(tx);
  return true;
}

export async function markLocalOrderSynced(order, cloudId) {
  const db = await openLocalDb();
  if (!db) return false;
  const orderKey = getOrderLocalKey(order);
  const tx = db.transaction([ORDER_STORE, OUTBOX_STORE, META_STORE], "readwrite");
  const orderStore = tx.objectStore(ORDER_STORE);
  const outboxStore = tx.objectStore(OUTBOX_STORE);
  const existing = await requestToPromise(orderStore.get(orderKey));
  const next = serializeOrder({
    ...(existing || order || {}),
    cloudId: cloudId || existing?.cloudId || order?.cloudId,
    syncStatus: "synced",
    updatedAt: new Date().toISOString(),
  });
  orderStore.put(next);
  outboxStore.put({
    eventId: `order.upsert:${orderKey}`,
    type: "order.upsert",
    orderKey,
    status: "synced",
    payload: next,
    createdAt: existing?.createdAt || next.createdAt,
    updatedAt: next.updatedAt,
    attempts: existing?.attempts || 0,
  });
  tx.objectStore(META_STORE).put({ key: "lastSyncAt", value: next.updatedAt });
  await txDone(tx);
  return true;
}

export async function getLocalDbStatus() {
  const db = await openLocalDb();
  if (!db) return { available: false, orderCount: 0, pendingCount: 0 };
  const tx = db.transaction([ORDER_STORE, OUTBOX_STORE, META_STORE], "readonly");
  const orders = await requestToPromise(tx.objectStore(ORDER_STORE).getAll());
  const events = await requestToPromise(tx.objectStore(OUTBOX_STORE).getAll());
  return {
    available: true,
    orderCount: (orders || []).length,
    pendingCount: (events || []).filter((event) => event.status === "pending").length,
  };
}

export async function deleteLocalDatabase() {
  const db = await openLocalDb();
  if (!db) return false;
  const storeNames = [ORDER_STORE, OUTBOX_STORE, META_STORE].filter((store) =>
    db.objectStoreNames.contains(store)
  );
  if (!storeNames.length) {
    db.close();
    return true;
  }
  const tx = db.transaction(storeNames, "readwrite");
  for (const storeName of storeNames) {
    tx.objectStore(storeName).clear();
  }
  await txDone(tx);
  db.close();
  return true;
}
