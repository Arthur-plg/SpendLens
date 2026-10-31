import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { Transaction } from '../types';
import { dayLabel, euros, monthLong, monthShort, plural } from '../lib/format';
import { budgetMonthKey } from '../lib/analytics';
import { normalize } from '../utils/rules';
import { DEFAULT_CATEGORIES } from '../utils/categories';
import { CategorySelect, EmptyState, Segmented } from '../components/ui';
import { EMPTY_FILTERS } from '../lib/filters';
import type { TransactionFilters, TypeFilter } from '../lib/filters';

interface TransactionsProps {
  /** Every transaction of the period, internal transfers included. */
  items: Transaction[];
  filters: TransactionFilters;
  onFiltersChange: (filters: TransactionFilters) => void;
  onCategoryChange: (tx: Transaction, categoryId: string) => void;
  /** Offered when a search finds nothing in a single month. */
  onSearchEverywhere?: () => void;
}

const PAGE = 60;

const isInternal = (t: Transaction) => t.isInternalTransfer || t.category === 'virement_interne';

function matches(t: Transaction, f: TransactionFilters, query: string): boolean {
  if (f.type !== 'all' && (isInternal(t) || t.type !== f.type)) return false;
  if (f.category !== 'all' && t.category !== f.category) return false;
  if (!query) return true;
  return (
    normalize(t.cleanMerchant).includes(query) ||
    normalize(t.rawLabel).includes(query) ||
    t.absAmount.toFixed(2).replace('.', ',').includes(query.replace('.', ','))
  );
}

export function Transactions({ items, filters, onFiltersChange, onCategoryChange, onSearchEverywhere }: TransactionsProps) {
  const query = normalize(filters.query.trim());
  const filtered = useMemo(() => items.filter((t) => matches(t, filters, query)), [items, filters, query]);
  const total = useMemo(() => filtered.reduce((s, t) => s + (isInternal(t) ? 0 : t.amount), 0), [filtered]);

  // Pagination resets when the filters change, not when a category is edited.
  const resetKey = `${filters.query}|${filters.type}|${filters.category}`;
  const [page, setPage] = useState({ key: resetKey, limit: PAGE });
  const limit = page.key === resetKey ? page.limit : PAGE;

  const days = useMemo(() => {
    const groups: { date: string; items: Transaction[]; sum: number }[] = [];
    for (const t of filtered.slice(0, limit)) {
      const last = groups[groups.length - 1];
      const amount = isInternal(t) ? 0 : t.amount;
      if (last && last.date === t.date) {
        last.items.push(t);
        last.sum += amount;
      } else {
        groups.push({ date: t.date, items: [t], sum: amount });
      }
    }
    return groups;
  }, [filtered, limit]);

  const set = (patch: Partial<TransactionFilters>) => onFiltersChange({ ...filters, ...patch });
  const hasFilters = filters.query !== '' || filters.type !== 'all' || filters.category !== 'all';
  const clear = () => onFiltersChange(EMPTY_FILTERS);

  return (
    <div className="tx">
      <div className="tx__toolbar">
        <label className="search">
          <Search size={16} strokeWidth={1.75} aria-hidden="true" />
          <span className="sr-only">Rechercher une opération</span>
          <input
            type="search"
            value={filters.query}
            onChange={(e) => set({ query: e.target.value })}
            placeholder="Commerçant, libellé, montant…"
            autoComplete="off"
            spellCheck={false}
          />
          {filters.query && (
            <button type="button" className="search__clear" onClick={() => set({ query: '' })} aria-label="Effacer la recherche">
              <X size={14} strokeWidth={2} />
            </button>
          )}
        </label>

        <Segmented<TypeFilter>
          label="Type d’opération"
          value={filters.type}
          onChange={(type) => set({ type })}
          options={[
            { value: 'all', label: 'Tout' },
            { value: 'debit', label: 'Dépenses' },
            { value: 'credit', label: 'Revenus' },
          ]}
        />

        <label className="select">
          <span className="sr-only">Catégorie</span>
          <select value={filters.category} onChange={(e) => set({ category: e.target.value })}>
            <option value="all">Toutes catégories</option>
            {DEFAULT_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="tx__summary">
        <span>
          <strong className="num">{plural(filtered.length, 'opération', 'opérations')}</strong>
          <span className="faint"> · total </span>
          <span className="num">{euros(total, { sign: true })}</span>
        </span>
        {hasFilters && (
          <button type="button" className="link-btn" onClick={clear}>
            Effacer les filtres
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Aucun résultat"
          actions={
            <>
              {filters.query && onSearchEverywhere && (
                <button type="button" className="btn btn--primary" onClick={onSearchEverywhere}>
                  Chercher dans tout l’historique
                </button>
              )}
              {hasFilters && (
                <button type="button" className="btn btn--outline" onClick={clear}>
                  Effacer les filtres
                </button>
              )}
            </>
          }
        >
          {hasFilters ? 'Aucune opération ne correspond à ces filtres sur cette période.' : 'Aucune opération sur cette période.'}
        </EmptyState>
      ) : (
        <div className="ledger">
          {days.map((d) => (
            <section key={d.date} className="ledger__day" aria-label={dayLabel(d.date)}>
              <header className="ledger__date">
                <span className="eyebrow">{dayLabel(d.date)}</span>
                <span className="num faint">{euros(d.sum, { sign: true })}</span>
              </header>
              <ul>
                {d.items.map((t) => (
                  <li key={t.id} className="row">
                    <div className="row__main">
                      <span className="row__merchant">
                        <span className="row__name">{t.cleanMerchant}</span>
                        {t.categorizationMethod === 'ai' && (
                          <span className="tag" title="Catégorie proposée par l’IA">
                            IA
                          </span>
                        )}
                        {t.categorizationMethod === 'manual' && (
                          <span className="tag" title="Catégorie choisie à la main">
                            Manuel
                          </span>
                        )}
                        {isInternal(t) && (
                          <span className="tag" title="Virement entre vos comptes, exclu des calculs">
                            Interne
                          </span>
                        )}
                        {budgetMonthKey(t) !== t.monthKey && (
                          <span
                            className="tag tag--accent"
                            title={`Revenu perçu le ${t.rawDate || t.date} et rattaché au budget de ${monthLong(budgetMonthKey(t))}`}
                          >
                            Budget {monthShort(budgetMonthKey(t), false)}
                          </span>
                        )}
                      </span>
                      <span className="row__raw" title={t.rawLabel}>
                        {t.rawLabel.split('\n')[0]}
                      </span>
                    </div>
                    <div className="row__cat">
                      <CategorySelect value={t.category} onChange={(id) => onCategoryChange(t, id)} label={`Catégorie de ${t.cleanMerchant}`} />
                    </div>
                    <span className="row__amount num">{euros(t.amount, { sign: true })}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {limit < filtered.length && (
            <button type="button" className="btn btn--outline ledger__more" onClick={() => setPage({ key: resetKey, limit: limit + PAGE })}>
              Afficher {Math.min(PAGE, filtered.length - limit)} de plus
              <span className="ledger__more-count">· {filtered.length - limit} restantes</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
