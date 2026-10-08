const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "src/AppCore.js"), "utf8");
const policySource = fs.readFileSync(path.join(root, "src/checkoutPolicy.js"), "utf8");

async function getPolicy() {
  return import(`data:text/javascript;base64,${Buffer.from(policySource).toString("base64")}`);
}

const listen = { canWrite: false, canListen: true, canAdmin: false };
const approved = { canWrite: true, canListen: true, canAdmin: false };
const admin = { canWrite: false, canListen: true, canAdmin: true };
const blocked = { canWrite: false, canListen: false, canAdmin: false };

test("unconfigured local POS can checkout without a device registry", async () => {
  const { getCheckoutDeviceAccess } = await getPolicy();
  const access = getCheckoutDeviceAccess({
    device: null, modeMeta: listen, supabaseConfigured: false, deviceRegistryError: null,
  });
  assert.equal(access.canWrite, true);
  assert.equal(access.canAdmin, false);
});

test("unknown device waits for permission when Supabase is available", async () => {
  const { getCheckoutDeviceAccess } = await getPolicy();
  const access = getCheckoutDeviceAccess({
    device: null, modeMeta: listen, supabaseConfigured: true, deviceRegistryError: null,
  });
  assert.equal(access.canWrite, false);
});

test("an authorized device can checkout and admin retains explicit access", async () => {
  const { getCheckoutDeviceAccess } = await getPolicy();
  assert.equal(getCheckoutDeviceAccess({
    device: { mode: "write" }, modeMeta: approved, supabaseConfigured: true,
  }).canWrite, true);
  assert.equal(getCheckoutDeviceAccess({
    device: { mode: "admin" }, modeMeta: admin, supabaseConfigured: true,
  }).canAdmin, true);
});

test("registered listen-only/blocked devices cannot checkout or become admin during outages", async () => {
  const { getCheckoutDeviceAccess } = await getPolicy();
  for (const modeMeta of [listen, blocked]) {
    const access = getCheckoutDeviceAccess({
      device: { mode: "blocked" }, modeMeta, supabaseConfigured: true,
      deviceRegistryError: "network unreachable",
    });
    assert.equal(access.canWrite, false);
    assert.equal(access.canAdmin, false);
  }
});

test("registry outage retains legacy local offline checkout for unregistered devices, not admin privileges", async () => {
  const { getCheckoutDeviceAccess } = await getPolicy();
  const access = getCheckoutDeviceAccess({
    device: null, modeMeta: listen, supabaseConfigured: true,
    deviceRegistryError: "network unreachable",
  });
  assert.equal(access.canWrite, true);
  assert.equal(access.canAdmin, false);
});

test("checkout uses the shared device policy", () => {
  assert.match(source, /getCheckoutDeviceAccess\(\{/);
  assert.match(source, /currentDeviceCanWrite = deviceAccess\.canWrite/);
  assert.match(source, /currentDeviceCanAdmin = deviceAccess\.canAdmin/);
});

test("invalid split amount exits before inventory ledger is debited", () => {
  const checkout = source.split("const checkout = async () => {")[1].split("const integrateOnlineOrder = async ")[0];
  assert.ok(checkout, "checkout handler must exist");
  const splitValidation = checkout.indexOf("if (sum !== Number(total.toFixed(2)))");
  const debit = checkout.indexOf("setInventoryLedger(prev =>");
  assert.ok(splitValidation >= 0 && debit > splitValidation, "split payment must be checked before ledger mutation");
});

test("realtime listener must not run while cloud mode is off", () => {
  assert.match(source, /if \(!cloudEnabled \|\| !realtimeOrders \|\| !ordersColRef \|\| !fbUser\) return/);
  assert.match(source, /realtimeOrders,\s*cloudEnabled,\s*ordersColRef,/);
});

test("checkout locks synchronously across same-tick clicks and releases in finally", () => {
  const checkout = source.split("const checkout = async () => {")[1].split("const integrateOnlineOrder = async ")[0];
  assert.match(source, /const checkoutInFlightRef = useRef\(false\)/);
  assert.match(checkout, /if \(checkoutInFlightRef\.current\) return/);
  assert.match(checkout, /checkoutInFlightRef\.current = true/);
  assert.match(checkout, /finally\s*\{\s*checkoutInFlightRef\.current = false/);
});

test("printing uses the allocated order identity and local write stays unconditional", () => {
  const checkout = source.split("const checkout = async () => {")[1].split("const integrateOnlineOrder = async ")[0];
  assert.ok(checkout.indexOf("printReceiptHTML(order") > checkout.indexOf("await allocateOrderNoAtomic()"));
  assert.match(checkout, /setOrders\(\(o\) => dedupeOrders\(\[order, \.\.\.o\]\)\)/);
});
