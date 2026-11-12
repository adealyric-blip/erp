// useRFQStatus — RFQ stepper state (T17).
// Pure step derivation lives in lib/validation (rfqStatusStepIndex);
// this hook is the client-side stepper used by RfqStatusStepper.
'use client';

import { useMemo } from 'react';
import { RFQ_STATUS_LABELS, RFQ_STATUS_STEPS, rfqStatusStepIndex } from './lib/validation';

export interface RfqStep {
  id: string;
  label: string;
  state: 'done' | 'current' | 'upcoming';
}

export function useRFQStatus(status: string): { steps: RfqStep[]; currentIndex: number; currentLabel: string } {
  return useMemo(() => {
    const currentIndex = rfqStatusStepIndex(status);
    const steps: RfqStep[] = (RFQ_STATUS_STEPS as readonly string[]).map((id, i) => ({
      id,
      label: RFQ_STATUS_LABELS[id] ?? id,
      state: i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'upcoming',
    }));
    return { steps, currentIndex, currentLabel: RFQ_STATUS_LABELS[status] ?? status };
  }, [status]);
}
