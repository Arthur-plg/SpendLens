import * as XLSX from 'xlsx';
import type { Transaction, AccountInfo, Rule, TransactionType } from '../types';
import { DEFAULT_RULES } from './categories';

const MONTH_NAMES_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

/**
 * Clean up French bank label to extract human readable merchant name
 */
export function extractCleanMerchant(rawLabel: string): string {
  if (!rawLabel) return 'Inconnu';
  const label = rawLabel.trim();

  // Pattern 1: Crédit Agricole suffix pattern: "... - Clean Merchant Name"
  // e.g. "Paiement par carte - X5912 CARREFOUR CITY PARIS 22/10 - Carrefour City" -> "Carrefour City"
  // e.g. "Paiement par carte - X5912 MK MAIL SARL PARIS 22/10 - Victoris" -> "Victoris"
  const parts = label.split(/\s+-\s+/);
  if (parts.length >= 3) {
    const lastPart = parts[parts.length - 1].trim();
    // Verify it doesn't look like an arbitrary code or date
    if (lastPart.length > 1 && !/^\d+$/.test(lastPart) && !lastPart.startsWith('Votre abonnement')) {
      return lastPart;
    }
  }

  // Pattern 2: "Prélèvement - ORANGE SA-ORANGE - Orange - Votre abonnement mobile..." -> "Orange"
  if (label.startsWith('Prélèvement -')) {
    if (parts.length >= 3 && parts[2]) {
      return parts[2].trim();
    }
    if (parts.length >= 2 && parts[1]) {
      return parts[1].trim();
    }
  }

  // Pattern 3: "Virement en votre faveur - DE M. PELONG ARTHUR" -> "Virement de Arthur Pelong"
  if (label.includes('Virement') && (label.includes('PELONG ARTHUR') || label.includes('PELONG'))) {
    return 'Virement interne (Pelong Arthur)';
  }

  // Pattern 4: "Virement en votre faveur - remboursement cadeau Charles M. - ..." -> "Remboursement cadeau Charles M."
  if (label.startsWith('Virement en votre faveur -')) {
    if (parts.length >= 2 && parts[1]) {
      const sub = parts[1].replace(/^DE\s+/i, '').replace(/^VIR INST de\s+/i, '').trim();
      return `Virement: ${sub}`;
    }
  }

  // Pattern 5: "Paiement par carte - X5912 <NOM> <VILLE> <DATE>"
  const cardMatch = label.match(/Paiement par carte\s*-\s*X\d+\s+([A-Z0-9\s*.'-]+?)(?:\s+\d{2}\/\d{2}|$)/i);
  if (cardMatch && cardMatch[1]) {
    const rawMerchant = cardMatch[1].trim();
    if (rawMerchant.length > 2) {
      return rawMerchant;
    }
  }

  // Fallback: first 35 chars
  return label.length > 35 ? label.slice(0, 32) + '...' : label;
}

/**
 * Apply deterministic rules to a transaction
 */
export function categorizeTransaction(
  label: string,
  type: TransactionType,
  cleanMerchant: string,
  rules: Rule[] = DEFAULT_RULES
): { category: string; method: 'rule' | 'default'; ruleId?: string; overrideMerchant?: string } {
  const normalizedText = `${label} ${cleanMerchant}`.toLowerCase();

  // Sort rules by priority descending
  const sortedRules = [...rules].sort((a, b) => (b.priority || 0) - (a.priority || 0));

  for (const rule of sortedRules) {
    // Debits can never match revenus rules
    if (rule.categoryId === 'revenus' && type !== 'credit') {
      continue;
    }

    let matches = false;
    if (rule.isRegex) {
      try {
        const re = new RegExp(rule.pattern, 'i');
        matches = re.test(normalizedText);
      } catch {
        // Fallback to substring
        matches = normalizedText.includes(rule.pattern.toLowerCase());
      }
    } else {
      matches = normalizedText.includes(rule.pattern.toLowerCase());
    }

    if (matches) {
      return {
        category: rule.categoryId,
        method: 'rule',
        ruleId: rule.id,
        overrideMerchant: rule.targetMerchantName,
      };
    }
  }

  // Default fallbacks based on type
  if (type === 'credit') {
    return { category: 'revenus', method: 'default' };
  }
  return { category: 'autre', method: 'default' };
}

/**
 * Parse an Excel file (XLSX, XLS) or CSV buffer
 */
export function parseBankStatement(fileData: ArrayBuffer | Uint8Array): {
  transactions: Transaction[];
  accountInfo: AccountInfo;
} {
  const data = fileData instanceof ArrayBuffer ? new Uint8Array(fileData) : fileData;
  const workbook = XLSX.read(data, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  const accountInfo: AccountInfo = {
    detectedBank: 'Générique',
  };

  // 1. Inspect metadata header rows (Crédit Agricole has owner in row 3-4, balance in row 6-7)
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = Array.from(rows[i] || []).map((c) => (c != null ? String(c) : ''));
    const rowStr = row.join(' ');

    if (/M\.\s+PELONG ARTHUR|PELONG/i.test(rowStr)) {
      accountInfo.holderName = 'M. PELONG ARTHUR';
      accountInfo.detectedBank = 'Crédit Agricole';
    } else if (/M\.|Mme\./i.test(rowStr) && !accountInfo.holderName) {
      accountInfo.holderName = rowStr.trim();
    }

    if (/Compte.*n°\s*(\d+)/i.test(rowStr)) {
      const m = rowStr.match(/Compte.*n°\s*(\d+)/i);
      if (m) accountInfo.accountNumber = m[1];
    }

    if (/Solde au\s+(\d{2}\/\d{2}\/\d{4})/i.test(rowStr)) {
      const m = rowStr.match(/Solde au\s+(\d{2}\/\d{2}\/\d{4})/i);
      if (m) accountInfo.balanceDate = m[1];
      // Check next cell for amount
      const balCell = row.find((c) => typeof c === 'string' && c.includes('€'));
      if (balCell) accountInfo.balanceAmount = String(balCell).trim();
    }
  }

  // 2. Find table header row
  let headerRowIndex = -1;
  let colDate = -1;
  let colLabel = -1;
  let colDebit = -1;
  let colCredit = -1;
  let colAmount = -1;

  for (let i = 0; i < Math.min(25, rows.length); i++) {
    const row = Array.from(rows[i] || []).map((cell) => (cell != null ? String(cell).toLowerCase().trim() : ''));

    const dIdx = row.findIndex((c) => c === 'date' || (c && (c.includes('date op') || c.includes('date de'))));
    const lIdx = row.findIndex((c) => c === 'libellé' || c === 'libelle' || (c && (c.includes('opération') || c.includes('operation'))));
    const debIdx = row.findIndex((c) => c && (c.includes('débit') || c.includes('debit')));
    const credIdx = row.findIndex((c) => c && (c.includes('crédit') || c.includes('credit')));
    const amtIdx = row.findIndex((c) => c === 'montant' || (c && c.includes('montant')));

    if (dIdx !== -1 && lIdx !== -1 && (debIdx !== -1 || amtIdx !== -1)) {
      headerRowIndex = i;
      colDate = dIdx;
      colLabel = lIdx;
      colDebit = debIdx;
      colCredit = credIdx;
      colAmount = amtIdx;
      break;
    }
  }

  if (headerRowIndex === -1) {
    // Fallback: row 9 if Crédit Agricole standard
    headerRowIndex = 9;
    colDate = 0;
    colLabel = 1;
    colDebit = 2;
    colCredit = 3;
  }

  const transactions: Transaction[] = [];

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const rawDateVal = row[colDate];
    const rawLabelVal = row[colLabel];
    if (!rawDateVal || !rawLabelVal) continue;

    const rawLabel = String(rawLabelVal).trim();
    if (!rawLabel || rawLabel.toLowerCase().startsWith('solde au')) continue;

    // Date formatting
    let isoDate = '';
    let rawDate = '';
    let monthKey = '';
    let monthLabel = '';

    if (typeof rawDateVal === 'string') {
      rawDate = rawDateVal.trim();
      // Format DD/MM/YYYY
      const parts = rawDate.split(/[\/\-.]/);
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
        isoDate = `${year}-${month}-${day}`;
        monthKey = `${year}-${month}`;
        const mIdx = parseInt(month, 10) - 1;
        monthLabel = `${MONTH_NAMES_FR[mIdx] || month} ${year}`;
      }
    } else if (rawDateVal instanceof Date) {
      const y = rawDateVal.getFullYear();
      const m = String(rawDateVal.getMonth() + 1).padStart(2, '0');
      const d = String(rawDateVal.getDate()).padStart(2, '0');
      isoDate = `${y}-${m}-${d}`;
      rawDate = `${d}/${m}/${y}`;
      monthKey = `${y}-${m}`;
      monthLabel = `${MONTH_NAMES_FR[rawDateVal.getMonth()]} ${y}`;
    }

    if (!isoDate) continue;

    // Amount parsing
    let amount = 0;
    let type: TransactionType = 'debit';

    if (colDebit !== -1 && colCredit !== -1) {
      const debVal = row[colDebit];
      const credVal = row[colCredit];

      if (debVal !== undefined && debVal !== null && debVal !== '') {
        const parsed = typeof debVal === 'number' ? debVal : parseFloat(String(debVal).replace(/\s/g, '').replace(',', '.'));
        if (!isNaN(parsed) && parsed !== 0) {
          amount = -Math.abs(parsed);
          type = 'debit';
        }
      }
      if (credVal !== undefined && credVal !== null && credVal !== '') {
        const parsed = typeof credVal === 'number' ? credVal : parseFloat(String(credVal).replace(/\s/g, '').replace(',', '.'));
        if (!isNaN(parsed) && parsed !== 0) {
          amount = Math.abs(parsed);
          type = 'credit';
        }
      }
    } else if (colAmount !== -1) {
      const amtVal = row[colAmount];
      const parsed = typeof amtVal === 'number' ? amtVal : parseFloat(String(amtVal).replace(/\s/g, '').replace(',', '.'));
      if (!isNaN(parsed)) {
        amount = parsed;
        type = parsed >= 0 ? 'credit' : 'debit';
      }
    }

    if (amount === 0) continue;

    // Merchant and category
    let cleanMerchant = extractCleanMerchant(rawLabel);

    // Internal transfer detection (Arthur Pelong intercompte or standard internal patterns)
    const isInternalTransfer =
      /pelong\s+arthur/i.test(rawLabel) ||
      /intercompte|compte a compte|vers livret|de livret|remise chq/i.test(rawLabel);

    const catResult = categorizeTransaction(rawLabel, type, cleanMerchant);
    let finalCategory = catResult.category;

    if (isInternalTransfer) {
      finalCategory = 'virement_interne';
    }

    if (catResult.overrideMerchant) {
      cleanMerchant = catResult.overrideMerchant;
    }

    const id = `tx_${isoDate}_${Math.abs(amount).toFixed(2)}_${i}`;

    transactions.push({
      id,
      date: isoDate,
      rawDate,
      monthKey,
      monthLabel,
      rawLabel,
      cleanMerchant,
      amount,
      absAmount: Math.abs(amount),
      type,
      isInternalTransfer,
      category: finalCategory,
      categorizationMethod: catResult.method,
      ruleMatched: catResult.ruleId,
    });
  }

  // Sort by date descending
  transactions.sort((a, b) => b.date.localeCompare(a.date));

  return { transactions, accountInfo };
}
