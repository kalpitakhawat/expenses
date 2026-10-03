import { useMemo } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Pencil } from 'lucide-react';
import { PeriodFilter } from '../components/PeriodFilter';
import { formatDay, formatInr, periodLabel } from '../lib/format';
import { byRecent, filterExpenses, sumAmounts } from '../lib/select';
import { useStore } from '../store';
import { useUi } from '../ui';
import type { Period } from '../types';

const PERIODS: Period[] = ['all', 'month', '30d', 'year', 'custom'];

export function EventPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { snapshot } = useStore();
  const { openExpense, openEvent } = useUi();
  const [params, setParams] = useSearchParams();

  const period = PERIODS.includes(params.get('period') as Period) ? (params.get('period') as Period) : 'all';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const categoryId = params.get('category') ?? '';

  const event = snapshot.events.find((item) => item.id === id);
  const categories = snapshot.categories;

  const setRange = (next: { period: Period; from: string; to: string }) => {
    const query = new URLSearchParams(params);
    query.set('period', next.period);
    query.set('from', next.from);
    query.set('to', next.to);
    setParams(query, { replace: true });
  };

  const toggleCategory = (nextId: string) => {
    const query = new URLSearchParams(params);
    if (categoryId === nextId) query.delete('category');
    else query.set('category', nextId);
    setParams(query, { replace: true });
  };

  const inPeriod = useMemo(
    () => filterExpenses(snapshot.expenses, { eventId: id, from, to }).sort(byRecent),
    [snapshot.expenses, id, from, to],
  );
  const listed = categoryId ? inPeriod.filter((expense) => expense.categoryId === categoryId) : inPeriod;
  const total = sumAmounts(inPeriod);
  const allTotal = sumAmounts(snapshot.expenses.filter((expense) => expense.eventId === id));

  const breakdown = useMemo(() => {
    const groups = new Map<string, { id: string; name: string; total: number; count: number }>();
    inPeriod.forEach((expense) => {
      const name = categories.find((category) => category.id === expense.categoryId)?.name || 'Unknown';
      const current = groups.get(expense.categoryId) || { id: expense.categoryId, name, total: 0, count: 0 };
      current.total += expense.amount;
      current.count += 1;
      groups.set(expense.categoryId, current);
    });
    return [...groups.values()].sort((a, b) => b.total - a.total);
  }, [inPeriod, categories]);

  if (!event) {
    return (
      <main className="page">
        <button className="back" type="button" onClick={() => navigate('/')}>
          <ChevronLeft size={18} /> Home
        </button>
        <h1 className="title">Event not found</h1>
      </main>
    );
  }

  const budget = event.budget;
  const over = budget != null && budget > 0 && allTotal > budget;

  return (
    <main className="page">
      <div className="head">
        <button className="back" type="button" onClick={() => navigate('/')}>
          <ChevronLeft size={18} /> Home
        </button>
        <button className="icon-btn" type="button" aria-label="Edit event" onClick={() => openEvent(event)}>
          <Pencil size={18} strokeWidth={1.75} />
        </button>
      </div>
      <p className="kicker">{periodLabel(period)}</p>
      <h1 className="title">{event.name}</h1>
      {event.note && <p className="lede">{event.note}</p>}
      <p className="hero small">{formatInr(total)}</p>
      {budget != null && budget > 0 && (
        <p className={over ? 'sub over' : 'sub'}>
          {over
            ? `${formatInr(allTotal - budget)} over the ${formatInr(budget)} budget`
            : `${formatInr(Math.max(budget - allTotal, 0))} left of ${formatInr(budget)}`}
          {period !== 'all' ? ` · ${formatInr(allTotal)} overall` : ''}
        </p>
      )}

      <PeriodFilter period={period} from={from} to={to} onChange={setRange} />

      <div className="section-head">
        <h2>Categories</h2>
        <button className="text-btn" type="button" onClick={() => openExpense({ eventId: event.id, date: undefined })}>
          Add
        </button>
      </div>

      {breakdown.length === 0 ? (
        <div className="empty">
          <p>No expenses in this range.</p>
          <button className="btn" type="button" onClick={() => openExpense({ eventId: event.id })}>
            Add expense
          </button>
        </div>
      ) : (
        <div className="stack tight">
          {breakdown.map((row) => {
            const pct = total ? Math.round((row.total / total) * 100) : 0;
            const on = categoryId === row.id;
            return (
              <button
                key={row.id}
                type="button"
                className={on ? 'cat is-on' : 'cat'}
                aria-pressed={on}
                onClick={() => toggleCategory(row.id)}
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

      <div className="section-head">
        <h2>Expenses</h2>
        {categoryId && (
          <button className="text-btn" type="button" onClick={() => toggleCategory(categoryId)}>
            Clear filter
          </button>
        )}
      </div>
      <ExpenseList
        items={listed}
        categories={categories}
        onOpen={(expenseId) => {
          const expense = listed.find((item) => item.id === expenseId);
          if (expense) openExpense(expense);
        }}
      />
      <Link
        className="text-link"
        to={`/expenses?event=${event.id}&period=${period}&from=${from}&to=${to}${categoryId ? `&category=${categoryId}` : ''}`}
      >
        Open in all expenses
      </Link>
    </main>
  );
}

export function ExpenseList({
  items,
  categories,
  events,
  onOpen,
}: {
  items: { id: string; title: string; note: string; amount: number; date: string; categoryId: string; eventId: string }[];
  categories: { id: string; name: string }[];
  events?: { id: string; name: string }[];
  onOpen: (id: string) => void;
}) {
  if (!items.length) return <p className="meta">Nothing in this filter.</p>;
  const groups = new Map<string, typeof items>();
  items.forEach((item) => {
    const list = groups.get(item.date) || [];
    list.push(item);
    groups.set(item.date, list);
  });
  return (
    <div className="groups">
      {[...groups.entries()].map(([date, rows]) => (
        <section key={date}>
          <header className="day">
            <h3>{formatDay(date)}</h3>
            <span>{formatInr(sumAmounts(rows))}</span>
          </header>
          {rows.map((row) => {
            const category = categories.find((item) => item.id === row.categoryId)?.name || 'Unknown';
            const eventName = events?.find((item) => item.id === row.eventId)?.name;
            return (
              <button key={row.id} className="row" type="button" onClick={() => onOpen(row.id)}>
                <span className="row-title">{row.title}</span>
                <span className="row-meta">
                  {category}
                  {eventName ? ` · ${eventName}` : ''}
                </span>
                {row.note && <span className="row-note">{row.note}</span>}
                <span className={row.amount < 0 ? 'row-amt neg' : 'row-amt'}>{formatInr(row.amount)}</span>
              </button>
            );
          })}
        </section>
      ))}
    </div>
  );
}
