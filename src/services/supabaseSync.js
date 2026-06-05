export function compareIsoTimestamps(localUpdatedAt, remoteUpdatedAt) {
  const localMs = localUpdatedAt ? new Date(localUpdatedAt).getTime() : 0;
  const remoteMs = remoteUpdatedAt ? new Date(remoteUpdatedAt).getTime() : 0;
  const safeLocal = Number.isFinite(localMs) ? localMs : 0;
  const safeRemote = Number.isFinite(remoteMs) ? remoteMs : 0;

  if (safeLocal > safeRemote) return "local";
  if (safeRemote > safeLocal) return "remote";
  return "equal";
}

export function newestWins(localValue, remoteValue, getUpdatedAt = (value) => value?.updatedAt) {
  return compareIsoTimestamps(getUpdatedAt(localValue), getUpdatedAt(remoteValue)) === "remote"
    ? remoteValue
    : localValue;
}
