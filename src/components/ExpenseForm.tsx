import { useEffect, useState } from 'react';
import { BottomSheet } from './BottomSheet';
import { useStore } from '../store';
import { useUi } from '../ui';
import { parseMoney, todayISO } from '../lib/format';

export function ExpenseForm() {
  const { expenseDraft, closeSheets, openEvent } = useUi();
  const { snapshot, saveExpense, deleteExpense } = useStore();
  const open = expenseDraft !== null;
  const editing = Boolean(expenseDraft?.id);

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO());
  const [eventId, setEventId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!expenseDraft) return;
    setTitle(expenseDraft.title ?? '');
    setAmount(expenseDraft.amount != null ? String(expenseDraft.amount) : '');
    setDate(expenseDraft.date ?? todayISO());
    setEventId(expenseDraft.eventId ?? '');
    setCategoryId(expenseDraft.categoryId ?? '');
    setNote(expenseDraft.note ?? '');
    setNewCategory('');
    setAddingCategory(false);
    setError('');
    setSaving(false);
    setConfirmDelete(false);
  }, [expenseDraft]);

  const events = snapshot.events.filter((event) => !event.archived || event.id === eventId);
  const categories = snapshot.categories.filter((category) => !category.archived || category.id === categoryId);

  const submit = async () => {
    const parsed = parseMoney(amount);
    if (parsed == null || parsed === 0) {
      setError('Enter an amount other than zero. Use a minus for a refund.');
      return;
    }
    if (!title.trim()) {
      setError('Add a title.');
      return;
    }
    if (!eventId) {
      setError('Choose an event.');
      return;
    }
    if (!date) {
      setError('Choose a date.');
      return;
    }
    if (!addingCategory && !categoryId) {
      setError('Choose a category.');
      return;
    }
    if (addingCategory && !newCategory.trim()) {
      setError('Name the new category.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await saveExpense(
        {
          id: expenseDraft?.id,
          eventId,
          categoryId: addingCategory ? undefined : categoryId,
          title,
          note,
          amount: parsed,
          date,
          createdAt: expenseDraft?.createdAt,
        },
        addingCategory ? newCategory : undefined,
      );
      closeSheets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!expenseDraft?.id) return;
    setSaving(true);
    setError('');
    try {
      await deleteExpense(expenseDraft.id);
      closeSheets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete.');
      setSaving(false);
    }
  };

  return (
    <BottomSheet open={open} title={editing ? 'Edit expense' : 'Add expense'} onClose={closeSheets}>
      {events.length === 0 ? (
        <div className="stack">
          <p className="lede">Create an event before logging an expense.</p>
          <button
            className="btn"
            type="button"
            onClick={() => {
              closeSheets();
              openEvent();
            }}
          >
            New event
          </button>
        </div>
      ) : (
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <label className="field">
            <span>Amount</span>
            <div className="amount-row">
              <span className="rupee">₹</span>
              <input
                className="amount-input"
                inputMode="decimal"
                autoFocus
                placeholder="0"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                aria-label="Amount in rupees"
              />
            </div>
          </label>
          <label className="field">
            <span>Title</span>
            <input className="input" value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label className="field">
            <span>Date</span>
            <input className="input" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <label className="field">
            <span>Event</span>
            <select className="input" value={eventId} onChange={(event) => setEventId(event.target.value)}>
              <option value="">Select</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Category</span>
            {addingCategory ? (
              <input
                className="input"
                value={newCategory}
                maxLength={40}
                placeholder="New category"
                onChange={(event) => setNewCategory(event.target.value)}
              />
            ) : (
              <select className="input" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                <option value="">Select</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            )}
            <button
              className="text-btn left"
              type="button"
              onClick={() => {
                setAddingCategory((value) => !value);
                setNewCategory('');
              }}
            >
              {addingCategory ? 'Choose existing' : 'New category'}
            </button>
          </label>
          <label className="field">
            <span>Note, optional</span>
            <textarea
              className="input area"
              value={note}
              maxLength={500}
              rows={3}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="btn" type="submit" disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Add expense'}
          </button>
          {editing &&
            (confirmDelete ? (
              <button className="btn danger" type="button" disabled={saving} onClick={() => void remove()}>
                Confirm delete
              </button>
            ) : (
              <button className="btn danger" type="button" onClick={() => setConfirmDelete(true)}>
                Delete expense
              </button>
            ))}
        </form>
      )}
    </BottomSheet>
  );
}
