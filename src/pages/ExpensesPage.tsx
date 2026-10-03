import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PeriodFilter } from '../components/PeriodFilter';
import { ExpenseList } from './EventPage';
import { formatInr } from '../lib/format';
import { byRecent, filterExpenses, sumAmounts } from '../lib/select';
import { useStore } from '../store';
import { useUi } from '../ui';
import type { Period } from '../types';

const PERIODS: Period[] = ['all', 'month', '30d', 'year', 'custom'];

export function ExpensesPage() {
  const { snapshot } = useStore();
  const { openExpense } = useUi();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');

  const period = PERIODS.includes(params.get('period') as Period) ? (params.get('period') as Period) : 'all';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const eventId = params.get('event') ?? '';
  const categoryId = params.get('category') ?? '';

  const update = (patch: Record<string, string>) => {
    const query = new URLSearchParams(params);
    Object.entries(patch).forEach(([key, value]) => {
      if (value) query.set(key, value);
      else query.delete(key);
    });
    setParams(query, { replace: true });
  };

  const items = useMemo(
    () => filterExpenses(snapshot.expenses, { eventId, categoryId, from, to, search }).sort(byRecent),
    [snapshot.expenses, eventId, categoryId, from, to, search],
  );

  const filtersOn = Boolean(search || eventId || categoryId || from || to || period !== 'all');

  return (
    <main className="page">
      <p className="kicker">All expenses</p>
      <h1 className="hero small">{formatInr(sumAmounts(items))}</h1>
      <p className="sub">
        {items.length} {items.length === 1 ? 'expense' : 'expenses'}
      </p>

      <label className="field">
        <span className="sr">Search</span>
        <input
          className="input"
          placeholder="Search title or note"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>

      <div className="date-pair">
        <label className="field">
          <span>Event</span>
          <select className="input" value={eventId} onChange={(event) => update({ event: event.target.value })}>
            <option value="">All events</option>
            {snapshot.events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Category</span>
          <select className="input" value={categoryId} onChange={(event) => update({ category: event.target.value })}>
            <option value="">All categories</option>
            {snapshot.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <PeriodFilter
        period={period}
        from={from}
        to={to}
        onChange={(next) => update({ period: next.period, from: next.from, to: next.to })}
      />

      {filtersOn && (
        <button
          className="text-btn left"
          type="button"
          onClick={() => {
            setSearch('');
            setParams({}, { replace: true });
          }}
        >
          Clear filters
        </button>
      )}

      <ExpenseList
        items={items}
        categories={snapshot.categories}
        events={snapshot.events}
        onOpen={(id) => {
          const expense = snapshot.expenses.find((item) => item.id === id);
          if (expense) openExpense(expense);
        }}
      />
    </main>
  );
}
