// Device access for the legacy cashier. A known denied device cannot inherit
// privileges from a failed registry refresh; admin access always requires an
// explicitly authorized device mode.
export function getCheckoutDeviceAccess({
  device = null,
  modeMeta = {},
  supabaseConfigured = false,
  deviceRegistryError = null,
} = {}) {
  const temporarilyOffline = !supabaseConfigured || Boolean(deviceRegistryError);
  const localFallback = !device && temporarilyOffline;

  return {
    canListen: Boolean(modeMeta.canListen || modeMeta.canAdmin || localFallback),
    canWrite: Boolean(modeMeta.canWrite || modeMeta.canAdmin || localFallback),
    canAdmin: Boolean(modeMeta.canAdmin),
  };
}
