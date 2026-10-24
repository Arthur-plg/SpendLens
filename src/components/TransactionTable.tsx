import React, { useState, useMemo } from 'react';
import { Search, Filter, ArrowDownRight, ArrowUpRight, ArrowLeftRight, Sparkles, Sliders, ChevronDown } from 'lucide-react';
import type { Transaction, CategoryDefinition } from '../types';

interface TransactionTableProps {
  transactions: Transaction[];
  categories: CategoryDefinition[];
  excludeTransfers: boolean;
  onUpdateCategory: (txId: string, newCategoryId: string) => void;
  onCreateRuleFromTx: (tx: Transaction) => void;
  selectedMonthKey: string;
}

export const TransactionTable: React.FC<TransactionTableProps> = ({
  transactions,
  categories,
  excludeTransfers,
  onUpdateCategory,
  onCreateRuleFromTx,
  selectedMonthKey,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'all' | 'debit' | 'credit' | 'transfer'>('all');
  const [pageSize, setPageSize] = useState(50);

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      // Month filter
      if (selectedMonthKey !== 'all' && t.monthKey !== selectedMonthKey) {
        return false;
      }

      // Transfer exclusion
      if (excludeTransfers && t.isInternalTransfer && selectedTypeFilter !== 'transfer') {
        return false;
      }

      // Type filter
      if (selectedTypeFilter === 'debit' && t.type !== 'debit') return false;
      if (selectedTypeFilter === 'credit' && t.type !== 'credit') return false;
      if (selectedTypeFilter === 'transfer' && !t.isInternalTransfer) return false;

      // Category filter
      if (selectedCategoryFilter !== 'all' && t.category !== selectedCategoryFilter) {
        return false;
      }

      // Text search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesMerchant = t.cleanMerchant.toLowerCase().includes(query);
        const matchesRaw = t.rawLabel.toLowerCase().includes(query);
        const matchesAmount = t.absAmount.toString().includes(query);
        const catName = categories.find((c) => c.id === t.category)?.name.toLowerCase() || '';
        const matchesCategory = catName.includes(query);

        if (!matchesMerchant && !matchesRaw && !matchesAmount && !matchesCategory) {
          return false;
        }
      }

      return true;
    });
  }, [transactions, selectedMonthKey, excludeTransfers, selectedTypeFilter, selectedCategoryFilter, searchQuery, categories]);

  const pagedTransactions = filteredTransactions.slice(0, pageSize);

  const getCategoryDef = (catId: string) => {
    return categories.find((c) => c.id === catId) || {
      id: catId,
      name: catId,
      color: '#94a3b8',
      bgLight: 'rgba(148, 163, 184, 0.15)',
    };
  };

  const formatEuro = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="table-container-card">
      {/* Header bar: filters & search */}
      <div className="table-toolbar">
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Rechercher un commerçant, montant, libellé..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          {searchQuery && (
            <button className="search-clear-btn" onClick={() => setSearchQuery('')}>
              ×
            </button>
          )}
        </div>

        <div className="table-filter-group">
          {/* Type selector pills */}
          <div className="type-toggle-pills">
            <button
              className={`type-pill ${selectedTypeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedTypeFilter('all')}
            >
              Tous
            </button>
            <button
              className={`type-pill ${selectedTypeFilter === 'debit' ? 'active' : ''}`}
              onClick={() => setSelectedTypeFilter('debit')}
            >
              Dépenses
            </button>
            <button
              className={`type-pill ${selectedTypeFilter === 'credit' ? 'active' : ''}`}
              onClick={() => setSelectedTypeFilter('credit')}
            >
              Revenus
            </button>
            <button
              className={`type-pill ${selectedTypeFilter === 'transfer' ? 'active' : ''}`}
              onClick={() => setSelectedTypeFilter('transfer')}
            >
              Intercompte
            </button>
          </div>

          {/* Category Dropdown */}
          <div className="select-wrapper">
            <Filter size={14} className="select-icon" />
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="category-select"
            >
              <option value="all">Toutes les catégories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Info summary */}
      <div className="table-sub-header">
        <span className="tx-count-label">
          <strong>{filteredTransactions.length}</strong> opérations trouvées
        </span>
        {excludeTransfers && (
          <span className="transfer-neutralized-note">
            🛡️ Virements intercompte Arthur Pelong exclus de l'affichage
          </span>
        )}
      </div>

      {/* Table */}
      <div className="table-scroll-wrap">
        <table className="transactions-table">
          <thead>
            <tr>
              <th style={{ width: '110px' }}>Date</th>
              <th>Commerçant & Opération</th>
              <th style={{ width: '220px' }}>Catégorie</th>
              <th style={{ width: '130px', textAlign: 'right' }}>Montant</th>
              <th style={{ width: '80px', textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {pagedTransactions.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty-table-cell">
                  Aucune transaction ne correspond aux critères sélectionnés.
                </td>
              </tr>
            ) : (
              pagedTransactions.map((tx) => {
                const catDef = getCategoryDef(tx.category);
                const isDebit = tx.type === 'debit';

                return (
                  <tr key={tx.id} className={tx.isInternalTransfer ? 'transfer-row' : ''}>
                    {/* Date */}
                    <td className="tx-date-cell">{tx.rawDate}</td>

                    {/* Merchant & Raw label */}
                    <td className="tx-merchant-cell">
                      <div className="merchant-primary-wrap">
                        <span className="merchant-name">{tx.cleanMerchant}</span>
                        {tx.categorizationMethod === 'ai' && (
                          <span className="badge-ai" title="Catégorisé par Groq IA">
                            <Sparkles size={11} /> IA
                          </span>
                        )}
                        {tx.isInternalTransfer && (
                          <span className="badge-transfer" title="Virement intercompte">
                            <ArrowLeftRight size={11} /> Interne
                          </span>
                        )}
                      </div>
                      <div className="raw-label-preview" title={tx.rawLabel}>
                        {tx.rawLabel}
                      </div>
                    </td>

                    {/* Category pill with instant change select */}
                    <td className="tx-category-cell">
                      <div className="category-pill-wrap" style={{ backgroundColor: catDef.bgLight }}>
                        <div className="cat-dot" style={{ backgroundColor: catDef.color }} />
                        <select
                          value={tx.category}
                          onChange={(e) => onUpdateCategory(tx.id, e.target.value)}
                          className="inline-category-select"
                          style={{ color: catDef.color }}
                        >
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={12} className="cat-dropdown-arrow" style={{ color: catDef.color }} />
                      </div>
                    </td>

                    {/* Amount */}
                    <td className={`tx-amount-cell ${isDebit ? 'text-rose' : 'text-emerald'}`}>
                      <div className="amount-wrap">
                        {isDebit ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                        <span>{formatEuro(tx.amount)}</span>
                      </div>
                    </td>

                    {/* Action: Create Rule */}
                    <td className="tx-action-cell">
                      <button
                        className="btn-create-rule-icon"
                        title="Créer une règle automatique à partir de ce libellé"
                        onClick={() => onCreateRuleFromTx(tx)}
                      >
                        <Sliders size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Load More Button */}
      {pageSize < filteredTransactions.length && (
        <div className="load-more-wrap">
          <button
            className="btn btn-outline load-more-btn"
            onClick={() => setPageSize((prev) => prev + 50)}
          >
            Afficher plus d'opérations ({filteredTransactions.length - pageSize} restantes)
          </button>
        </div>
      )}
    </div>
  );
};
