import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { callSheet, enqueue, normalizeSnapshot, normalizeWebAppUrl } from './lib/api';
import {
  clearPreviewData,
  clearProfileCache,
  previewFlag,
  readLibrary,
  readPreviewData,
  readProfileCache,
  setPreviewFlag,
  writeLibrary,
  writePreviewData,
  writeProfileCache,
  type Library,
} from './lib/storage';
import { sampleSnapshot } from './sample';
import type { Category, Expense, Profile, SheetConfig, Snapshot, SpendEvent } from './types';

type Phase = 'setup' | 'syncing' | 'ready' | 'error';

type State = {
  phase: Phase;
  mode: 'sheets' | 'preview';
  config: SheetConfig | null;
  profiles: Profile[];
  activeId: string | null;
  snapshot: Snapshot;
  error: string | null;
  syncing: boolean;
  savedAt: number | null;
};

type Store = {
  phase: Phase;
  mode: 'sheets' | 'preview';
  config: SheetConfig | null;
  profiles: Profile[];
  activeId: string | null;
  snapshot: Snapshot;
  error: string | null;
  syncing: boolean;
  savedAt: number | null;
  connect: (input: { webAppUrl: string; token: string; name?: string; profileId?: string }) => Promise<void>;
  startPreview: () => void;
  refresh: () => Promise<void>;
  switchProfile: (id: string) => void;
  renameProfile: (id: string, name: string) => void;
  removeProfile: (id: string) => void;
  saveEvent: (event: {
    id?: string;
    name: string;
    note: string;
    budget: number | null;
    archived: boolean;
    createdAt?: string;
  }) => Promise<void>;
  deleteEvent: (id: string, force?: boolean) => Promise<void>;
  saveCategory: (category: { id?: string; name: string }) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  saveExpense: (
    expense: {
      id?: string;
      eventId: string;
      categoryId?: string;
      title: string;
      note: string;
      amount: number;
      date: string;
      createdAt?: string;
    },
    newCategoryName?: string,
  ) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
};

const emptySnapshot: Snapshot = {
  spreadsheetName: '',
  spreadsheetUrl: '',
  events: [],
  categories: [],
  expenses: [],
};

const StoreContext = createContext<Store | null>(null);

function activeProfile(library: Library) {
  return library.profiles.find((profile) => profile.id === library.activeId) ?? null;
}

function boot(): State {
  const library = readLibrary();
  const profile = activeProfile(library);
  if (previewFlag()) {
    return {
      phase: 'ready',
      mode: 'preview',
      config: null,
      profiles: library.profiles,
      activeId: library.activeId,
      snapshot: readPreviewData() ?? sampleSnapshot,
      error: null,
      syncing: false,
      savedAt: null,
    };
  }
  if (!profile) {
    return {
      phase: 'setup',
      mode: 'sheets',
      config: null,
      profiles: [],
      activeId: null,
      snapshot: emptySnapshot,
      error: null,
      syncing: false,
      savedAt: null,
    };
  }
  const cache = readProfileCache(profile.id);
  const config = { webAppUrl: profile.webAppUrl, token: profile.token };
  if (cache) {
    const { savedAt, ...snapshot } = cache;
    return {
      phase: 'ready',
      mode: 'sheets',
      config,
      profiles: library.profiles,
      activeId: profile.id,
      snapshot,
      error: null,
      syncing: true,
      savedAt,
    };
  }
  return {
    phase: 'syncing',
    mode: 'sheets',
    config,
    profiles: library.profiles,
    activeId: profile.id,
    snapshot: emptySnapshot,
    error: null,
    syncing: true,
    savedAt: null,
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(boot);
  const stateRef = useRef(state);
  stateRef.current = state;

  const applySnapshot = (snapshot: Snapshot, mode: 'sheets' | 'preview') => {
    if (mode === 'preview') writePreviewData(snapshot);
    else if (stateRef.current.activeId) writeProfileCache(stateRef.current.activeId, snapshot);
    setState((current) => ({
      ...current,
      phase: 'ready',
      mode,
      snapshot,
      error: null,
      syncing: false,
      savedAt: mode === 'sheets' ? Date.now() : current.savedAt,
    }));
  };

  const refresh = async () => {
    const current = stateRef.current;
    if (current.mode === 'preview' || !current.config) return;
    setState((prev) => ({ ...prev, syncing: true }));
    try {
      const raw = await enqueue(() => callSheet<Snapshot>(current.config as SheetConfig, 'load'));
      applySnapshot(normalizeSnapshot(raw), 'sheets');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not refresh.';
      setState((prev) => ({
        ...prev,
        syncing: false,
        error: message,
        phase: prev.snapshot.events.length || prev.snapshot.expenses.length ? 'ready' : 'error',
      }));
    }
  };

  useEffect(() => {
    if (stateRef.current.mode === 'sheets' && stateRef.current.config) {
      void refresh();
    }
    // Initial sync only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onVisible = () => {
      const current = stateRef.current;
      if (document.visibilityState !== 'visible') return;
      if (current.mode !== 'sheets' || !current.config) return;
      if (current.savedAt && Date.now() - current.savedAt < 120000) return;
      void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mutate = async (payload: unknown, action: string, previewApply: (snapshot: Snapshot) => Snapshot) => {
    const current = stateRef.current;
    if (current.mode === 'preview') {
      applySnapshot(previewApply(current.snapshot), 'preview');
      return;
    }
    if (!current.config) throw new Error('Connect a Google Sheet first.');
    setState((prev) => ({ ...prev, syncing: true }));
    try {
      const raw = await enqueue(() =>
        callSheet<Snapshot>(current.config as SheetConfig, action, payload),
      );
      applySnapshot(normalizeSnapshot(raw), 'sheets');
    } catch (err) {
      setState((prev) => ({ ...prev, syncing: false }));
      throw err;
    }
  };

  const value = useMemo<Store>(() => {
    return {
      phase: state.phase,
      mode: state.mode,
      config: state.config,
      profiles: state.profiles,
      activeId: state.activeId,
      snapshot: state.snapshot,
      error: state.error,
      syncing: state.syncing,
      savedAt: state.savedAt,
      connect: async ({ webAppUrl, token, name, profileId }) => {
        const config = { webAppUrl: normalizeWebAppUrl(webAppUrl), token: token.trim() };
        if (config.token.length < 8) throw new Error('Paste the API token from the Setup tab.');
        const raw = await enqueue(() => callSheet<Snapshot>(config, 'load'));
        const snapshot = normalizeSnapshot(raw);
        const library = readLibrary();
        const sameUrl = library.profiles.find((profile) => profile.webAppUrl === config.webAppUrl);
        if (profileId && sameUrl && sameUrl.id !== profileId) {
          throw new Error(`That sheet is already saved as ${sameUrl.name}.`);
        }
        const id = profileId || sameUrl?.id || crypto.randomUUID();
        const existing = library.profiles.find((profile) => profile.id === id);
        const requested = name?.trim().slice(0, 40);
        const profileName = requested || existing?.name || snapshot.spreadsheetName.trim() || 'Sheet';
        const profile: Profile = { id, name: profileName, ...config };
        const profiles = existing
          ? library.profiles.map((item) => (item.id === id ? profile : item))
          : [...library.profiles, profile];
        writeLibrary({ activeId: id, profiles });
        writeProfileCache(id, snapshot);
        clearPreviewData();
        const next: State = {
          phase: 'ready',
          mode: 'sheets',
          config,
          profiles,
          activeId: id,
          snapshot,
          error: null,
          syncing: false,
          savedAt: Date.now(),
        };
        stateRef.current = next;
        setState(next);
      },
      startPreview: () => {
        const snapshot = sampleSnapshot;
        setPreviewFlag(true);
        writePreviewData(snapshot);
        setState((current) => ({
          phase: 'ready',
          mode: 'preview',
          config: null,
          profiles: current.profiles,
          activeId: current.activeId,
          snapshot,
          error: null,
          syncing: false,
          savedAt: null,
        }));
      },
      refresh,
      switchProfile: (id: string) => {
        const profile = stateRef.current.profiles.find((item) => item.id === id);
        if (!profile || (stateRef.current.activeId === id && stateRef.current.mode === 'sheets')) return;
        const cache = readProfileCache(id);
        const { savedAt, ...snapshot } = cache ?? { ...emptySnapshot, savedAt: null };
        clearPreviewData();
        writeLibrary({ activeId: id, profiles: stateRef.current.profiles });
        const next: State = {
          phase: cache ? 'ready' : 'syncing',
          mode: 'sheets',
          config: { webAppUrl: profile.webAppUrl, token: profile.token },
          profiles: stateRef.current.profiles,
          activeId: id,
          snapshot,
          error: null,
          syncing: true,
          savedAt,
        };
        stateRef.current = next;
        setState(next);
        void refresh();
      },
      renameProfile: (id: string, name: string) => {
        const trimmed = name.trim().slice(0, 40);
        if (!trimmed) throw new Error('Name the profile.');
        const profiles = stateRef.current.profiles.map((profile) =>
          profile.id === id ? { ...profile, name: trimmed } : profile,
        );
        writeLibrary({ activeId: stateRef.current.activeId, profiles });
        setState((current) => ({ ...current, profiles }));
      },
      removeProfile: (id: string) => {
        const current = stateRef.current;
        const profiles = current.profiles.filter((profile) => profile.id !== id);
        clearProfileCache(id);
        if (profiles.length === 0) {
          writeLibrary({ activeId: null, profiles: [] });
          clearPreviewData();
          const next: State = {
            phase: 'setup',
            mode: 'sheets',
            config: null,
            profiles: [],
            activeId: null,
            snapshot: emptySnapshot,
            error: null,
            syncing: false,
            savedAt: null,
          };
          stateRef.current = next;
          setState(next);
          return;
        }
        const nextActive = current.activeId === id ? profiles[0].id : current.activeId;
        writeLibrary({ activeId: nextActive, profiles });
        if (current.mode === 'sheets' && current.activeId === id && nextActive) {
          const profile = profiles.find((item) => item.id === nextActive);
          if (!profile) return;
          const cache = readProfileCache(nextActive);
          const { savedAt, ...snapshot } = cache ?? { ...emptySnapshot, savedAt: null };
          const next: State = {
            phase: cache ? 'ready' : 'syncing',
            mode: 'sheets',
            config: { webAppUrl: profile.webAppUrl, token: profile.token },
            profiles,
            activeId: nextActive,
            snapshot,
            error: null,
            syncing: true,
            savedAt,
          };
          stateRef.current = next;
          setState(next);
          void refresh();
          return;
        }
        setState((prev) => ({ ...prev, profiles, activeId: nextActive }));
      },
      saveEvent: (event) =>
        mutate(
          {
            id: event.id,
            name: event.name,
            note: event.note,
            budget: event.budget,
            createdAt: event.createdAt,
            archived: event.archived,
          },
          'saveEvent',
          (snapshot) => {
            const next: SpendEvent = {
              id: event.id || crypto.randomUUID(),
              name: event.name.trim(),
              note: event.note.trim(),
              budget: event.budget,
              createdAt: event.createdAt || new Date().toISOString(),
              archived: event.archived,
            };
            if (!next.name) throw new Error('Event name is required.');
            const exists = snapshot.events.some((item) => item.id === next.id);
            return {
              ...snapshot,
              events: exists
                ? snapshot.events.map((item) => (item.id === next.id ? next : item))
                : [...snapshot.events, next],
            };
          },
        ),
      deleteEvent: (id, force) =>
        mutate({ id, force: Boolean(force) }, 'deleteEvent', (snapshot) => {
          const expenses = snapshot.expenses.filter((expense) => expense.eventId === id);
          if (expenses.length && !force) throw new Error('This event still has expenses.');
          return {
            ...snapshot,
            events: snapshot.events.filter((event) => event.id !== id),
            expenses: force ? snapshot.expenses.filter((expense) => expense.eventId !== id) : snapshot.expenses,
          };
        }),
      saveCategory: (category) =>
        mutate({ id: category.id, name: category.name, archived: false }, 'saveCategory', (snapshot) => {
          const name = category.name.trim();
          if (!name) throw new Error('Category name is required.');
          const id = category.id || crypto.randomUUID();
          if (
            snapshot.categories.some(
              (item) => item.id !== id && item.name.toLowerCase() === name.toLowerCase(),
            )
          ) {
            throw new Error('That category already exists.');
          }
          const next: Category = { id, name, archived: false };
          const exists = snapshot.categories.some((item) => item.id === id);
          return {
            ...snapshot,
            categories: exists
              ? snapshot.categories.map((item) => (item.id === id ? next : item))
              : [...snapshot.categories, next],
          };
        }),
      deleteCategory: (id) =>
        mutate({ id }, 'deleteCategory', (snapshot) => {
          if (snapshot.expenses.some((expense) => expense.categoryId === id)) {
            throw new Error('This category is used by expenses. Rename it instead.');
          }
          return { ...snapshot, categories: snapshot.categories.filter((category) => category.id !== id) };
        }),
      saveExpense: (expense, newCategoryName) =>
        mutate(
          {
            id: expense.id,
            eventId: expense.eventId,
            categoryId: expense.categoryId,
            newCategoryName: newCategoryName?.trim() || '',
            title: expense.title,
            note: expense.note,
            amount: expense.amount,
            date: expense.date,
            createdAt: expense.createdAt,
          },
          'saveExpense',
          (snapshot) => {
            const title = expense.title.trim();
            if (!title) throw new Error('Title is required.');
            if (!expense.amount) throw new Error('Enter an amount other than zero.');
            if (!expense.eventId) throw new Error('Choose an event.');
            if (!/^\d{4}-\d{2}-\d{2}$/.test(expense.date)) throw new Error('Choose a date.');
            let categoryId = expense.categoryId || '';
            let categories = snapshot.categories;
            const typed = newCategoryName?.trim() || '';
            if (typed) {
              const found = categories.find((category) => category.name.toLowerCase() === typed.toLowerCase());
              if (found) categoryId = found.id;
              else {
                categoryId = crypto.randomUUID();
                categories = [...categories, { id: categoryId, name: typed, archived: false }];
              }
            }
            if (!categoryId) throw new Error('Choose a category.');
            const next: Expense = {
              id: expense.id || crypto.randomUUID(),
              eventId: expense.eventId,
              categoryId,
              title,
              note: expense.note.trim(),
              amount: Math.round(expense.amount * 100) / 100,
              date: expense.date,
              createdAt: expense.createdAt || new Date().toISOString(),
            };
            const exists = snapshot.expenses.some((item) => item.id === next.id);
            return {
              ...snapshot,
              categories,
              expenses: exists
                ? snapshot.expenses.map((item) => (item.id === next.id ? next : item))
                : [...snapshot.expenses, next],
            };
          },
        ),
      deleteExpense: (id) =>
        mutate({ id }, 'deleteExpense', (snapshot) => ({
          ...snapshot,
          expenses: snapshot.expenses.filter((expense) => expense.id !== id),
        })),
    };
  }, [state]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error('Store missing');
  return store;
}
