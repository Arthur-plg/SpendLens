import type { Rule, Transaction, AccountInfo } from '../types';
import { DEFAULT_RULES } from './categories';

const STORAGE_KEYS = {
  RULES: 'spendlens_rules_v1',
  GROQ_KEY: 'spendlens_groq_api_key',
  SAVED_TX: 'spendlens_transactions_cache',
  ACCOUNT_INFO: 'spendlens_account_info',
  EXCLUDE_TRANSFERS: 'spendlens_exclude_transfers',
};

export function getStoredRules(): Rule[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.RULES);
    if (!raw) return DEFAULT_RULES;
    const parsed: Rule[] = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_RULES;
    // Built-in rules always use their current definition (they cannot be edited in the UI);
    // custom and AI rules are kept as saved, and built-ins added since are appended.
    const builtIn = new Map(DEFAULT_RULES.map((d) => [d.id, d]));
    const merged = parsed.map((r) => builtIn.get(r.id) ?? r);
    const known = new Set(parsed.map((r) => r.id));
    for (const id of ['rule_food_delivery', 'rule_sante_remboursements']) {
      const rule = builtIn.get(id);
      if (rule && !known.has(id)) merged.push(rule);
    }
    return merged;
  } catch {
    return DEFAULT_RULES;
  }
}

export function saveStoredRules(rules: Rule[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.RULES, JSON.stringify(rules));
  } catch (e) {
    console.error('Failed to save rules to localStorage', e);
  }
}

export function getStoredGroqKey(): string {
  try {
    return localStorage.getItem(STORAGE_KEYS.GROQ_KEY) || '';
  } catch {
    return '';
  }
}

export function saveStoredGroqKey(key: string) {
  try {
    localStorage.setItem(STORAGE_KEYS.GROQ_KEY, key.trim());
  } catch (e) {
    console.error('Failed to save Groq key', e);
  }
}

export function getStoredExcludeTransfers(): boolean {
  try {
    const val = localStorage.getItem(STORAGE_KEYS.EXCLUDE_TRANSFERS);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

export function saveStoredExcludeTransfers(val: boolean) {
  try {
    localStorage.setItem(STORAGE_KEYS.EXCLUDE_TRANSFERS, String(val));
  } catch (e) {
    console.error('Failed to save exclude transfers preference', e);
  }
}

export function getCachedTransactions(): { transactions: Transaction[]; accountInfo: AccountInfo } | null {
  try {
    const rawTx = localStorage.getItem(STORAGE_KEYS.SAVED_TX);
    const rawAcc = localStorage.getItem(STORAGE_KEYS.ACCOUNT_INFO);
    if (!rawTx) return null;
    return {
      transactions: JSON.parse(rawTx),
      accountInfo: rawAcc ? JSON.parse(rawAcc) : { detectedBank: 'Générique' },
    };
  } catch {
    return null;
  }
}

export function saveTransactionsToCache(transactions: Transaction[], accountInfo: AccountInfo) {
  try {
    localStorage.setItem(STORAGE_KEYS.SAVED_TX, JSON.stringify(transactions));
    localStorage.setItem(STORAGE_KEYS.ACCOUNT_INFO, JSON.stringify(accountInfo));
  } catch (e) {
    console.error('Failed to cache transactions', e);
  }
}

export type Theme = 'light' | 'dark';
const THEME_KEY = 'spendlens_theme';

export function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // Storage can be unavailable (private mode); fall through to the OS preference.
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function saveTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Non-critical preference.
  }
}

const OVERRIDES_KEY = 'spendlens_overrides_v1';

/** Manual category choices, keyed by lineKey(), so they survive reloads and re-imports. */
export function getOverrides(): Record<string, string> {
  try {
    const raw = localStorage.getItem(OVERRIDES_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveOverrides(overrides: Record<string, string>) {
  try {
    localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides));
  } catch (e) {
    console.error('Failed to save category overrides', e);
  }
}

export function clearCachedTransactions() {
  try {
    localStorage.removeItem(STORAGE_KEYS.SAVED_TX);
    localStorage.removeItem(STORAGE_KEYS.ACCOUNT_INFO);
  } catch {
    // Nothing to clear.
  }
}
