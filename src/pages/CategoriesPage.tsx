import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PeriodFilter } from '../components/PeriodFilter';
import { formatInr, periodLabel, rangeFor } from '../lib/format';
import { filterExpenses, sumAmounts } from '../lib/select';
import { useStore } from '../store';
import type { Period } from '../types';

export function CategoriesPage() {
  const { snapshot } = useStore();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const range = rangeFor(period, { from, to });
  const inPeriod = useMemo(
    () => filterExpenses(snapshot.expenses, range),
    [snapshot.expenses, range],
  );
  const total = sumAmounts(inPeriod);

  const rows = useMemo(() => {
    const groups = new Map<string, { id: string; name: string; total: number; count: number }>();
    inPeriod.forEach((expense) => {
      const name = snapshot.categories.find((category) => category.id === expense.categoryId)?.name || 'Unknown';
      const current = groups.get(expense.categoryId) || { id: expense.categoryId, name, total: 0, count: 0 };
      current.total += expense.amount;
      current.count += 1;
      groups.set(expense.categoryId, current);
    });
    return [...groups.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  }, [inPeriod, snapshot.categories]);

  return (
    <main className="page">
      <p className="kicker">{periodLabel(period)}</p>
      <h1 className="hero small">{formatInr(total)}</h1>
      <p className="sub">By category, across events</p>

      <PeriodFilter
        period={period}
        from={from}
        to={to}
        onChange={(next) => {
          setPeriod(next.period);
          setFrom(next.from);
          setTo(next.to);
        }}
      />

      {rows.length === 0 ? (
        <div className="empty">
          <p>No expenses in this range.</p>
        </div>
      ) : (
        <div className="stack tight">
          {rows.map((row) => {
            const pct = total ? Math.round((row.total / total) * 100) : 0;
            return (
              <button
                key={row.id}
                type="button"
                className="cat"
                onClick={() =>
                  navigate(`/expenses?category=${row.id}&period=${period}&from=${range.from}&to=${range.to}`)
                }
              >
                <div className="card-top">
                  <strong>{row.name}</strong>
                  <span className="amt">{formatInr(row.total)}</span>
                </div>
                <div className="bar">
                  <span style={{ width: `${Math.max(pct, row.total ? 4 : 0)}%` }} />
                </div>
                <p className="meta">
                  {row.count} {row.count === 1 ? 'expense' : 'expenses'} · {pct}%
                </p>
              </button>
            );
          })}
        </div>
      )}
    </main>
  );
}
