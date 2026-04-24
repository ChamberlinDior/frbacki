import { useMemo } from 'react';
import { deduplicateDevices } from '../lib/deviceIdentity';
import type { TerminalSummary } from '../lib/types';

export function useDeduplicatedDevices(devices: TerminalSummary[]) {
  return useMemo(() => deduplicateDevices(devices), [devices]);
}
