export const roundMoney = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Number(numeric.toFixed(2)) : 0;
};

export function normalizeFixedDiscountAmount(value, subtotal = Infinity) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  const max = Number.isFinite(Number(subtotal))
    ? Math.max(0, Number(subtotal))
    : Infinity;
  return roundMoney(Math.min(numeric, max));
}

export function getOrderDiscountAmount(order = {}) {
  const raw = Number(order?.discountAmount ?? order?.discount ?? 0);
  return Number.isFinite(raw) ? Math.abs(roundMoney(raw)) : 0;
}

export function getOrderDiscountPercentage(order = {}) {
  return 0;
}

export function getOrderNetItemsAmount(order = {}) {
  const delivery = Math.max(0, Number(order?.deliveryFee || 0));
  const rawDiscount = Number(order?.discountAmount ?? order?.discount ?? 0);
  if (order?.itemsTotal != null) {
    const storedItems = Number(order.itemsTotal || 0);
    const netItems =
      Number.isFinite(rawDiscount) && rawDiscount < 0
        ? storedItems + rawDiscount
        : storedItems;
    return roundMoney(Math.max(0, Number.isFinite(netItems) ? netItems : 0));
  }
  const net = Number(order?.total || 0) - delivery;
  return roundMoney(Math.max(0, Number.isFinite(net) ? net : 0));
}
