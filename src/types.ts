export type SpendEvent = {
  id: string;
  name: string;
  note: string;
  budget: number | null;
  createdAt: string;
  archived: boolean;
};

export type Category = {
  id: string;
  name: string;
  archived: boolean;
};

export type Expense = {
  id: string;
  eventId: string;
  categoryId: string;
  title: string;
  note: string;
  amount: number;
  date: string;
  createdAt: string;
};

export type Snapshot = {
  spreadsheetName: string;
  spreadsheetUrl: string;
  events: SpendEvent[];
  categories: Category[];
  expenses: Expense[];
};

export type SheetConfig = {
  webAppUrl: string;
  token: string;
};

export type Profile = {
  id: string;
  name: string;
  webAppUrl: string;
  token: string;
};

export type Period = 'all' | 'month' | '30d' | 'year' | 'custom';
