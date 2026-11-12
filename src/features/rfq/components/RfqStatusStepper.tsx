// RfqStatusStepper — draft → published → closed → awarded (T17).
'use client';

import { useRFQStatus } from '../useRFQStatus';

export function RfqStatusStepper({ status }: { status: string }) {
  const { steps } = useRFQStatus(status);
  return (
    <ol data-testid="rfq-status-stepper" className="flex flex-wrap items-center gap-2" aria-label={`RFQ status: ${status}`}>
      {steps.map((step, i) => (
        <li key={step.id} className="flex items-center gap-2">
          {i > 0 && <span aria-hidden className="text-neutral-400">→</span>}
          <span
            data-testid={`rfq-step-${step.id}`}
            data-state={step.state}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              step.state === 'current'
                ? 'bg-black text-white'
                : step.state === 'done'
                  ? 'bg-green-100 text-green-900'
                  : 'bg-neutral-100 text-neutral-500'
            }`}
          >
            {step.state === 'done' ? '✓ ' : ''}{step.label}
          </span>
        </li>
      ))}
      {status === 'cancelled' && (
        <li className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-900">Cancelled</li>
      )}
    </ol>
  );
}
