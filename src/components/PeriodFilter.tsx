import type { Period } from '../types';
import { rangeFor } from '../lib/format';

const OPTIONS: { id: Period; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'month', label: 'Month' },
  { id: '30d', label: '30 days' },
  { id: 'year', label: 'Year' },
  { id: 'custom', label: 'Range' },
];

export function PeriodFilter({
  period,
  from,
  to,
  onChange,
}: {
  period: Period;
  from: string;
  to: string;
  onChange: (next: { period: Period; from: string; to: string }) => void;
}) {
  return (
    <div className="period">
      <div className="chips" role="tablist" aria-label="Date range">
        {OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={period === option.id ? 'chip is-on' : 'chip'}
            aria-pressed={period === option.id}
            onClick={() => {
              const range = rangeFor(option.id, { from, to });
              onChange({ period: option.id, ...range });
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
      {period === 'custom' && (
        <div className="date-pair">
          <label className="field">
            <span>From</span>
            <input
              className="input"
              type="date"
              value={from}
              onChange={(event) => onChange({ period: 'custom', from: event.target.value, to })}
            />
          </label>
          <label className="field">
            <span>To</span>
            <input
              className="input"
              type="date"
              value={to}
              onChange={(event) => onChange({ period: 'custom', from, to: event.target.value })}
            />
          </label>
        </div>
      )}
    </div>
  );
}
