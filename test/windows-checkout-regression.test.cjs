const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "../src/App.js"), "utf8");
const checkout = app.split("const checkout = async () => {")[1].split("const integrateOnlineOrder = async ")[0];

test("invalid split payment cannot debit inventory", () => {
  assert.ok(checkout.indexOf("if (sum !== Number(total.toFixed(2)))") >= 0);
  assert.ok(checkout.indexOf("setInventory((inv) =>") > checkout.indexOf("if (sum !== Number(total.toFixed(2)))"));
});

test("checkout has a synchronous lock to prevent double submission", () => {
  assert.match(app, /const checkoutInFlightRef = useRef\(false\)/);
  assert.match(checkout, /if \(checkoutInFlightRef\.current\) return/);
  assert.match(checkout, /checkoutInFlightRef\.current = true/);
  assert.match(checkout, /finally\s*\{\s*checkoutInFlightRef\.current = false/);
});

test("cloud subscription is disabled when cloud mode is disabled", () => {
  assert.match(app, /if \(!cloudEnabled \|\| !realtimeOrders \|\| !ordersColRef \|\| !fbUser\) return/);
  assert.match(app, /\[realtimeOrders, cloudEnabled, ordersColRef, fbUser, startedAtMs, endedAtMs\]/);
});

test("cloud refresh merges local pending orders instead of erasing them", () => {
  const listener = app.slice(app.indexOf("if (!cloudEnabled || !realtimeOrders || !ordersColRef || !fbUser) return"), app.indexOf("const recomputeOnlineOrders"));
  assert.match(listener, /setOrders\(prev => \{/);
  assert.match(listener, /const pending = prev\.filter\(o => o\.syncStatus === SYNC_STATUS\.pending\)/);
  assert.match(listener, /dedupeOrders\(\[\.\.\.pending, \.\.\.arr\]\)/);
});

test("offline order still persists locally and print uses final allocated number", () => {
  assert.match(app, /saveLocalPartial\(\{ orders \}\)/);
  assert.match(checkout, /setOrders\(\(o\) => dedupeOrders\(\[order, \.\.\.o\]\)\)/);
  assert.ok(checkout.indexOf("printReceiptHTML(order") > checkout.indexOf("await allocateOrderNoAtomic()"));
});
