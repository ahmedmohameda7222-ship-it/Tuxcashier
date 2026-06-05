export const SYNC_STATUS = {
  pending: "pending",
  synced: "synced",
  failed: "failed",
};

export function shouldAttemptOnlineSync() {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}
