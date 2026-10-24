export type TypeFilter = 'all' | 'debit' | 'credit';

export interface TransactionFilters {
  query: string;
  type: TypeFilter;
  category: string;
}

export const EMPTY_FILTERS: TransactionFilters = { query: '', type: 'all', category: 'all' };
