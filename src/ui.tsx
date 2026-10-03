import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Expense, SpendEvent } from './types';

export type ExpenseDraft = Partial<Expense> & { id?: string };
export type EventDraft = Partial<SpendEvent> & { id?: string };

type Ui = {
  expenseDraft: ExpenseDraft | null;
  eventDraft: EventDraft | null;
  openExpense: (draft?: ExpenseDraft) => void;
  openEvent: (draft?: EventDraft) => void;
  closeSheets: () => void;
};

const UiContext = createContext<Ui | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const [expenseDraft, setExpenseDraft] = useState<ExpenseDraft | null>(null);
  const [eventDraft, setEventDraft] = useState<EventDraft | null>(null);

  const value = useMemo<Ui>(
    () => ({
      expenseDraft,
      eventDraft,
      openExpense: (draft = {}) => {
        setEventDraft(null);
        setExpenseDraft(draft);
      },
      openEvent: (draft = {}) => {
        setExpenseDraft(null);
        setEventDraft(draft);
      },
      closeSheets: () => {
        setExpenseDraft(null);
        setEventDraft(null);
      },
    }),
    [expenseDraft, eventDraft],
  );

  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi() {
  const ui = useContext(UiContext);
  if (!ui) throw new Error('UI missing');
  return ui;
}

export function useBodyLock(locked: boolean) {
  useEffect(() => {
    document.body.classList.toggle('sheet-open', locked);
    return () => document.body.classList.remove('sheet-open');
  }, [locked]);
}
