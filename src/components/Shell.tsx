import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Home, PieChart, Plus, Receipt, Settings } from 'lucide-react';
import { ExpenseForm } from './ExpenseForm';
import { EventForm } from './EventForm';
import { useStore } from '../store';
import { useUi } from '../ui';

export function AppFrame() {
  const { phase, snapshot, syncing, error, mode, refresh } = useStore();
  const { openEvent, openExpense, expenseDraft, eventDraft } = useUi();
  const navigate = useNavigate();
  const empty = snapshot.events.length === 0 && snapshot.expenses.length === 0;

  const add = () => {
    const active = snapshot.events.filter((event) => !event.archived);
    if (active.length === 1) openExpense({ eventId: active[0].id });
    else if (!active.length) openEvent();
    else openExpense();
  };

  return (
    <div className="app">
      {syncing && (
        <div className="progress" aria-hidden="true">
          <span />
        </div>
      )}
      {mode === 'preview' && (
        <button className="banner" type="button" onClick={() => navigate('/setup')}>
          Sample data on this device. Connect a Google Sheet to save.
        </button>
      )}
      {error && mode === 'sheets' && phase === 'ready' && (
        <button className="banner warn" type="button" onClick={() => void refresh()}>
          {error} Tap to retry.
        </button>
      )}
      {phase === 'error' ? (
        <ErrorState />
      ) : phase === 'syncing' && empty ? (
        <LoadingState />
      ) : (
        <Outlet />
      )}
      <nav className="nav" aria-label="Primary">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'nav-link is-on' : 'nav-link')}>
          <span className="nav-icon">
            <Home size={22} strokeWidth={1.75} />
          </span>
          <span>Home</span>
        </NavLink>
        <NavLink to="/expenses" className={({ isActive }) => (isActive ? 'nav-link is-on' : 'nav-link')}>
          <span className="nav-icon">
            <Receipt size={22} strokeWidth={1.75} />
          </span>
          <span>Expenses</span>
        </NavLink>
        <button className="nav-link nav-add" type="button" onClick={add}>
          <span className="nav-icon nav-plus" aria-hidden="true">
            <Plus size={18} strokeWidth={2.25} />
          </span>
          <span>Add</span>
        </button>
        <NavLink to="/categories" className={({ isActive }) => (isActive ? 'nav-link is-on' : 'nav-link')}>
          <span className="nav-icon">
            <PieChart size={22} strokeWidth={1.75} />
          </span>
          <span>Categories</span>
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => (isActive ? 'nav-link is-on' : 'nav-link')}>
          <span className="nav-icon">
            <Settings size={22} strokeWidth={1.75} />
          </span>
          <span>Settings</span>
        </NavLink>
      </nav>
      <ExpenseForm key={expenseDraft?.id ?? (expenseDraft ? 'new-expense' : 'expense-closed')} />
      <EventForm key={eventDraft?.id ?? (eventDraft ? 'new-event' : 'event-closed')} />
    </div>
  );
}

function LoadingState() {
  return (
    <main className="page">
      <p className="kicker">Expenses</p>
      <div className="skeleton hero-skeleton" />
      <div className="skeleton" />
      <div className="skeleton" />
    </main>
  );
}

function ErrorState() {
  const { error, refresh, activeId } = useStore();
  const navigate = useNavigate();
  return (
    <main className="page">
      <p className="kicker">Expenses</p>
      <h1 className="title">Couldn’t open the sheet</h1>
      <p className="lede">{error || 'Check the web app URL and API token.'}</p>
      <div className="stack">
        <button className="btn" type="button" onClick={() => void refresh()}>
          Try again
        </button>
        <button
          className="btn ghost"
          type="button"
          onClick={() => navigate(activeId ? `/setup?profile=${activeId}` : '/setup')}
        >
          Edit connection
        </button>
      </div>
    </main>
  );
}
