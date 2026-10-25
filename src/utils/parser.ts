import * as XLSX from 'xlsx';
import type { Transaction, AccountInfo, Rule, TransactionType } from '../types';
import { DEFAULT_RULES } from './categories';
import { categorizeTransaction, extractCleanMerchant, payeeKey } from './rules';
import { flagSubscriptions } from './engine';

const MONTH_NAMES_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

/**
 * Parse an Excel file (XLSX, XLS) or CSV buffer
 */
export function parseBankStatement(fileData: ArrayBuffer | Uint8Array, rules: Rule[] = DEFAULT_RULES): {
  transactions: Transaction[];
  accountInfo: AccountInfo;
} {
  const bytes = fileData instanceof ArrayBuffer ? new Uint8Array(fileData) : fileData;
  // .xlsx is a zip (PK), .xls an OLE file; anything else is treated as CSV text.
  const binary = (bytes[0] === 0x50 && bytes[1] === 0x4b) || (bytes[0] === 0xd0 && bytes[1] === 0xcf);
  let workbook: XLSX.WorkBook;
  if (binary) {
    workbook = XLSX.read(bytes, { type: 'array', cellDates: true });
  } else {
    // French bank CSVs are UTF-8 or Windows-1252; raw keeps "05/10/2026" and "12,50" as written.
    let text: string;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      text = new TextDecoder('windows-1252').decode(bytes);
    }
    workbook = XLSX.read(text.replace(/^\uFEFF/, ''), { type: 'string', raw: true });
  }
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

    // Crédit Agricole exports name the holder in the header ("M. DUPONT JEAN").
    const holder = rowStr.match(/(?:M\.|Mme\.?|Mlle)\s+([A-Z][A-Z\s'-]+)/);
    if (holder && !accountInfo.holderName) {
      accountInfo.holderName = holder[0].replace(/\s+/g, ' ').trim();
      accountInfo.detectedBank = 'Crédit Agricole';
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
    const lIdx = row.findIndex(
      (c) => c === 'libellé' || c === 'libelle' || (!!c && !c.startsWith('date') && (c.includes('opération') || c.includes('operation'))),
    );
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

  // "M. DUPONT JEAN" -> /DUPONT\s+JEAN/i, used to spot transfers to the holder's other accounts.
  const holderWords = (accountInfo.holderName ?? '').replace(/^(M\.|Mme\.?|Mlle)\s+/i, '').split(/\s+/).filter(Boolean);
  const escaped = holderWords.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const holderPattern = escaped.length >= 2 ? new RegExp(escaped.join('\\s+'), 'i') : null;

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
    const extractedMerchant = extractCleanMerchant(rawLabel);
    let cleanMerchant = extractedMerchant;

    // Transfers between the holder's own accounts: the holder's name, or the bank's wording.
    const isInternalTransfer =
      (holderPattern?.test(rawLabel) ?? false) || /intercompte|compte a compte|vers livret|de livret/i.test(rawLabel);
    if (isInternalTransfer && /virement/i.test(rawLabel)) cleanMerchant = 'Virement interne';

    const catResult = categorizeTransaction(rawLabel, type, cleanMerchant, rules);
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
      extractedMerchant,
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

  return { transactions: flagSubscriptions(transactions, payeeKey), accountInfo };
}
