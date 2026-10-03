import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { PeriodFilter } from '../components/PeriodFilter';
import { formatDay, formatInr, periodLabel, rangeFor } from '../lib/format';
import { filterExpenses, latestDate, sumAmounts } from '../lib/select';
import { useStore } from '../store';
import { useUi } from '../ui';
import type { Period } from '../types';

export function DashboardPage() {
  const { snapshot, refresh, syncing } = useStore();
  const { openEvent } = useUi();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const range = rangeFor(period, { from, to });
  const active = snapshot.events.filter((event) => !event.archived);
  const archived = snapshot.events.filter((event) => event.archived);
  const visible = showArchived ? snapshot.events : active;

  const cards = useMemo(() => {
    return visible
      .map((event) => {
        const mine = snapshot.expenses.filter((expense) => expense.eventId === event.id);
        const inRange = filterExpenses(mine, range);
        return {
          event,
          total: sumAmounts(inRange),
          allTotal: sumAmounts(mine),
          count: inRange.length,
          latest: latestDate(inRange),
        };
      })
      .sort((a, b) => {
        if (a.latest !== b.latest) return a.latest < b.latest ? 1 : -1;
        return a.event.name.localeCompare(b.event.name);
      });
  }, [visible, snapshot.expenses, range]);

  const periodExpenses = filterExpenses(snapshot.expenses, {
    ...range,
    eventId: undefined,
  }).filter((expense) => {
    const event = snapshot.events.find((item) => item.id === expense.eventId);
    return showArchived || !event?.archived;
  });

  return (
    <main className="page">
      <header className="head">
        <div>
          <p className="kicker">{periodLabel(period)}</p>
          <h1 className="hero">{formatInr(sumAmounts(periodExpenses))}</h1>
          <p className="sub">
            {active.length} {active.length === 1 ? 'event' : 'events'} · {periodExpenses.length}{' '}
            {periodExpenses.length === 1 ? 'expense' : 'expenses'}
          </p>
        </div>
        <button className="icon-btn" type="button" onClick={() => void refresh()} aria-label="Refresh" disabled={syncing}>
          <RefreshCw size={18} strokeWidth={1.75} />
        </button>
      </header>

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

      <div className="section-head">
        <h2>Events</h2>
        <button className="text-btn" type="button" onClick={() => openEvent()}>
          New event
        </button>
      </div>

      {cards.length === 0 ? (
        <div className="empty">
          <p>No events yet.</p>
          <button className="btn" type="button" onClick={() => openEvent()}>
            Create an event
          </button>
        </div>
      ) : (
        <div className="stack">
          {cards.map(({ event, total, allTotal, count, latest }) => {
            const budget = event.budget;
            const pct = budget ? Math.min(100, Math.round((allTotal / budget) * 100)) : 0;
            const over = budget != null && allTotal > budget;
            return (
              <button
                key={event.id}
                className="card tap"
                type="button"
                onClick={() =>
                  navigate(`/events/${event.id}?period=${period}&from=${range.from}&to=${range.to}`)
                }
              >
                <div className="card-top">
                  <div>
                    <h3>{event.name}</h3>
                    <p className="meta">
                      {count ? `${count} in this view` : 'No expenses in this view'}
                      {latest ? ` · ${formatDay(latest)}` : ''}
                      {event.archived ? ' · Archived' : ''}
                    </p>
                  </div>
                  <strong className={over ? 'amt over' : 'amt'}>{formatInr(total)}</strong>
                </div>
                {event.note && <p className="note">{event.note}</p>}
                {budget != null && budget > 0 && (
                  <>
                    <div className="bar" aria-hidden="true">
                      <span style={{ width: `${pct}%` }} className={over ? 'over' : ''} />
                    </div>
                    <p className="meta">
                      {over
                        ? `${formatInr(allTotal - budget)} over ${formatInr(budget)}`
                        : `${formatInr(budget - allTotal)} left of ${formatInr(budget)}`}
                    </p>
                  </>
                )}
              </button>
            );
          })}
        </div>
      )}

      {archived.length > 0 && (
        <button className="text-btn left pad" type="button" onClick={() => setShowArchived((value) => !value)}>
          {showArchived ? 'Hide archived' : `Archived (${archived.length})`}
        </button>
      )}

      <Link className="text-link" to={`/expenses?period=${period}&from=${range.from}&to=${range.to}`}>
        List all expenses
      </Link>
    </main>
  );
}
