import { useEffect, useState } from 'react';
import { BottomSheet } from './BottomSheet';
import { useStore } from '../store';
import { useUi } from '../ui';
import { parseMoney } from '../lib/format';

export function EventForm() {
  const { eventDraft, closeSheets } = useUi();
  const { snapshot, saveEvent, deleteEvent } = useStore();
  const open = eventDraft !== null;
  const editing = Boolean(eventDraft?.id);
  const expenseCount = snapshot.expenses.filter((expense) => expense.eventId === eventDraft?.id).length;

  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [budget, setBudget] = useState('');
  const [archived, setArchived] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!eventDraft) return;
    setName(eventDraft.name ?? '');
    setNote(eventDraft.note ?? '');
    setBudget(eventDraft.budget != null ? String(eventDraft.budget) : '');
    setArchived(Boolean(eventDraft.archived));
    setError('');
    setSaving(false);
    setConfirmDelete(false);
  }, [eventDraft]);

  const submit = async () => {
    if (!name.trim()) {
      setError('Name the event.');
      return;
    }
    let parsed: number | null = null;
    if (budget.trim()) {
      parsed = parseMoney(budget);
      if (parsed == null || parsed < 0) {
        setError('Budget should be a positive amount, or left blank.');
        return;
      }
    }
    setSaving(true);
    setError('');
    try {
      await saveEvent({
        id: eventDraft?.id || crypto.randomUUID(),
        name,
        note,
        budget: parsed,
        archived,
        createdAt: eventDraft?.createdAt,
      });
      closeSheets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!eventDraft?.id) return;
    setSaving(true);
    setError('');
    try {
      await deleteEvent(eventDraft.id, true);
      closeSheets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete.');
      setSaving(false);
    }
  };

  return (
    <BottomSheet open={open} title={editing ? 'Edit event' : 'New event'} onClose={closeSheets}>
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label className="field">
          <span>Name</span>
          <input
            className="input"
            autoFocus
            value={name}
            maxLength={80}
            placeholder="Trip, renovation, wedding"
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Note, optional</span>
          <textarea className="input area" value={note} maxLength={500} rows={3} onChange={(event) => setNote(event.target.value)} />
        </label>
        <label className="field">
          <span>Budget, optional</span>
          <div className="amount-row slim">
            <span className="rupee">₹</span>
            <input
              className="input bare"
              inputMode="decimal"
              placeholder="No budget"
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
              aria-label="Budget in rupees"
            />
          </div>
        </label>
        {editing && (
          <label className="check">
            <input type="checkbox" checked={archived} onChange={(event) => setArchived(event.target.checked)} />
            <span>Archive this event</span>
          </label>
        )}
        {error && <p className="form-error">{error}</p>}
        <button className="btn" type="submit" disabled={saving}>
          {saving ? 'Saving…' : editing ? 'Save changes' : 'Create event'}
        </button>
        {editing &&
          (confirmDelete ? (
            <button className="btn danger" type="button" disabled={saving} onClick={() => void remove()}>
              {expenseCount ? `Delete event and ${expenseCount} expenses` : 'Confirm delete'}
            </button>
          ) : (
            <button className="btn danger" type="button" onClick={() => setConfirmDelete(true)}>
              Delete event
            </button>
          ))}
      </form>
    </BottomSheet>
  );
}
