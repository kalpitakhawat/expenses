import type { Category, Expense, SheetConfig, Snapshot, SpendEvent } from '../types';

type Raw = Record<string, unknown>;

let chain: Promise<unknown> = Promise.resolve();

export function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const next = chain.then(task, task);
  chain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

export function normalizeWebAppUrl(input: string) {
  const url = input.trim().split('?')[0].replace(/\/$/, '');
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[a-zA-Z0-9_-]+\/exec$/.test(url)) {
    throw new Error('Paste the web app URL that ends with /exec.');
  }
  return url;
}

export function callSheet<T>(config: SheetConfig, action: string, payload?: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const cb = `et_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e9).toString(36)}`;
    const script = document.createElement('script');
    let done = false;

    const finish = (error: Error | null, data?: T) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      delete (window as unknown as Record<string, unknown>)[cb];
      script.remove();
      if (error) reject(error);
      else resolve(data as T);
    };

    const timer = window.setTimeout(() => {
      finish(new Error('The sheet took too long to respond. Try again.'));
    }, 25000);

    (window as unknown as Record<string, (data: T & { error?: string }) => void>)[cb] = (data) => {
      if (!data || data.error) finish(new Error(data?.error || 'Request failed'));
      else finish(null, data);
    };

    script.onerror = () => {
      finish(
        new Error(
          'Could not reach the sheet. Check the web app URL, and that the deployment is set to Anyone.',
        ),
      );
    };

    const params = new URLSearchParams({
      action,
      token: config.token.trim(),
      callback: cb,
      payload: JSON.stringify(payload ?? {}),
      _: String(Date.now()),
    });
    script.async = true;
    script.src = `${config.webAppUrl}?${params.toString()}`;
    document.head.appendChild(script);
  });
}

function asText(value: unknown) {
  return value == null ? '' : String(value).trim();
}

function asBool(value: unknown) {
  return value === true || value === 'true' || value === 'TRUE';
}

function asAmount(value: unknown) {
  if (typeof value === 'number') return value;
  const n = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function asBudget(value: unknown) {
  if (value === '' || value == null) return null;
  const n = asAmount(value);
  return Number.isFinite(n) ? n : null;
}

function asDate(value: unknown) {
  if (typeof value === 'number' && value > 20000 && value < 80000) {
    const ms = Date.UTC(1899, 11, 30) + Math.round(value) * 86400000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  const text = asText(value);
  const match = text.match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : text;
}

export function normalizeSnapshot(raw: Partial<Snapshot> | null | undefined): Snapshot {
  const events = Array.isArray(raw?.events) ? raw.events.map(normalizeEvent) : [];
  const categories = Array.isArray(raw?.categories) ? raw.categories.map(normalizeCategory) : [];
  const expenses = Array.isArray(raw?.expenses) ? raw.expenses.map(normalizeExpense) : [];
  return {
    spreadsheetName: asText(raw?.spreadsheetName) || 'Spreadsheet',
    spreadsheetUrl: asText(raw?.spreadsheetUrl),
    events: events.filter((event) => event.id && event.name),
    categories: categories.filter((category) => category.id && category.name),
    expenses: expenses.filter((expense) => expense.id && expense.title),
  };
}

function normalizeEvent(raw: SpendEvent | Raw): SpendEvent {
  const row = raw as Raw;
  return {
    id: asText(row.id),
    name: asText(row.name),
    note: asText(row.note),
    budget: asBudget(row.budget),
    createdAt: asText(row.createdAt),
    archived: asBool(row.archived),
  };
}

function normalizeCategory(raw: Category | Raw): Category {
  const row = raw as Raw;
  return {
    id: asText(row.id),
    name: asText(row.name),
    archived: asBool(row.archived),
  };
}

function normalizeExpense(raw: Expense | Raw): Expense {
  const row = raw as Raw;
  return {
    id: asText(row.id),
    eventId: asText(row.eventId),
    categoryId: asText(row.categoryId),
    title: asText(row.title),
    note: asText(row.note),
    amount: asAmount(row.amount),
    date: asDate(row.date),
    createdAt: asText(row.createdAt),
  };
}
