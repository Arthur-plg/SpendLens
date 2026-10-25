import type { Rule, Transaction, TransactionType } from '../types';
import { classify, flagSubscriptions, normalize, prepare } from './engine';
import type { Classification } from './engine';

export { matchText, normalize, ruleMatcher } from './engine';

/** Dates, SEPA mandates and long reference numbers are not merchant names. */
const NOT_A_NAME = /\d{2}[-/]\d{2}[-/]\d{2,4}|mandat|\d{6,}/i;

const isName = (s: string | undefined): s is string => !!s && s.trim().length > 1 && !NOT_A_NAME.test(s) && !/^\d+$/.test(s.trim());

/**
 * Clean up French bank label to extract human readable merchant name
 */
export function extractCleanMerchant(rawLabel: string): string {
  if (!rawLabel) return 'Inconnu';
  // Crédit Agricole appends SEPA references on extra lines: only the first line names the merchant.
  const label = rawLabel.split('\n')[0].trim();
  const parts = label.split(/\s+-\s+/).map((p) => p.trim());

  // Direct debit: "Prélèvement - <CREDITOR> - <Display name> - <reference>".
  // Prefer the mixed-case display name ("Orange", "Basic-Fit"), else the creditor without its postcode.
  if (label.startsWith('Prélèvement -')) {
    const candidates = parts.slice(1).filter((p) => isName(p) && !/^(votre )?abonnement /i.test(p));
    const name = candidates.find((p) => /[a-z]/.test(p) && /[A-Z]/.test(p)) ?? candidates[0];
    if (name) return name.replace(/\s+\d{5}\b.*$/, '');
  }

  // Crédit Agricole suffix pattern: "Paiement par carte - X5912 CARREFOUR CITY PARIS 22/10 - Carrefour City" -> "Carrefour City"
  if (parts.length >= 3) {
    const lastPart = parts[parts.length - 1];
    if (isName(lastPart) && !lastPart.startsWith('Votre abonnement')) return lastPart;
  }

  // "Virement en votre faveur - remboursement cadeau Charles M. - …" -> "Virement de remboursement cadeau Charles M."
  if (label.startsWith('Virement en votre faveur -') && parts[1]) {
    const sub = parts[1].replace(/^DE\s+/i, '').replace(/^VIR INST de\s+/i, '').trim();
    return `Virement de ${sub}`;
  }

  // "Paiement par carte - X5912 <NOM> <VILLE> <DATE>", payment rail prefix removed ("ALP*", "SumUp *")
  const line = prepare(label);
  if (line.kind === 'fee' || line.kind === 'withdrawal') {
    const text = (parts[parts.length - 1] ?? label).toLowerCase();
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
  if (line.kind === 'card' && line.merchant.length > 2) return line.merchant;

  return label.length > 35 ? `${label.slice(0, 34)}…` : label;
}

/**
 * Classify one bank line: the user's rules, then the line's structure, then the merchant knowledge base.
 */
export function categorizeTransaction(label: string, type: TransactionType, cleanMerchant: string, rules: Rule[] = []): Classification {
  return classify(label, type, cleanMerchant, rules);
}

/**
 * Re-run the rule engine over already parsed transactions, keeping
 * manual and AI decisions intact.
 */
export function recategorize(transactions: Transaction[], rules: Rule[]): Transaction[] {
  const updated = transactions.map((t) => {
    if (t.categorizationMethod === 'manual' || t.categorizationMethod === 'ai') return t;
    const base = t.extractedMerchant ?? t.cleanMerchant;
    const result = categorizeTransaction(t.rawLabel, t.type, base, rules);
    return {
      ...t,
      category: t.isInternalTransfer ? 'virement_interne' : result.category,
      cleanMerchant: result.overrideMerchant ?? base,
      categorizationMethod: result.method,
      ruleMatched: result.ruleId,
    };
  });
  return flagSubscriptions(updated, payeeKey);
}

/** Groups lines from the same payee: direct debits by creditor (their display name varies), the rest by merchant. */
export function payeeKey(t: Pick<Transaction, 'rawLabel' | 'cleanMerchant'>): string {
  const first = t.rawLabel.split('\n')[0];
  if (first.startsWith('Prélèvement -')) {
    const creditor = first.split(/\s+-\s+/)[1];
    if (creditor) return `debit:${normalize(creditor.trim())}`;
  }
  return normalize(t.cleanMerchant.trim());
}

/** Stable identity of a bank line across re-imports (row order is not stable). */
export function lineKey(t: Pick<Transaction, 'date' | 'rawLabel' | 'amount'>): string {
  return `${t.date}|${t.rawLabel}|${t.amount}`;
}

/** Re-apply the user's manual category choices after a parse. */
export function applyOverrides(transactions: Transaction[], overrides: Record<string, string>): Transaction[] {
  if (Object.keys(overrides).length === 0) return transactions;
  return transactions.map((t) => {
    const categoryId = overrides[lineKey(t)];
    return categoryId
      ? { ...t, category: categoryId, isInternalTransfer: categoryId === 'virement_interne', categorizationMethod: 'manual' as const }
      : t;
  });
}
