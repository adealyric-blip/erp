import type { FactorScores } from './scoring';
import type { EvaluationWeights } from './scoring';

// ScoreCard — T19. One bid's four weighted factors: price, lead time,
// quality, compliance (0..5 each), plus the weighted total. A factor with
// no score renders "not scored" — never a silent zero.

export interface ScoreCardProps {
  vendorName: string;
  bidStatus: string;
  currency: string;
  landedTotal: number;
  leadTimeDays: number | null;
  factors: FactorScores;
  total: number;
  scoredFactors: Array<keyof FactorScores>;
  weights: EvaluationWeights;
}

const LABELS: Array<{ key: keyof FactorScores; label: string }> = [
  { key: 'price', label: 'Price' },
  { key: 'lead_time', label: 'Lead time' },
  { key: 'quality', label: 'Quality' },
  { key: 'compliance', label: 'Compliance' },
];

export default function ScoreCard({ vendorName, bidStatus, currency, landedTotal, leadTimeDays, factors, total, scoredFactors, weights }: ScoreCardProps) {
  return (
    <article data-testid="score-card" className="rounded-md border bg-white px-4 py-3">
      <h3 className="font-medium">{vendorName}</h3>
      <p className="text-xs text-neutral-500">
        {bidStatus} · landed {landedTotal.toFixed(2)} {currency}
        {leadTimeDays != null ? ` · ${leadTimeDays} days` : ''}
      </p>
      <dl className="mt-3 space-y-2">
        {LABELS.map(({ key, label }) => {
          const v = factors[key];
          const w = weights[key];
          const scored = scoredFactors.includes(key);
          return (
            <div key={key} className="flex items-center gap-2 text-sm">
              <dt className="w-24 shrink-0 text-neutral-600">
                {label} <span className="text-xs text-neutral-400">({Math.round(w * 100)}%)</span>
              </dt>
              <dd className="h-2 flex-1 overflow-hidden rounded bg-neutral-200">
                <div className="h-full bg-neutral-900" style={{ width: `${((v ?? 0) / 5) * 100}%` }} />
              </dd>
              <dd className="w-20 shrink-0 text-right font-mono text-xs">{scored && v != null ? `${v.toFixed(2)} / 5` : 'not scored'}</dd>
            </div>
          );
        })}
      </dl>
      <p className="mt-3 text-sm">
        Weighted total: <strong>{total.toFixed(2)} / 5</strong>
      </p>
    </article>
  );
}
