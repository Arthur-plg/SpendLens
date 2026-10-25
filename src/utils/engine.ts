import type { Rule, Transaction, TransactionType } from '../types';
import { MERCHANTS } from './knowledge/merchants';

/**
 * Classification engine, in layers. Each layer only sees what the previous ones left:
 *   1. the user's own rules (and rules learnt from the AI);
 *   2. the structure of the bank line: internal transfer, cash withdrawal, bank fee, salary, transfer to a person;
 *   3. the merchant knowledge base, matched on whole words, longest phrase first ("uber one" beats "uber");
 *   4. the default: income for a credit, "autre" for a debit.
 * A last pass over the whole statement files stable monthly charges as subscriptions.
 */

export interface Classification {
  category: string;
  method: 'rule' | 'default';
  /** User rule id, or "kb:<phrase>" / "struct:<reason>" for built-in knowledge. */
  ruleId?: string;
  overrideMerchant?: string;
}

/* ---------- Text preparation ---------- */

/** Payment rails that prefix the real merchant: "ALP*Family Mart", "SumUp *Atrois", "PAYPAL *NETFLIX". */
const RAIL = /^(?:alp|alipay|weixin|wechat|wxp|wx|kpay|ant|mp|paypal|pp|sumup|sum up|sq|zettle|izettle|stripe|nyx|lyf|sp|tst|mollie|payplug|ccv|viva|dojo|hipay|adyen|google|apple pay|gpay)\s*\*\s*/i;

/** Lowercase, accent-free, punctuation as spaces; camelCase split ("OtherRetail" → "other retail"). */
export function tokens(text: string, splitCamel = true): string[] {
  const spaced = splitCamel ? text.replace(/([a-z])([A-Z])/g, '$1 $2') : text;
  return spaced
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

export type LineKind = 'card' | 'debit' | 'transfer_out' | 'transfer_in' | 'withdrawal' | 'fee' | 'other';

export interface PreparedLine {
  kind: LineKind;
  /** The merchant part only: card merchant without rail prefix, direct-debit creditor, transfer counterparty. */
  merchant: string;
  /** The bank's own display name when it adds one ("… - Carrefour City"). */
  display: string;
  /** The whole first line, for structural keywords. */
  head: string;
}

export function prepare(rawLabel: string): PreparedLine {
  const head = rawLabel.split('\n')[0].trim();
  const parts = head.split(/\s+-\s+/).map((p) => p.trim());
  const lower = head.toLowerCase();

  let kind: LineKind = 'other';
  // "Avoir - CARTE X9553 …" is a card refund: same merchant, money coming back.
  if (lower.startsWith('paiement par carte') || lower.startsWith('paiement mobile') || lower.startsWith('avoir')) kind = 'card';
  else if (lower.startsWith('prélèvement') || lower.startsWith('prelevement')) kind = 'debit';
  else if (lower.startsWith('virement émis') || lower.startsWith('virement emis') || lower.startsWith('vir sepa emis')) kind = 'transfer_out';
  else if (lower.startsWith('virement en votre faveur') || lower.startsWith('virement recu') || lower.startsWith('virement reçu')) kind = 'transfer_in';
  else if (lower.startsWith('retrait')) kind = 'withdrawal';
  else if (/^(cotisation|frais|commission|agios|interets debiteurs|intérêts débiteurs)/.test(lower)) kind = 'fee';

  let merchant = parts.slice(1).join(' ');
  let display = '';
  if (kind === 'card') {
    // "Paiement par carte - X9553 SumUp *ATROIS PARIS 13/10 - Atrois"
    const body = (parts[1] ?? '').replace(/^CARTE\s+/i, '').replace(/^X\d+\s+/i, '');
    merchant = body.replace(/\s+\d{2}\/\d{2}$/, '').replace(RAIL, '');
    display = parts.length >= 3 ? parts.slice(2).join(' ').replace(RAIL, '') : '';
  } else if (kind === 'debit') {
    merchant = parts[1] ?? '';
    display = parts.slice(2).join(' ');
  }
  return { kind, merchant: merchant.trim(), display: display.trim(), head };
}

/* ---------- Knowledge base index ---------- */

interface Entry {
  category: string;
  phrase: string;
  words: number;
}

let index: Map<string, Entry> | null = null;
let longest = 1;

function buildIndex(): Map<string, Entry> {
  const map = new Map<string, Entry>();
  for (const [category, phrases] of Object.entries(MERCHANTS)) {
    for (const raw of phrases) {
      const words = tokens(raw, false);
      if (words.length === 0) continue;
      const phrase = words.join(' ');
      if (!map.has(phrase)) map.set(phrase, { category, phrase, words: words.length });
      longest = Math.max(longest, words.length);
    }
  }
  return map;
}

/** Number of known phrases, for the UI ("1 800 commerçants reconnus"). */
export function knowledgeSize(): number {
  index ??= buildIndex();
  return index.size;
}

/** Best knowledge-base match in a word list: the longest phrase, then the earliest. */
function lookup(words: string[]): Entry | null {
  index ??= buildIndex();
  let best: Entry | null = null;
  for (let i = 0; i < words.length; i++) {
    for (let n = Math.min(longest, words.length - i); n >= 1; n--) {
      if (best && n <= best.words) break;
      const hit = index.get(words.slice(i, i + n).join(' '));
      if (hit) {
        best = hit;
        break;
      }
    }
  }
  return best;
}

function lookupText(text: string): Entry | null {
  if (!text) return null;
  // Truncated labels glue words ("FamilyMart") or split them ("Family Mart"): try both readings.
  return lookup(tokens(text)) ?? lookup(tokens(text, false));
}

/* ---------- Pinyin stems ---------- */

/**
 * Chinese merchants often appear as glued pinyin ("xianshiguidaojia" = Xi'an rail transit,
 * "hongshaoniuroumian" = braised beef noodles). These stems are searched inside words.
 */
const STEMS: [string, string][] = [
  ['guidao', 'transports'], ['gongjiao', 'transports'], ['ditie', 'transports'], ['jiaotong', 'transports'], ['chuzuche', 'transports'],
  ['jiayouzhan', 'transports'], ['tingche', 'transports'],
  ['canyin', 'restaurants'], ['canting', 'restaurants'], ['fandian', 'restaurants'], ['mianguan', 'restaurants'], ['niurou', 'restaurants'],
  ['mianshi', 'restaurants'], ['xiaochi', 'restaurants'], ['huoguo', 'restaurants'], ['shaokao', 'restaurants'], ['kafei', 'restaurants'],
  ['naicha', 'restaurants'], ['chaguan', 'restaurants'], ['jiaozi', 'restaurants'], ['baozi', 'restaurants'], ['malatang', 'restaurants'],
  ['chaoshi', 'alimentation'], ['bianli', 'alimentation'], ['shuiguo', 'alimentation'], ['shipin', 'alimentation'], ['caishichang', 'alimentation'],
  ['yaodian', 'sante'], ['yaofang', 'sante'], ['yiyuan', 'sante'], ['zhensuo', 'sante'],
  ['jiudian', 'voyages'], ['binguan', 'voyages'], ['kezhan', 'voyages'], ['luguan', 'voyages'],
  ['baihuo', 'shopping'], ['shangcheng', 'shopping'], ['youpin', 'shopping'], ['fuzhuang', 'shopping'],
  ['jianshen', 'loisirs'], ['dianying', 'loisirs'], ['yingcheng', 'loisirs'], ['bowuguan', 'loisirs'], ['meifa', 'loisirs'], ['anmo', 'loisirs'],
];

function lookupStem(text: string): string | null {
  for (const word of tokens(text, false)) {
    if (word.length < 8) continue;
    for (const [stem, category] of STEMS) if (word.includes(stem)) return category;
  }
  return null;
}

/* ---------- User rules ---------- */

/** Lowercase and strip accents: bank labels are uppercase ASCII ("CAFE"), people type "café". */
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/** Text a user rule is matched against: the full label plus the extracted merchant, accent-free. */
export function matchText(label: string, merchant: string): string {
  return normalize(`${label} ${merchant}`);
}

/** Builds the predicate for one user rule, or null if the rule is a broken regex. */
export function ruleMatcher(pattern: string, isRegex = false): ((text: string) => boolean) | null {
  if (isRegex) {
    try {
      // Strip accents but keep case: lowercasing would turn \S or \W into different escapes.
      const re = new RegExp(pattern.normalize('NFD').replace(/\p{Diacritic}/gu, ''), 'i');
      return (text) => re.test(text);
    } catch {
      return null;
    }
  }
  const needle = normalize(pattern.trim());
  return needle ? (text) => text.includes(needle) : null;
}

/* ---------- Structure of the line ---------- */

const INTERNAL = /virement interne|intercompte|compte a compte|vers livret|de livret|vers ldd|vers pel|vers cel|epargne mensuelle/i;
const SALARY = /salaire|\bpaie\b|remuneration|traitement|\bprime\b|indemnit|pole emploi|france travail|retraite|pension/i;
const PERSON = /\b(m|mme|mlle|mr|monsieur|madame|mademoiselle|m ou mme)\b\.?\s+[a-z]|wero|lydia|paylib|vir inst|vir sepa/i;
const COMPANY = /\b(sas|sarl|sa|eurl|sasu|sci|gie|ltd|gmbh|inc|llc)\b/i;

function structural(line: PreparedLine, type: TransactionType): Classification | null {
  const text = normalize(line.head);
  if (INTERNAL.test(text)) return { category: 'virement_interne', method: 'rule', ruleId: 'struct:internal' };
  if (line.kind === 'withdrawal') return { category: 'frais_bancaires', method: 'rule', ruleId: 'struct:withdrawal' };
  if (line.kind === 'fee') return { category: 'frais_bancaires', method: 'rule', ruleId: 'struct:fee' };
  if (type === 'credit' && SALARY.test(text)) return { category: 'revenus', method: 'rule', ruleId: 'struct:salary' };
  return null;
}

function isPersonTransfer(line: PreparedLine): boolean {
  const text = normalize(line.head);
  return PERSON.test(text) && !COMPANY.test(text);
}

/** Transfers that no merchant explains: money from an organisation is income, money sent to a non-company is for someone. */
function transferFallback(line: PreparedLine, type: TransactionType): Classification | null {
  if (line.kind !== 'transfer_out' && line.kind !== 'transfer_in') return null;
  if (type === 'credit') return { category: 'revenus', method: 'rule', ruleId: 'struct:incoming' };
  if (!COMPANY.test(normalize(line.head))) return { category: 'proches_amis', method: 'rule', ruleId: 'struct:transfer' };
  return null;
}

/* ---------- Public API ---------- */

export function classify(label: string, type: TransactionType, merchant: string, rules: Rule[]): Classification {
  // 1. The user's rules always win.
  const text = matchText(label, merchant);
  for (const rule of [...rules].sort((a, b) => (b.priority || 0) - (a.priority || 0))) {
    if (rule.categoryId === 'revenus' && type !== 'credit') continue;
    const test = ruleMatcher(rule.pattern, rule.isRegex) ?? ruleMatcher(rule.pattern, false);
    if (test?.(text)) return { category: rule.categoryId, method: 'rule', ruleId: rule.id, overrideMerchant: rule.targetMerchantName };
  }

  const line = prepare(label);

  // 2. What the line itself says.
  const fromStructure = structural(line, type);
  if (fromStructure) return fromStructure;

  // A transfer to or from a person is about that person, even if their name looks like a brand ("Paul").
  if ((line.kind === 'transfer_out' || line.kind === 'transfer_in') && isPersonTransfer(line)) {
    return { category: 'proches_amis', method: 'rule', ruleId: 'struct:person' };
  }

  // 3. Known merchants: the bank's display name, then the merchant text, then the whole line.
  const hit = lookupText(line.display) ?? lookupText(line.merchant) ?? lookupText(merchant) ?? lookupText(line.head);
  if (hit && !(hit.category === 'revenus' && type !== 'credit')) {
    return { category: hit.category, method: 'rule', ruleId: `kb:${hit.phrase}` };
  }

  // 4. Glued pinyin names from Alipay / WeChat Pay.
  const stem = lookupStem(`${line.merchant} ${line.display}`);
  if (stem) return { category: stem, method: 'rule', ruleId: 'kb:pinyin' };

  // 5. Transfers and defaults.
  return transferFallback(line, type) ?? (type === 'credit' ? { category: 'revenus', method: 'default' } : { category: 'autre', method: 'default' });
}

/* ---------- Statement-wide pass: subscriptions ---------- */

/** Categories a stable monthly charge can be re-filed from. Rent or savings keep their own. */
const SUBSCRIBABLE = new Set(['autre', 'shopping', 'loisirs', 'voyages', 'transports']);
/** Monthly transit passes are transport, not a subscription. */
const PASSES = /navigo|imagine r|pass|abonnement mensuel|forfait mensuel|ratp|transilien|tcl|tisseo|keolis|transdev/;

/** Smallest window, in days, holding every day-of-month (wrapping 31 → 1). */
function daySpread(days: number[]): number {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  if (sorted.length <= 1) return 0;
  let widestGap = sorted[0] + 31 - sorted[sorted.length - 1];
  for (let i = 1; i < sorted.length; i++) widestGap = Math.max(widestGap, sorted[i] - sorted[i - 1]);
  return 31 - widestGap;
}

/**
 * The same amount charged by the same payee in at least three different months, about once a month,
 * is a subscription, even when that payee also has ordinary purchases (Uber One next to Uber rides).
 */
export function flagSubscriptions(transactions: Transaction[], key: (t: Transaction) => string): Transaction[] {
  const groups = new Map<string, Transaction[]>();
  for (const t of transactions) {
    if (t.type !== 'debit' || t.isInternalTransfer || t.absAmount < 1) continue;
    if (t.categorizationMethod === 'manual' || t.categorizationMethod === 'ai') continue;
    if (!SUBSCRIBABLE.has(t.category)) continue;
    if (t.category === 'transports' && PASSES.test(normalize(t.rawLabel))) continue;
    const k = `${key(t)}|${t.absAmount.toFixed(2)}`;
    const list = groups.get(k);
    if (list) list.push(t);
    else groups.set(k, [t]);
  }

  const ids = new Set<string>();
  for (const list of groups.values()) {
    const months = new Set(list.map((t) => t.monthKey));
    if (months.size < 3 || list.length / months.size > 1.25) continue;
    // Billed around the same day each month; a fixed-price ticket bought on random days is not a subscription.
    if (daySpread(list.map((t) => Number(t.date.slice(8, 10)))) > 6) continue;
    for (const t of list) ids.add(t.id);
  }

  if (ids.size === 0) return transactions;
  return transactions.map((t) => (ids.has(t.id) ? { ...t, category: 'abonnements', categorizationMethod: 'rule' as const, ruleMatched: 'auto:recurring' } : t));
}
