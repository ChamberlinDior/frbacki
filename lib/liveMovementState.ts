type LiveMovementSnapshot = {
  terminalId: number;
  outside: boolean;
  currentLat?: number | null;
  currentLng?: number | null;
  updatedAt: number;
};

const liveMovementState = new Map<number, LiveMovementSnapshot>();

export function setLiveMovementSnapshot(snapshot: LiveMovementSnapshot): void {
  liveMovementState.set(snapshot.terminalId, snapshot);
}

export function getLiveMovementSnapshot(terminalId?: number | null): LiveMovementSnapshot | null {
  if (terminalId == null) return null;
  return liveMovementState.get(terminalId) ?? null;
}

export function clearLiveMovementSnapshot(terminalId?: number | null): void {
  if (terminalId == null) return;
  liveMovementState.delete(terminalId);
}

export function clearAllLiveMovementSnapshots(): void {
  liveMovementState.clear();
}
