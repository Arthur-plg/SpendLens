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
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_RULES;
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
