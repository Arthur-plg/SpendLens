export type TransactionType = 'debit' | 'credit';

export interface Transaction {
  id: string;
  date: string; // ISO format YYYY-MM-DD
  rawDate: string; // e.g. 24/10/2026
  monthKey: string; // e.g. 2026-10
  monthLabel: string; // e.g. "Octobre 2026"
  rawLabel: string; // Original bank description
  extractedMerchant?: string; // Merchant name parsed from the label, before rule overrides
  cleanMerchant: string; // Cleaned merchant name
  amount: number; // Signed: negative for debit, positive for credit
  absAmount: number;
  type: TransactionType;
  isInternalTransfer: boolean;
  category: string;
  categorizationMethod: 'rule' | 'ai' | 'manual' | 'default';
  ruleMatched?: string;
  note?: string;
}

export interface CategoryDefinition {
  id: string;
  name: string;
  color: string;
  isIncome?: boolean;
  isTransfer?: boolean;
}

export interface Rule {
  id: string;
  pattern: string; // Case-insensitive keyword or regex
  isRegex?: boolean;
  categoryId: string;
  targetMerchantName?: string;
  priority: number; // Higher number = checked first
  createdAt: string;
}

export interface AccountInfo {
  holderName?: string;
  accountNumber?: string;
  balanceDate?: string;
  balanceAmount?: string;
  detectedBank: string;
}

export interface MonthlyStats {
  monthKey: string;
  monthLabel: string;
  totalExpenses: number;
  totalIncome: number;
  netSavings: number;
  savingsRate: number;
  transferTotal: number;
  transactionCount: number;
}
