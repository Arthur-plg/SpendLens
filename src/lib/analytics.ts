import type { Transaction } from '../types';
import { getCategory } from '../utils/categories';
import { payeeKey } from '../utils/rules';

/** 'avg' is the smoothed monthly average over complete months. */
export type Period = string | 'avg';

export interface MonthSummary {
  key: string;
  expenses: number;
  income: number;
  /** Money moved to savings or investments: kept, not spent. */
  invested: number;
  net: number;
  /** Savings rate in %, NaN when there is no income. */
  rate: number;
  count: number;
  /** Month only partly covered by the statement (first or last month). */
  partial: boolean;
}

export interface CategorySlice {
  id: string;
  name: string;
  color: string;
  amount: number;
  share: number;
  count: number;
  topMerchants: { name: string; amount: number }[];
}

export interface RecurringCharge {
  merchant: string;
  categoryId: string;
  monthly: number;
  occurrences: number;
  months: Set<string>;
  lastDate: string;
  stable: boolean;
  /** Still charged in the latest month of the statement (or the one before). */
  active: boolean;
}

/** Internal transfers move money between your own accounts: never spending or income. */
export function isReal(t: Transaction): boolean {
  return !t.isInternalTransfer && t.category !== 'virement_interne';
}

/** Spending categories in which an incoming payment can only be a refund (health reimbursement, travel credit…). */
const REFUNDABLE = new Set(['alimentation', 'restaurants', 'transports', 'voyages', 'shopping', 'logement', 'abonnements', 'loisirs', 'sante', 'impots', 'frais_bancaires']);

/**
 * How a real transaction affects the budget:
 * - a credit in a spending category is a refund of that spending; money received from people or salary is income;
 * - money moved to or from epargne is saving, never spending or income.
 */
function role(t: Transaction): 'income' | 'invested' | 'withdrawn' | 'spend' | 'refund' {
  if (t.category === 'epargne') return t.type === 'debit' ? 'invested' : 'withdrawn';
  if (t.type === 'credit') return REFUNDABLE.has(t.category) ? 'refund' : 'income';
  return 'spend';
}

const savingsRate = (income: number, net: number) => (income > 0 ? (net / income) * 100 : NaN);

function daysInMonth(key: string): number {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

export function summarizeMonths(transactions: Transaction[]): MonthSummary[] {
  const real = transactions.filter(isReal);
  if (real.length === 0) return [];

  const map = new Map<string, MonthSummary>();
  for (const t of real) {
    const m = map.get(t.monthKey) ?? { key: t.monthKey, expenses: 0, income: 0, invested: 0, net: 0, rate: NaN, count: 0, partial: false };
    const r = role(t);
    if (r === 'income') m.income += t.absAmount;
    else if (r === 'invested') m.invested += t.absAmount;
    else if (r === 'withdrawn') m.invested -= t.absAmount;
    else if (r === 'spend') m.expenses += t.absAmount;
    else m.expenses -= t.absAmount;
    m.count += 1;
    map.set(t.monthKey, m);
  }

  const dates = transactions.map((t) => t.date).sort();
  const first = dates[0];
  const last = dates[dates.length - 1];
  const months = [...map.values()].sort((a, b) => a.key.localeCompare(b.key));

  for (const m of months) {
    m.expenses = Math.max(0, m.expenses);
    m.net = m.income - m.expenses;
    m.rate = savingsRate(m.income, m.net);
    if (m.key === first.slice(0, 7) && Number(first.slice(8, 10)) > 3) m.partial = true;
    if (m.key === last.slice(0, 7) && Number(last.slice(8, 10)) < daysInMonth(m.key) - 3) m.partial = true;
  }
  return months;
}

/** Months used to compute averages: complete ones when we have any. */
export function averageBasis(months: MonthSummary[]): MonthSummary[] {
  const full = months.filter((m) => !m.partial);
  return full.length > 0 ? full : months;
}

export function averageMonth(months: MonthSummary[]): MonthSummary {
  const basis = averageBasis(months);
  const n = Math.max(1, basis.length);
  const expenses = basis.reduce((s, m) => s + m.expenses, 0) / n;
  const income = basis.reduce((s, m) => s + m.income, 0) / n;
  const invested = basis.reduce((s, m) => s + m.invested, 0) / n;
  const net = income - expenses;
  return {
    key: 'avg',
    expenses,
    income,
    invested,
    net,
    rate: savingsRate(income, net),
    count: Math.round(basis.reduce((s, m) => s + m.count, 0) / n),
    partial: false,
  };
}

/** Real transactions in scope for a period, plus the divisor that turns totals into monthly figures. */
export function scopeFor(transactions: Transaction[], months: MonthSummary[], period: Period) {
  const real = transactions.filter(isReal);
  if (period === 'avg') {
    const keys = new Set(averageBasis(months).map((m) => m.key));
    return { items: real.filter((t) => keys.has(t.monthKey)), divisor: Math.max(1, keys.size) };
  }
  return { items: real.filter((t) => t.monthKey === period), divisor: 1 };
}

export function categoryBreakdown(items: Transaction[], divisor: number): CategorySlice[] {
  const map = new Map<string, { total: number; count: number; merchants: Map<string, number> }>();
  for (const t of items) {
    const r = role(t);
    if (r !== 'spend' && r !== 'refund') continue;
    const entry = map.get(t.category) ?? { total: 0, count: 0, merchants: new Map() };
    if (r === 'spend') {
      entry.total += t.absAmount;
      entry.count += 1;
      const name = t.cleanMerchant || 'Commerçant inconnu';
      entry.merchants.set(name, (entry.merchants.get(name) ?? 0) + t.absAmount);
    } else {
      entry.total -= t.absAmount;
    }
    map.set(t.category, entry);
  }

  // Refunds can exceed a category's spending: such categories cost nothing this period.
  const kept = [...map.entries()].filter(([, e]) => e.total > 0.005 && e.count > 0);
  const total = kept.reduce((s, [, e]) => s + e.total, 0);
  return kept
    .map(([id, e]) => {
      const def = getCategory(id);
      return {
        id,
        name: def.name,
        color: def.color,
        amount: e.total / divisor,
        share: total > 0 ? (e.total / total) * 100 : 0,
        count: e.count,
        topMerchants: [...e.merchants.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([name, sum]) => ({ name, amount: sum / divisor })),
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

export function largestExpenses(items: Transaction[], limit = 5): Transaction[] {
  return items
    .filter((t) => role(t) === 'spend')
    .sort((a, b) => b.absAmount - a.absAmount)
    .slice(0, limit);
}

/** Categories where a repeated merchant is a habit, not a fixed charge. */
const HABIT_CATEGORIES = new Set(['alimentation', 'restaurants', 'transports', 'voyages', 'shopping', 'epargne', 'proches_amis']);
/** Categories where anything that repeats is by nature a fixed charge. */
const FIXED_CATEGORIES = new Set(['logement', 'abonnements', 'frais_bancaires']);

/**
 * A merchant is recurring when it is charged in at least 3 different months,
 * about once a month, for a stable amount (or belongs to a fixed-cost category).
 */
export function detectRecurring(transactions: Transaction[]): RecurringCharge[] {
  const groups = new Map<string, Transaction[]>();
  for (const t of transactions) {
    if (t.type !== 'debit' || !isReal(t) || HABIT_CATEGORIES.has(t.category)) continue;
    const key = payeeKey(t);
    const list = groups.get(key);
    if (list) list.push(t);
    else groups.set(key, [t]);
  }

  const monthIndex = (key: string) => {
    const [y, m] = key.split('-').map(Number);
    return y * 12 + m;
  };
  const endKey = transactions.reduce((k, t) => (t.monthKey > k ? t.monthKey : k), '');

  const result: RecurringCharge[] = [];
  for (const list of groups.values()) {
    const months = new Set(list.map((t) => t.monthKey));
    if (months.size < 3) continue;

    const amounts = list.map((t) => t.absAmount);
    const mean = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    const sd = Math.sqrt(amounts.reduce((s, a) => s + (a - mean) ** 2, 0) / amounts.length);
    const stable = mean > 0 && sd / mean <= 0.15 && list.length / months.size <= 1.3;
    const categoryId = list[0].category;
    if (!stable && !FIXED_CATEGORIES.has(categoryId)) continue;

    const sorted = [...list].sort((a, b) => b.date.localeCompare(a.date));
    result.push({
      merchant: sorted[0].cleanMerchant,
      categoryId,
      monthly: amounts.reduce((s, a) => s + a, 0) / months.size,
      occurrences: list.length,
      months,
      lastDate: sorted[0].date,
      stable,
      active: monthIndex(endKey) - monthIndex(sorted[0].monthKey) <= 1,
    });
  }
  return result.sort((a, b) => Number(b.active) - Number(a.active) || b.monthly - a.monthly);
}

export interface ClassificationStats {
  total: number;
  classified: number;
  rate: number;
  unclassified: Transaction[];
}

export function classificationStats(transactions: Transaction[]): ClassificationStats {
  const unclassified = transactions.filter((t) => t.category === 'autre');
  const total = transactions.length;
  const classified = total - unclassified.length;
  return { total, classified, rate: total > 0 ? (classified / total) * 100 : 0, unclassified };
}

/** Reduction levels offered by the simulator. */
export const REDUCTIONS = [0, 0.25, 0.5, 1] as const;
export type Reduction = (typeof REDUCTIONS)[number];

export function simulate(slices: CategorySlice[], reductions: Record<string, Reduction>, base: MonthSummary) {
  const saved = slices.reduce((s, c) => s + c.amount * (reductions[c.id] ?? 0), 0);
  const expenses = base.expenses - saved;
  const net = base.income - expenses;
  return { saved, expenses, net, rate: savingsRate(base.income, net) };
}
