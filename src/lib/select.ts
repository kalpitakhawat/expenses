import type { Expense } from '../types';

export function sumAmounts(expenses: { amount: number }[]) {
  return expenses.reduce((total, expense) => total + expense.amount, 0);
}

export function byRecent(a: Expense, b: Expense) {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
  return a.title.localeCompare(b.title);
}

export function filterExpenses(
  expenses: Expense[],
  query: { eventId?: string; categoryId?: string; from?: string; to?: string; search?: string },
) {
  const search = query.search?.trim().toLowerCase();
  return expenses.filter((expense) => {
    if (query.eventId && expense.eventId !== query.eventId) return false;
    if (query.categoryId && expense.categoryId !== query.categoryId) return false;
    if (query.from && expense.date < query.from) return false;
    if (query.to && expense.date > query.to) return false;
    if (search && !`${expense.title} ${expense.note}`.toLowerCase().includes(search)) return false;
    return true;
  });
}

export function latestDate(expenses: Expense[]) {
  return expenses.reduce((max, expense) => (expense.date > max ? expense.date : max), '');
}
