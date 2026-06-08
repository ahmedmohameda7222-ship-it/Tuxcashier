const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const SHOP_ID = process.env.TUX_SHOP_ID || "tux";
const POS_STATE_ID = "pos";
const DEFAULT_APP_URL = "https://tuxcashier.vercel.app";
const TOKEN_PREFIX = "tux_mcp_live_";
const DEFAULT_ADMIN_PASSCODE_PEPPER = "tux_mcp_admin_passcode_v1";
const DEFAULT_ADMIN_SCOPES = [
  "read:orders",
  "read:inventory",
  "read:reports",
  "write:inventory",
  "write:orders",
  "write:expenses",
  "write:prices",
  "write:shift",
];
const ADMIN_DEFINITIONS = {
  admin_1: {
    id: "admin_1",
    name: "Admin 1",
    hashEnv: "TUX_ADMIN_1_PASSCODE_HASH",
    defaultPasscodeHash:
      "6e1411ae870ac31e280bce1db84b87e03c9c44a92d10c396c7b5ac8fd063a635",
    defaultScopes: DEFAULT_ADMIN_SCOPES,
  },
};

const READ_TOOL_NAMES = new Set([
  "get_connection_info",
  "get_today_sales_report",
  "get_inventory_status",
  "get_recent_orders",
  "get_order_by_number",
  "get_menu_items",
  "get_worker_sales_report",
  "get_expenses_report",
  "get_bank_summary",
  "get_current_shift",
]);

const WRITE_TOOL_NAMES = new Set([
  "add_inventory_restock",
  "adjust_inventory_quantity",
  "update_item_price",
  "update_extra_price",
  "mark_order_done",
  "void_order",
  "add_expense",
  "change_shift",
]);

const TOOL_SCOPES = {
  get_connection_info: "read:reports",
  get_today_sales_report: "read:reports",
  get_inventory_status: "read:inventory",
  get_recent_orders: "read:orders",
  get_order_by_number: "read:orders",
  get_menu_items: "read:inventory",
  get_worker_sales_report: "read:reports",
  get_expenses_report: "read:reports",
  get_bank_summary: "read:reports",
  get_current_shift: "read:reports",
  add_inventory_restock: "write:inventory",
  adjust_inventory_quantity: "write:inventory",
  update_item_price: "write:prices",
  update_extra_price: "write:prices",
  mark_order_done: "write:orders",
  void_order: "write:orders",
  add_expense: "write:expenses",
  change_shift: "write:shift",
};

function getEnv(...names) {
  for (const name of names) {
    if (process.env[name]) return process.env[name];
  }
  return "";
}

function publicAppUrl() {
  return (process.env.TUX_PUBLIC_APP_URL || DEFAULT_APP_URL).replace(/\/+$/, "");
}

function json(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function applyCors(req, res) {
  const allowed = process.env.TUX_MCP_ALLOWED_ORIGIN || "";
  const origin = req.headers.origin || "";
  if (allowed === "*" || (allowed && origin === allowed)) {
    res.setHeader("Access-Control-Allow-Origin", allowed === "*" ? "*" : origin);
  } else if (!allowed && origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Headers", "authorization, content-type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

function handleOptions(req, res) {
  applyCors(req, res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return true;
  }
  return false;
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({});
      }
    });
  });
}

function supabaseAdmin() {
  const url = getEnv("SUPABASE_URL", "VITE_SUPABASE_URL", "REACT_APP_SUPABASE_URL");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !serviceRoleKey) {
    throw new Error("Server Supabase credentials are not configured.");
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function requirePepper() {
  const pepper = process.env.TUX_MCP_TOKEN_PEPPER || "";
  if (!pepper || pepper.length < 16) {
    throw new Error("TUX_MCP_TOKEN_PEPPER must be configured server-side.");
  }
  return pepper;
}

function hashToken(token) {
  return crypto
    .createHash("sha256")
    .update(String(token || ""))
    .update(":")
    .update(requirePepper())
    .digest("hex");
}

function generateToken() {
  return `${TOKEN_PREFIX}${crypto.randomBytes(32).toString("base64url")}`;
}

function displayPrefix(token) {
  const raw = String(token || "");
  return `${raw.slice(0, TOKEN_PREFIX.length + 8)}...`;
}

function normalizeScopes(scopes) {
  const arr = Array.isArray(scopes) ? scopes : DEFAULT_ADMIN_SCOPES;
  const clean = arr
    .map((scope) => String(scope || "").trim().toLowerCase())
    .filter((scope) =>
      [
        "read",
        "write",
        "admin",
        "read:orders",
        "read:inventory",
        "read:reports",
        "write:inventory",
        "write:orders",
        "write:expenses",
        "write:prices",
        "write:shift",
      ].includes(scope)
    );
  return clean.length ? Array.from(new Set(clean)) : DEFAULT_ADMIN_SCOPES;
}

function hasScope(scopes, required) {
  const set = new Set(normalizeScopes(scopes));
  if (!required) return true;
  if (set.has("admin")) return true;
  if (required.startsWith("read:")) return set.has(required) || set.has("read") || set.has("write");
  if (required.startsWith("write:")) return set.has(required) || set.has("write");
  if (required === "read") return set.has("read") || set.has("write") || hasAnyScope(set, "read:");
  if (required === "write") return set.has("write") || hasAnyScope(set, "write:");
  return set.has(required);
}

function hasAnyScope(scopeSet, prefix) {
  for (const scope of scopeSet) {
    if (scope.startsWith(prefix)) return true;
  }
  return false;
}

function adminPasscodePepper() {
  return process.env.TUX_ADMIN_PASSCODE_PEPPER || DEFAULT_ADMIN_PASSCODE_PEPPER;
}

function hashAdminPasscode(adminId, passcode, pepper = adminPasscodePepper()) {
  return crypto
    .createHash("sha256")
    .update(String(adminId || ""))
    .update(":")
    .update(String(passcode || ""))
    .update(":")
    .update(String(pepper || ""))
    .digest("hex");
}

function safeAdminDefinition(adminId) {
  const normalized = String(adminId || "").trim().toLowerCase().replace(/^admin(\d+)$/, "admin_$1");
  return ADMIN_DEFINITIONS[normalized] || null;
}

function verifyAdminPasscode(adminId, passcode) {
  const admin = safeAdminDefinition(adminId);
  if (!admin) {
    const err = new Error("Unknown admin.");
    err.statusCode = 400;
    throw err;
  }
  const expectedHash = process.env[admin.hashEnv] || admin.defaultPasscodeHash;
  const actualHash = hashAdminPasscode(admin.id, passcode);
  const expected = Buffer.from(String(expectedHash || ""), "hex");
  const actual = Buffer.from(String(actualHash || ""), "hex");
  if (!expected.length || expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    const err = new Error("Invalid admin passcode.");
    err.statusCode = 401;
    throw err;
  }
  return admin;
}

function adminFromBody(body = {}) {
  const adminId = body.admin_id || body.adminId || body.admin || "admin_1";
  const passcode = body.admin_passcode || body.adminPasscode || body.passcode;
  if (!passcode) {
    const err = new Error("admin_passcode is required.");
    err.statusCode = 401;
    throw err;
  }
  return verifyAdminPasscode(adminId, passcode);
}

function tokenFromReq(req) {
  const auth = req.headers.authorization || req.headers.Authorization || "";
  const bearer = String(auth).match(/^Bearer\s+(.+)$/i);
  if (bearer) return bearer[1].trim();

  if (req.query && req.query.token) {
    return Array.isArray(req.query.token) ? req.query.token[0] : req.query.token;
  }

  try {
    const parsed = new URL(req.url, publicAppUrl());
    return parsed.searchParams.get("token") || "";
  } catch {
    return "";
  }
}

async function requireMcpAuth(req, options = {}) {
  const token = tokenFromReq(req);
  if (!token) {
    const err = new Error("Missing MCP connection token.");
    err.statusCode = 401;
    throw err;
  }

  const supabase = supabaseAdmin();
  const tokenHash = hashToken(token);
  const { data, error } = await supabase
    .from("mcp_connection_tokens")
    .select("id, shop_id, admin_id, admin_name, scopes, active, revoked_at, expires_at")
    .eq("token_hash", tokenHash)
    .eq("shop_id", SHOP_ID)
    .maybeSingle();

  if (error) throw error;
  if (!data || data.active === false || data.revoked_at) {
    const err = new Error("Invalid or revoked MCP connection token.");
    err.statusCode = 401;
    throw err;
  }
  if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) {
    const err = new Error("Expired MCP connection token.");
    err.statusCode = 401;
    throw err;
  }

  const requiredScope = options.requiredScope || "read";
  if (!hasScope(data.scopes, requiredScope)) {
    const err = new Error(`MCP token is missing required ${requiredScope} scope.`);
    err.statusCode = 403;
    throw err;
  }

  await supabase
    .from("mcp_connection_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);

  const context = {
    adminId: data.admin_id || "unknown_admin",
    adminName: data.admin_name || "Unknown Admin",
    scopes: normalizeScopes(data.scopes),
  };
  req.mcpContext = context;

  return {
    supabase,
    tokenRecord: data,
    shopId: data.shop_id || SHOP_ID,
    mcpContext: context,
  };
}

async function loadShopState(supabase) {
  const { data, error } = await supabase
    .from("pos_state")
    .select("state, write_seq")
    .eq("id", POS_STATE_ID)
    .eq("shop_id", SHOP_ID)
    .maybeSingle();
  if (error) throw error;
  return {
    state: data && data.state && typeof data.state === "object" ? data.state : {},
    writeSeq: Number(data?.write_seq || 0),
  };
}

async function saveShopState(supabase, state, writeSeq = 0) {
  const nextSeq = Number(writeSeq || 0) + 1;
  const payload = {
    id: POS_STATE_ID,
    shop_id: SHOP_ID,
    state: {
      ...(state || {}),
      updatedAt: new Date().toISOString(),
    },
    writer_id: "mcp",
    last_modified_device_id: "mcp",
    write_seq: nextSeq,
    client_time: Date.now(),
  };

  const { error } = await supabase.from("pos_state").upsert(payload, { onConflict: "id" });
  if (error) throw error;
  return payload.state;
}

async function fetchOrders(supabase, options = {}) {
  const limit = Math.max(1, Math.min(Number(options.limit || 200), 500));
  let query = supabase
    .from("orders")
    .select("*")
    .eq("shop_id", SHOP_ID)
    .order("date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (options.orderNo != null) {
    query = query.eq("order_no", Number(options.orderNo)).limit(1);
  }
  if (options.fromIso) query = query.gte("date", options.fromIso);
  if (options.toIso) query = query.lte("date", options.toIso);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((row) => {
    try {
      return normalizeOrderRow(row);
    } catch (err) {
      return {
        id: row?.id || null,
        orderNo: row?.order_no ?? row?.orderNo ?? null,
        order_no: row?.order_no ?? row?.orderNo ?? null,
        time: row?.date || row?.created_at || null,
        worker: row?.worker || "",
        payment: row?.payment || "",
        orderType: row?.order_type || row?.orderType || "",
        items: [],
        cart: [],
        extras: [],
        done: Boolean(row?.done),
        voided: Boolean(row?.voided),
        malformed: true,
        error: err.message || "Order row could not be normalized.",
      };
    }
  });
}

function normalizeOrderRow(row = {}) {
  const cart = safeArray(row.cart);
  const paymentParts = safeArray(row.payment_parts ?? row.paymentParts);
  return {
    id: row.id,
    orderNo: row.order_no ?? row.orderNo,
    order_no: row.order_no ?? row.orderNo,
    dayId: row.day_id || row.dayId || "",
    time: row.date || row.created_at || row.createdAt || null,
    date: row.date || row.created_at || row.createdAt || null,
    createdAt: row.created_at || row.createdAt || null,
    worker: row.worker || "",
    payment: row.payment || "",
    paymentMethod: row.payment || "",
    paymentParts,
    orderType: row.order_type || row.orderType || "",
    deliveryFee: safeNumber(row.delivery_fee ?? row.deliveryFee),
    deliveryName: row.delivery_name || row.deliveryName || "",
    deliveryPhone: row.delivery_phone || row.deliveryPhone || "",
    deliveryAddress: row.delivery_address || row.deliveryAddress || "",
    itemsTotal: safeNumber(row.items_total ?? row.itemsTotal),
    finalTotal: safeNumber(row.total ?? row.finalTotal),
    total: safeNumber(row.total ?? row.finalTotal),
    discountPercentage: safeNumber(row.discount_percentage ?? row.discountPercentage),
    discountAmount: safeNumber(row.discount_amount ?? row.discountAmount),
    done: Boolean(row.done),
    voided: Boolean(row.voided),
    voidReason: row.void_reason || row.voidReason || "",
    note: row.note || "",
    items: cart,
    cart,
    extras: collectExtras(cart),
  };
}

function normalizeStateOrder(order = {}) {
  return normalizeOrderRow({
    ...order,
    order_no: order.orderNo ?? order.order_no,
    payment_parts: order.paymentParts || order.payment_parts,
    order_type: order.orderType || order.order_type,
    delivery_fee: order.deliveryFee || order.delivery_fee,
    delivery_name: order.deliveryName || order.delivery_name,
    delivery_phone: order.deliveryPhone || order.delivery_phone,
    delivery_address: order.deliveryAddress || order.delivery_address,
    items_total: order.itemsTotal || order.items_total,
    discount_percentage: order.discountPercentage || order.discount_percentage,
    discount_amount: order.discountAmount || order.discount_amount,
    void_reason: order.voidReason || order.void_reason,
    total: order.total || order.finalTotal,
    date: order.date,
    cart: order.cart,
  });
}

function safeArray(value) {
  if (Array.isArray(value)) return value.filter((item) => item && typeof item === "object");
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === "object") : [];
    } catch {
      return [];
    }
  }
  return [];
}

function safeNumber(value) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function collectExtras(cart = []) {
  const extras = [];
  for (const line of cart || []) {
    if (!line || typeof line !== "object") continue;
    if (line?.itemType === "extra" || line?.extraId || line?.extra_id) {
      extras.push(line);
    }
    if (Array.isArray(line?.extras)) {
      extras.push(...line.extras.filter((extra) => extra && typeof extra === "object"));
    }
  }
  return extras;
}

function dateWindowFor(state = {}, date) {
  if (date) {
    const start = new Date(`${date}T00:00:00.000`);
    const end = new Date(`${date}T23:59:59.999`);
    if (Number.isNaN(+start)) throw new Error("Invalid date. Use YYYY-MM-DD.");
    return { fromIso: start.toISOString(), toIso: end.toISOString() };
  }

  const dayMeta = state.dayMeta || {};
  if (dayMeta.startedAt && !dayMeta.endedAt) {
    return {
      fromIso: new Date(dayMeta.startedAt).toISOString(),
      toIso: new Date().toISOString(),
    };
  }

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return dateWindowFor(state, `${yyyy}-${mm}-${dd}`);
}

function sameDate(value, date) {
  if (!date) return true;
  const d = new Date(value);
  if (Number.isNaN(+d)) return false;
  return d.toISOString().slice(0, 10) === date;
}

function money(value) {
  return Number((Number(value || 0) || 0).toFixed(2));
}

function paymentBreakdown(orders = []) {
  const out = {};
  for (const order of orders) {
    const total = money(order.total || order.finalTotal);
    const parts = Array.isArray(order.paymentParts) ? order.paymentParts : [];
    if (parts.length) {
      for (const part of parts) {
        const method = String(part.method || part.name || order.payment || "Unknown");
        out[method] = money((out[method] || 0) + Number(part.amount || 0));
      }
    } else {
      const method = order.payment || "Unknown";
      out[method] = money((out[method] || 0) + total);
    }
  }
  return out;
}

function workerBreakdown(orders = []) {
  const map = new Map();
  for (const order of orders) {
    const worker = order.worker || "Unknown";
    if (!map.has(worker)) {
      map.set(worker, {
        worker,
        order_count: 0,
        revenue_excluding_delivery: 0,
        revenue_including_delivery: 0,
        payment_breakdown: {},
      });
    }
    const row = map.get(worker);
    row.order_count += 1;
    row.revenue_excluding_delivery = money(row.revenue_excluding_delivery + Number(order.itemsTotal || 0));
    row.revenue_including_delivery = money(row.revenue_including_delivery + Number(order.total || order.finalTotal || 0));
    const pb = paymentBreakdown([order]);
    for (const [method, amount] of Object.entries(pb)) {
      row.payment_breakdown[method] = money((row.payment_breakdown[method] || 0) + amount);
    }
  }
  return Array.from(map.values());
}

function topItems(orders = []) {
  const map = new Map();
  for (const order of orders) {
    for (const line of order.cart || []) {
      if (!line || typeof line !== "object") continue;
      const name = line.name || line.title || line.id || "Unknown item";
      const qty = Number(line.qty || line.quantity || 1) || 1;
      const price = Number(line.price || 0) || 0;
      if (!map.has(name)) map.set(name, { name, qty: 0, total: 0 });
      const row = map.get(name);
      row.qty += qty;
      row.total = money(row.total + qty * price);
    }
  }
  return Array.from(map.values()).sort((a, b) => b.qty - a.qty).slice(0, 10);
}

function inventoryRows(state = {}) {
  const inventory = Array.isArray(state.inventory) ? state.inventory : [];
  const ledger = Array.isArray(state.inventoryLedger) ? state.inventoryLedger : [];
  if (!ledger.length) return inventory;
  const ledgerSums = {};
  for (const row of ledger) {
    const itemId = row.itemId || row.item_id;
    if (!itemId) continue;
    ledgerSums[itemId] = (ledgerSums[itemId] || 0) + (Number(row.qty) || 0);
  }
  return inventory.map((item) => ({
    ...item,
    qty: money(Number(item.qty || 0) + Number(ledgerSums[item.id] || 0)),
  }));
}

function safeInput(input = {}) {
  const copy = { ...(input || {}) };
  delete copy.admin_secret;
  delete copy.adminSecret;
  delete copy.admin_passcode;
  delete copy.adminPasscode;
  delete copy.passcode;
  delete copy.token;
  return copy;
}

async function audit(supabase, auth, toolName, actionType, input, success, errorMessage, beforeState, afterState) {
  try {
    await supabase.from("mcp_audit_logs").insert({
      shop_id: auth?.shopId || SHOP_ID,
      token_id: auth?.tokenRecord?.id || null,
      admin_id: auth?.mcpContext?.adminId || null,
      admin_name: auth?.mcpContext?.adminName || null,
      tool_name: toolName,
      action_type: actionType,
      input_summary: safeInput(input),
      payload: safeInput(input),
      before_state: sanitizeAuditState(beforeState),
      after_state: sanitizeAuditState(afterState),
      success: Boolean(success),
      error: errorMessage || null,
    });
  } catch (err) {
    console.warn("MCP audit log failed:", err.message || err);
  }
}

function sanitizeAuditState(value) {
  if (value === undefined) return null;
  return sanitizeForAudit(value);
}

function sanitizeForAudit(value) {
  if (value == null) return value;
  if (Array.isArray(value)) return value.slice(0, 25).map(sanitizeForAudit);
  if (typeof value === "object") {
    const out = {};
    for (const [key, inner] of Object.entries(value)) {
      if (/token|secret|passcode|password|pin/i.test(key)) continue;
      out[key] = sanitizeForAudit(inner);
    }
    return out;
  }
  return value;
}

function getToolDefinitions() {
  const readOnly = "Requires a valid MCP connection token with the matching read scope.";
  const write = "Requires a valid MCP connection token with the matching write scope. The admin identity is resolved from the token.";
  return [
    {
      name: "get_connection_info",
      description: "Returns the connected MCP admin identity and scopes for this token.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_today_sales_report",
      description: `${readOnly} Returns current business day or selected date sales totals.`,
      inputSchema: {
        type: "object",
        properties: { date: { type: "string", description: "Optional YYYY-MM-DD date." } },
      },
    },
    {
      name: "get_inventory_status",
      description: `${readOnly} Returns inventory quantities and low-stock warnings.`,
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_recent_orders",
      description: `${readOnly} Returns recent orders with cart, payment, worker, done, and voided status.`,
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "number", default: 20 },
          status: { type: "string", enum: ["active", "done", "voided", "all"], default: "all" },
        },
      },
    },
    {
      name: "get_order_by_number",
      description: `${readOnly} Returns full order details for one order number.`,
      inputSchema: {
        type: "object",
        required: ["order_no"],
        properties: { order_no: { type: "number" } },
      },
    },
    {
      name: "get_menu_items",
      description: `${readOnly} Returns menu items, extras, beverages, prices, and consumption mapping.`,
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_worker_sales_report",
      description: `${readOnly} Returns sales totals grouped by worker.`,
      inputSchema: {
        type: "object",
        properties: {
          worker_name: { type: "string" },
          date: { type: "string", description: "Optional YYYY-MM-DD date." },
        },
      },
    },
    {
      name: "get_expenses_report",
      description: `${readOnly} Returns expenses and totals for a date or current business day.`,
      inputSchema: {
        type: "object",
        properties: { date: { type: "string", description: "Optional YYYY-MM-DD date." } },
      },
    },
    {
      name: "get_bank_summary",
      description: `${readOnly} Returns current bank total and recent bank transactions.`,
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_current_shift",
      description: `${readOnly} Returns current worker, shift status, and shift changes.`,
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "add_inventory_restock",
      description: `${write} Adds a positive restock amount to an inventory item.`,
      inputSchema: {
        type: "object",
        required: ["item", "quantity", "unit"],
        properties: {
          item: { type: "string" },
          quantity: { type: "number" },
          unit: { type: "string" },
          worker_name: { type: "string" },
          note: { type: "string" },
        },
      },
    },
    {
      name: "adjust_inventory_quantity",
      description: `${write} Sets or adjusts inventory quantity while preventing invalid negative final stock.`,
      inputSchema: {
        type: "object",
        required: ["item", "unit", "reason"],
        properties: {
          item: { type: "string" },
          new_quantity: { type: "number" },
          delta: { type: "number" },
          unit: { type: "string" },
          reason: { type: "string" },
        },
      },
    },
    {
      name: "update_item_price",
      description: `${write} Updates a menu item price.`,
      inputSchema: {
        type: "object",
        required: ["new_price"],
        properties: {
          item_id: { type: "string" },
          item_name: { type: "string" },
          new_price: { type: "number" },
        },
      },
    },
    {
      name: "update_extra_price",
      description: `${write} Updates an extra price.`,
      inputSchema: {
        type: "object",
        required: ["new_price"],
        properties: {
          extra_id: { type: "string" },
          extra_name: { type: "string" },
          new_price: { type: "number" },
        },
      },
    },
    {
      name: "mark_order_done",
      description: `${write} Marks an order as done.`,
      inputSchema: {
        type: "object",
        required: ["order_no"],
        properties: { order_no: { type: "number" } },
      },
    },
    {
      name: "void_order",
      description: `${write} Voids an order with a reason. Dangerous reset/delete tools are not provided.`,
      inputSchema: {
        type: "object",
        required: ["order_no", "reason"],
        properties: {
          order_no: { type: "number" },
          reason: { type: "string" },
        },
      },
    },
    {
      name: "add_expense",
      description: `${write} Adds an expense row to POS state.`,
      inputSchema: {
        type: "object",
        required: ["name", "qty", "unit_price"],
        properties: {
          name: { type: "string" },
          unit: { type: "string" },
          qty: { type: "number" },
          unit_price: { type: "number" },
          note: { type: "string" },
          worker_name: { type: "string" },
        },
      },
    },
    {
      name: "change_shift",
      description: `${write} Closes open worker sessions and starts a new worker shift in day metadata.`,
      inputSchema: {
        type: "object",
        required: ["to_worker"],
        properties: {
          from_worker: { type: "string" },
          to_worker: { type: "string" },
        },
      },
    },
  ];
}

async function callTool(req, toolName, input = {}) {
  const requiredScope = TOOL_SCOPES[toolName] || (WRITE_TOOL_NAMES.has(toolName) ? "write" : "read");
  const auth = await requireMcpAuth(req, { requiredScope });
  const { supabase } = auth;

  try {
    const result = await executeTool(supabase, toolName, input, auth);
    const auditInfo = result && result.__audit ? result.__audit : {};
    if (result && result.__audit) delete result.__audit;
    if (WRITE_TOOL_NAMES.has(toolName)) {
      await audit(
        supabase,
        auth,
        toolName,
        "write",
        input,
        true,
        null,
        auditInfo.beforeState,
        auditInfo.afterState
      );
    }
    return result;
  } catch (err) {
    if (WRITE_TOOL_NAMES.has(toolName)) {
      await audit(supabase, auth, toolName, "write", input, false, err.message || String(err));
    }
    throw err;
  }
}

async function executeTool(supabase, toolName, input = {}, auth = {}) {
  const { state, writeSeq } = await loadShopState(supabase);

  if (toolName === "get_connection_info") {
    const scopes = auth.mcpContext?.scopes || [];
    return {
      connected: true,
      admin_id: auth.mcpContext?.adminId || "unknown_admin",
      admin_name: auth.mcpContext?.adminName || "Unknown Admin",
      scopes,
      can_write: scopes.some((scope) => scope === "write" || scope === "admin" || scope.startsWith("write:")),
    };
  }

  if (toolName === "get_today_sales_report") {
    const window = dateWindowFor(state, input.date);
    const orders = (await fetchOrders(supabase, { ...window, limit: 500 })).filter((o) => !o.voided);
    const expenses = expensesForDate(state, input.date);
    const grossItems = money(orders.reduce((sum, o) => sum + Number(o.itemsTotal || 0), 0));
    const deliveryFees = money(orders.reduce((sum, o) => sum + Number(o.deliveryFee || 0), 0));
    return {
      business_day_id: state.dayMeta?.dayId || "",
      started_at: state.dayMeta?.startedAt || window.fromIso,
      ended_at: state.dayMeta?.endedAt || null,
      total_orders: orders.length,
      gross_items_total: grossItems,
      delivery_fees_total: deliveryFees,
      revenue_excluding_delivery: grossItems,
      revenue_including_delivery: money(grossItems + deliveryFees),
      payment_breakdown: paymentBreakdown(orders),
      worker_breakdown: workerBreakdown(orders),
      top_items: topItems(orders),
      voided_orders_count: (await fetchOrders(supabase, { ...window, limit: 500 })).filter((o) => o.voided).length,
      expenses_total: money(expenses.reduce((sum, e) => sum + expenseAmount(e), 0)),
      estimated_margin: money(grossItems - expenses.reduce((sum, e) => sum + expenseAmount(e), 0)),
    };
  }

  if (toolName === "get_inventory_status") {
    const inventory = inventoryRows(state);
    return {
      inventory,
      low_stock_warnings: inventory.filter((item) => Number(item.qty || 0) <= Number(item.minQty || 0)),
      locked: Boolean(state.inventoryLocked),
      last_updated: state.updatedAt || null,
    };
  }

  if (toolName === "get_recent_orders") {
    const limit = Math.max(1, Math.min(Number(input.limit || 20), 100));
    let orders = await fetchOrders(supabase, { limit });
    const status = input.status || "all";
    if (status === "active") orders = orders.filter((o) => !o.done && !o.voided);
    if (status === "done") orders = orders.filter((o) => o.done && !o.voided);
    if (status === "voided") orders = orders.filter((o) => o.voided);
    return orders.slice(0, limit);
  }

  if (toolName === "get_order_by_number") {
    const orderNo = Number(input.order_no ?? input.orderNo);
    if (!Number.isInteger(orderNo) || orderNo <= 0) throw new Error("order_no must be a positive integer.");
    const [order] = await fetchOrders(supabase, { orderNo, limit: 1 });
    if (!order) throw new Error(`Order ${orderNo} was not found.`);
    return order;
  }

  if (toolName === "get_menu_items") {
    return {
      categories: state.purchaseCategories || [],
      items: state.menu || [],
      prices: (state.menu || []).map((item) => ({ id: item.id, name: item.name, price: item.price })),
      extras: state.extras || state.extraList || [],
      beverages: state.beverages || state.beverageList || [],
      order_types: state.orderTypes || [],
      default_delivery_fee: state.defaultDeliveryFee || 0,
    };
  }

  if (toolName === "get_worker_sales_report") {
    const window = dateWindowFor(state, input.date);
    let orders = (await fetchOrders(supabase, { ...window, limit: 500 })).filter((o) => !o.voided);
    if (input.worker_name) {
      const wanted = String(input.worker_name).toLowerCase();
      orders = orders.filter((o) => String(o.worker || "").toLowerCase() === wanted);
    }
    return { workers: workerBreakdown(orders) };
  }

  if (toolName === "get_expenses_report") {
    const expenses = expensesForDate(state, input.date);
    return {
      expenses,
      total_expenses: money(expenses.reduce((sum, e) => sum + expenseAmount(e), 0)),
      grouped_totals: groupExpenses(expenses),
    };
  }

  if (toolName === "get_bank_summary") {
    const tx = Array.isArray(state.bankTx) ? state.bankTx : [];
    const total = money(tx.reduce((sum, row) => sum + Number(row.amount || 0), 0));
    return {
      current_bank_total: total,
      recent_deposits: tx.filter((row) => Number(row.amount || 0) > 0).slice(0, 10),
      recent_withdrawals: tx.filter((row) => Number(row.amount || 0) < 0).slice(0, 10),
      recent_adjustments: tx.slice(0, 20),
      last_end_day_auto_post: tx.find((row) => row.source === "auto_day_margin") || null,
    };
  }

  if (toolName === "get_current_shift") {
    const dayMeta = state.dayMeta || {};
    return {
      current_worker: dayMeta.currentWorker || "",
      started_at: dayMeta.startedAt || null,
      ended_at: dayMeta.endedAt || null,
      active: dayMeta.active === false ? false : Boolean(dayMeta.startedAt && !dayMeta.endedAt),
      shift_changes: dayMeta.shiftChanges || [],
      worker_sessions: state.workerSessions || [],
      day_status: dayMeta.endedAt ? "ended" : dayMeta.startedAt ? "active" : "not_started",
    };
  }

  if (toolName === "add_inventory_restock") {
    const quantity = positiveNumber(input.quantity, "quantity");
    const beforeItem = findInventoryItem(state, input.item);
    const next = mutateInventory(state, input.item, (item) => ({
      ...item,
      qty: money(Number(item.qty || 0) + quantity),
      unit: input.unit || item.unit,
    }));
    addInventoryLedger(
      next,
      input.item,
      quantity,
      input.unit,
      input.worker_name || auth.mcpContext?.adminName || "",
      input.note || "MCP restock"
    );
    const saved = await saveShopState(supabase, next, writeSeq);
    const afterItem = findInventoryItem(saved, input.item);
    return {
      inventory: inventoryRows(saved),
      item: afterItem,
      admin_id: auth.mcpContext?.adminId,
      admin_name: auth.mcpContext?.adminName,
      __audit: { beforeState: beforeItem, afterState: afterItem },
    };
  }

  if (toolName === "adjust_inventory_quantity") {
    if (!input.reason) throw new Error("reason is required.");
    const hasNewQuantity = input.new_quantity !== undefined && input.new_quantity !== null;
    const hasDelta = input.delta !== undefined && input.delta !== null;
    if (!hasNewQuantity && !hasDelta) throw new Error("Provide new_quantity or delta.");
    const beforeItem = findInventoryItem(state, input.item);
    const next = mutateInventory(state, input.item, (item) => {
      const current = Number(item.qty || 0);
      const finalQty = hasNewQuantity ? nonNegativeNumber(input.new_quantity, "new_quantity") : current + Number(input.delta || 0);
      if (!Number.isFinite(finalQty) || finalQty < 0) throw new Error("Final inventory quantity cannot be negative.");
      return { ...item, qty: money(finalQty), unit: input.unit || item.unit };
    });
    addInventoryLedger(next, input.item, Number(input.delta || 0), input.unit, auth.mcpContext?.adminName || "", input.reason);
    const saved = await saveShopState(supabase, next, writeSeq);
    const afterItem = findInventoryItem(saved, input.item);
    return {
      inventory: inventoryRows(saved),
      item: afterItem,
      admin_id: auth.mcpContext?.adminId,
      admin_name: auth.mcpContext?.adminName,
      __audit: { beforeState: beforeItem, afterState: afterItem },
    };
  }

  if (toolName === "update_item_price") {
    const price = positiveNumber(input.new_price, "new_price");
    const beforeItem = findPricedItem(state.menu || [], input.item_id, input.item_name);
    const next = { ...state };
    next.menu = updatePricedList(next.menu || [], input.item_id, input.item_name, price, "item");
    const saved = await saveShopState(supabase, next, writeSeq);
    const afterItem = findPricedItem(saved.menu || [], input.item_id, input.item_name);
    return { item: afterItem, __audit: { beforeState: beforeItem, afterState: afterItem } };
  }

  if (toolName === "update_extra_price") {
    const price = nonNegativeNumber(input.new_price, "new_price");
    const key = state.extras ? "extras" : "extraList";
    const beforeExtra = findPricedItem(state[key] || [], input.extra_id, input.extra_name);
    const next = { ...state, [key]: updatePricedList(state[key] || [], input.extra_id, input.extra_name, price, "extra") };
    const saved = await saveShopState(supabase, next, writeSeq);
    const afterExtra = findPricedItem(saved[key] || [], input.extra_id, input.extra_name);
    return { extra: afterExtra, __audit: { beforeState: beforeExtra, afterState: afterExtra } };
  }

  if (toolName === "mark_order_done") {
    const orderNo = positiveInteger(input.order_no ?? input.orderNo, "order_no");
    const [beforeOrder] = await fetchOrders(supabase, { orderNo, limit: 1 });
    const { data, error } = await supabase
      .from("orders")
      .update({ done: true, sync_status: "pending", last_modified_device_id: "mcp" })
      .eq("shop_id", SHOP_ID)
      .eq("order_no", orderNo)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error(`Order ${orderNo} was not found.`);
    await mirrorStateOrderDone(supabase, state, writeSeq, orderNo, { done: true });
    const afterOrder = normalizeOrderRow(data);
    return { ...afterOrder, __audit: { beforeState: beforeOrder, afterState: afterOrder } };
  }

  if (toolName === "void_order") {
    const orderNo = positiveInteger(input.order_no ?? input.orderNo, "order_no");
    if (!String(input.reason || "").trim()) throw new Error("reason is required.");
    const [beforeOrder] = await fetchOrders(supabase, { orderNo, limit: 1 });
    const { data, error } = await supabase
      .from("orders")
      .update({
        voided: true,
        void_reason: String(input.reason).trim(),
        sync_status: "pending",
        last_modified_device_id: "mcp",
      })
      .eq("shop_id", SHOP_ID)
      .eq("order_no", orderNo)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error(`Order ${orderNo} was not found.`);
    await mirrorStateOrderDone(supabase, state, writeSeq, orderNo, {
      voided: true,
      voidReason: String(input.reason).trim(),
    });
    const afterOrder = normalizeOrderRow(data);
    return { ...afterOrder, __audit: { beforeState: beforeOrder, afterState: afterOrder } };
  }

  if (toolName === "add_expense") {
    const qty = positiveNumber(input.qty, "qty");
    const unitPrice = nonNegativeNumber(input.unit_price, "unit_price");
    const row = {
      id: `mcp_expense_${Date.now()}`,
      name: String(input.name || "").trim(),
      unit: input.unit || "",
      qty,
      unitPrice,
      note: input.note || "",
      worker: input.worker_name || "",
      date: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: "mcp",
      syncStatus: "pending",
      lastModifiedDeviceId: "mcp",
    };
    if (!row.name) throw new Error("name is required.");
    const next = { ...state, expenses: [row, ...(state.expenses || [])] };
    const saved = await saveShopState(supabase, next, writeSeq);
    return {
      expense: row,
      expenses_total: money((saved.expenses || []).reduce((sum, e) => sum + expenseAmount(e), 0)),
      __audit: { beforeState: null, afterState: row },
    };
  }

  if (toolName === "change_shift") {
    const toWorker = String(input.to_worker || input.toWorker || "").trim();
    if (!toWorker) throw new Error("to_worker is required.");
    const at = new Date().toISOString();
    const previousWorker = input.from_worker || state.dayMeta?.currentWorker || "";
    const nextSessions = closeOpenSessions(state.workerSessions || [], previousWorker, at);
    nextSessions.unshift({
      id: `mcp_session_${Date.now()}`,
      name: toWorker,
      signInAt: at,
      createdAt: at,
      updatedAt: at,
      source: "mcp",
      syncStatus: "pending",
      lastModifiedDeviceId: "mcp",
    });
    const nextDayMeta = {
      ...(state.dayMeta || {}),
      currentWorker: toWorker,
      startedBy: state.dayMeta?.startedBy || toWorker,
      startedAt: state.dayMeta?.startedAt || at,
      endedAt: null,
      active: true,
      updatedAt: at,
      shiftChanges: [
        ...(state.dayMeta?.shiftChanges || []),
        { at, fromWorker: previousWorker, toWorker, source: "mcp" },
      ],
    };
    const saved = await saveShopState(supabase, { ...state, dayMeta: nextDayMeta, workerSessions: nextSessions }, writeSeq);
    return {
      dayMeta: saved.dayMeta,
      workerSessions: saved.workerSessions,
      __audit: {
        beforeState: { dayMeta: state.dayMeta || {}, workerSessions: state.workerSessions || [] },
        afterState: { dayMeta: saved.dayMeta, workerSessions: saved.workerSessions },
      },
    };
  }

  throw new Error(`Unsupported MCP tool: ${toolName}`);
}

function expensesForDate(state = {}, date) {
  const expenses = Array.isArray(state.expenses) ? state.expenses : [];
  if (date) return expenses.filter((e) => sameDate(e.date || e.createdAt, date));
  const dayMeta = state.dayMeta || {};
  if (dayMeta.startedAt && !dayMeta.endedAt) {
    const start = +new Date(dayMeta.startedAt);
    return expenses.filter((e) => {
      const ms = +new Date(e.date || e.createdAt);
      return Number.isFinite(ms) && ms >= start;
    });
  }
  const today = new Date().toISOString().slice(0, 10);
  return expenses.filter((e) => sameDate(e.date || e.createdAt, today));
}

function expenseAmount(expense = {}) {
  if (expense.amount != null) return Number(expense.amount || 0) || 0;
  return (Number(expense.qty || 0) || 0) * (Number(expense.unitPrice ?? expense.unit_price ?? 0) || 0);
}

function groupExpenses(expenses = []) {
  const out = {};
  for (const expense of expenses) {
    const key = expense.name || expense.category || "Other";
    out[key] = money((out[key] || 0) + expenseAmount(expense));
  }
  return out;
}

function positiveNumber(value, field) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${field} must be greater than 0.`);
  return n;
}

function nonNegativeNumber(value, field) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${field} must be greater than or equal to 0.`);
  return n;
}

function positiveInteger(value, field) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`${field} must be a positive integer.`);
  return n;
}

function findInventoryItem(state = {}, itemRef) {
  const wanted = String(itemRef || "").trim().toLowerCase();
  return inventoryRows(state).find((item) => {
    return String(item.id || "").toLowerCase() === wanted || String(item.name || "").toLowerCase() === wanted;
  });
}

function mutateInventory(state = {}, itemRef, updater) {
  const wanted = String(itemRef || "").trim().toLowerCase();
  if (!wanted) throw new Error("item is required.");
  let found = false;
  const nextInventory = (state.inventory || []).map((item) => {
    const match =
      String(item.id || "").toLowerCase() === wanted ||
      String(item.name || "").toLowerCase() === wanted;
    if (!match) return item;
    found = true;
    return updater(item);
  });
  if (!found) throw new Error(`Inventory item "${itemRef}" was not found.`);
  return { ...state, inventory: nextInventory };
}

function addInventoryLedger(state, itemRef, qty, unit, workerName, note) {
  const item = findInventoryItem(state, itemRef);
  if (!item) return;
  const now = new Date().toISOString();
  state.inventoryLedger = [
    {
      id: `mcp_inv_${Date.now()}`,
      itemId: item.id,
      itemName: item.name,
      qty,
      unit: unit || item.unit || "",
      worker: workerName || "",
      note: note || "",
      createdAt: now,
      updatedAt: now,
      source: "mcp",
      syncStatus: "pending",
      lastModifiedDeviceId: "mcp",
    },
    ...(state.inventoryLedger || []),
  ];
}

function findPricedItem(list = [], id, name) {
  const wantedId = String(id || "").trim().toLowerCase();
  const wantedName = String(name || "").trim().toLowerCase();
  return list.find((item) => {
    return (
      (wantedId && String(item.id || "").toLowerCase() === wantedId) ||
      (wantedName && String(item.name || "").toLowerCase() === wantedName)
    );
  });
}

function updatePricedList(list = [], id, name, price, label) {
  if (!id && !name) throw new Error(`${label}_id or ${label}_name is required.`);
  let found = false;
  const next = list.map((item) => {
    const match = findPricedItem([item], id, name);
    if (!match) return item;
    found = true;
    return { ...item, price, updatedAt: new Date().toISOString(), syncStatus: "pending" };
  });
  if (!found) throw new Error(`${label} was not found.`);
  return next;
}

async function mirrorStateOrderDone(supabase, state, writeSeq, orderNo, patch) {
  if (!Array.isArray(state.orders)) return;
  let changed = false;
  const nextOrders = state.orders.map((order) => {
    const current = normalizeStateOrder(order);
    if (Number(current.orderNo) !== Number(orderNo)) return order;
    changed = true;
    return {
      ...order,
      ...patch,
      updatedAt: new Date().toISOString(),
      syncStatus: "pending",
      lastModifiedDeviceId: "mcp",
    };
  });
  if (changed) await saveShopState(supabase, { ...state, orders: nextOrders }, writeSeq);
}

function closeOpenSessions(sessions = [], worker, at) {
  return sessions.map((session) => {
    const isOpen = !session.signOutAt && !session.endedAt && !session.endAt;
    const isWorker = !worker || session.name === worker;
    if (!isOpen || !isWorker) return session;
    return {
      ...session,
      signOutAt: at,
      endedAt: at,
      updatedAt: at,
      syncStatus: "pending",
      lastModifiedDeviceId: "mcp",
    };
  });
}

async function handleTokenCreate(req, res) {
  applyCors(req, res);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return json(res, 405, { success: false, error: "Method not allowed." });

  try {
    const body = await readBody(req);
    const admin = adminFromBody(body);
    const token = generateToken();
    const scopes = normalizeScopes(body.scopes || admin.defaultScopes);
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("mcp_connection_tokens")
      .insert({
        shop_id: SHOP_ID,
        token_hash: hashToken(token),
        token_prefix: displayPrefix(token),
        name: body.name || `${admin.name} ChatGPT Connector`,
        admin_id: admin.id,
        admin_name: admin.name,
        scopes,
        active: true,
        created_by: admin.id,
        note: body.note || null,
      })
      .select("id, name, token_prefix, admin_id, admin_name, scopes, active, created_at, last_used_at, revoked_at")
      .single();
    if (error) throw error;
    return json(res, 200, {
      success: true,
      token,
      token_metadata: data,
      connector_url: `${publicAppUrl()}/api/mcp?token=${encodeURIComponent(token)}`,
      mcp_url: `${publicAppUrl()}/api/mcp`,
      warning: "Copy this token now. It will not be shown again.",
    });
  } catch (err) {
    return json(res, err.statusCode || 500, { success: false, error: err.message || String(err) });
  }
}

async function handleTokenList(req, res) {
  applyCors(req, res);
  if (handleOptions(req, res)) return;
  if (!["GET", "POST"].includes(req.method)) {
    return json(res, 405, { success: false, error: "Method not allowed." });
  }

  try {
    const body = req.method === "POST" ? await readBody(req) : {};
    const admin = adminFromBody({
      ...body,
      admin_id: body.admin_id || req.headers["x-tux-admin-id"] || (req.query && req.query.admin_id),
      admin_passcode:
        body.admin_passcode ||
        req.headers["x-tux-admin-passcode"] ||
        (req.query && req.query.admin_passcode),
    });
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("mcp_connection_tokens")
      .select("id, name, token_prefix, admin_id, admin_name, scopes, active, created_at, last_used_at, revoked_at, created_by, note")
      .eq("shop_id", SHOP_ID)
      .eq("admin_id", admin.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return json(res, 200, { success: true, tokens: data || [] });
  } catch (err) {
    return json(res, err.statusCode || 500, { success: false, error: err.message || String(err) });
  }
}

async function handleTokenRevoke(req, res) {
  applyCors(req, res);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return json(res, 405, { success: false, error: "Method not allowed." });

  try {
    const body = await readBody(req);
    const admin = adminFromBody(body);
    if (!body.token_id) throw new Error("token_id is required.");
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("mcp_connection_tokens")
      .update({ active: false, revoked_at: new Date().toISOString() })
      .eq("shop_id", SHOP_ID)
      .eq("admin_id", admin.id)
      .eq("id", body.token_id)
      .select("id, name, token_prefix, admin_id, admin_name, scopes, active, created_at, last_used_at, revoked_at")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Token was not found.");
    return json(res, 200, { success: true, token: data });
  } catch (err) {
    return json(res, err.statusCode || 500, { success: false, error: err.message || String(err) });
  }
}

function mcpResult(id, result) {
  return { jsonrpc: "2.0", id, result };
}

function mcpError(id, code, message) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

async function handleMcp(req, res) {
  applyCors(req, res);
  if (handleOptions(req, res)) return;

  try {
    if (req.method === "GET") {
      await requireMcpAuth(req, { requiredScope: "read" });
      return json(res, 200, {
        name: "Tux Cashier MCP",
        version: "1.0.0",
        mcp_url: `${publicAppUrl()}/api/mcp`,
        tools: getToolDefinitions(),
      });
    }

    if (req.method !== "POST") {
      return json(res, 405, { success: false, error: "Method not allowed." });
    }

    const body = await readBody(req);
    const method = body.method || body.action;
    const id = body.id ?? null;

    if (method === "initialize") {
      await requireMcpAuth(req, { requiredScope: "read" });
      return json(
        res,
        200,
        mcpResult(id, {
          protocolVersion: body.params?.protocolVersion || "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "Tux Cashier", version: "1.0.0" },
        })
      );
    }

    if (method === "notifications/initialized") {
      res.statusCode = 204;
      return res.end();
    }

    if (method === "tools/list" || method === "list_tools") {
      await requireMcpAuth(req, { requiredScope: "read" });
      return json(res, 200, mcpResult(id, { tools: getToolDefinitions() }));
    }

    if (method === "tools/call" || method === "call_tool") {
      const params = body.params || body;
      const name = params.name || params.tool_name;
      if (!name) return json(res, 400, mcpError(id, -32602, "Tool name is required."));
      const args = params.arguments || params.input || {};
      if (!READ_TOOL_NAMES.has(name) && !WRITE_TOOL_NAMES.has(name)) {
        return json(res, 400, mcpError(id, -32602, `Unknown tool: ${name}`));
      }
      const result = await callTool(req, name, args);
      return json(
        res,
        200,
        mcpResult(id, {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result,
        })
      );
    }

    return json(res, 400, mcpError(id, -32601, `Unsupported MCP method: ${method || "missing"}`));
  } catch (err) {
    return json(
      res,
      err.statusCode || 500,
      req.body && req.body.jsonrpc
        ? mcpError(req.body.id, err.statusCode === 401 ? -32001 : -32000, err.message || String(err))
        : { success: false, error: err.message || String(err) }
    );
  }
}

module.exports = {
  handleMcp,
  handleTokenCreate,
  handleTokenList,
  handleTokenRevoke,
  getToolDefinitions,
  hashToken,
};
