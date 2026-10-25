import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Lock, Upload } from 'lucide-react';

import type { AccountInfo, Rule, Transaction } from './types';
import { applyOverrides, lineKey, matchText, normalize, recategorize, ruleMatcher } from './utils/rules';
import { DEFAULT_RULES, getCategory } from './utils/categories';
import { batchClassifyWithGroq } from './utils/groq';
import {
  clearCachedTransactions,
  getCachedTransactions,
  getInitialTheme,
  getOverrides,
  getStoredGroqKey,
  getStoredRules,
  saveOverrides,
  saveStoredGroqKey,
  saveStoredRules,
  saveTheme,
  saveTransactionsToCache,
} from './utils/storage';
import type { Theme } from './utils/storage';
import {
  averageBasis,
  averageMonth,
  categoryBreakdown,
  classificationStats,
  detectRecurring,
  largestExpenses,
  scopeFor,
  summarizeMonths,
} from './lib/analytics';
import type { Period, Reduction } from './lib/analytics';
import { count, dateLong, monthLong, plural } from './lib/format';
import { DEMO_ACCOUNT, buildDemo } from './lib/demo';

import { Header } from './components/Header';
import { VIEWS } from './lib/views';
import type { View } from './lib/views';
import { PeriodControl } from './components/PeriodControl';
import { CategorizationDrawer } from './components/CategorizationDrawer';
import { DropOverlay, Toast } from './components/overlays';
import type { ToastMessage } from './components/overlays';
import { EmptyState, Skeleton, ViewHead } from './components/ui';
import { Overview } from './views/Overview';
import { Transactions } from './views/Transactions';
import { EMPTY_FILTERS } from './lib/filters';
import type { TransactionFilters } from './lib/filters';
import { Trends } from './views/Trends';
import { Recurring } from './views/Recurring';
import { Simulator } from './views/Simulator';

type Status = 'loading' | 'ready' | 'empty';
/** Where the data on screen comes from: the fictional demo, or a statement the user imported. */
type Source = 'demo' | 'file';

const FORMAT_HELP =
  'Le fichier doit avoir les colonnes Date, Libellé et Débit/Crédit (ou Montant), comme l’export Excel du Crédit Agricole.';

class ReaderUnavailableError extends Error {}

function viewFromHash(): View | null {
  const id = window.location.hash.slice(1);
  return VIEWS.some((v) => v.id === id) ? (id as View) : null;
}

/** The month to open on: the latest complete one, so an unfinished month never reads as a deficit. */
function defaultPeriod(transactions: Transaction[]): Period {
  const months = summarizeMonths(transactions);
  return [...months].reverse().find((m) => !m.partial)?.key ?? months[months.length - 1]?.key ?? 'avg';
}

/** A rule that files every line of this merchant, as the user just did for one line. */
function ruleFor(tx: Transaction, categoryId: string): Rule {
  return {
    id: `rule_custom_${Date.now()}`,
    pattern: normalize(tx.extractedMerchant ?? tx.cleanMerchant).trim(),
    categoryId,
    targetMerchantName: tx.cleanMerchant,
    priority: 99,
    createdAt: new Date().toISOString(),
  };
}

export function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [source, setSource] = useState<Source>('demo');
  const [status, setStatus] = useState<Status>('loading');
  const [importing, setImporting] = useState(false);
  const [rules, setRules] = useState<Rule[]>(() => getStoredRules());
  const [apiKey, setApiKey] = useState(() => getStoredGroqKey());

  const [view, setView] = useState<View>(() => viewFromHash() ?? 'overview');
  const [period, setPeriod] = useState<Period>('avg');
  const [filters, setFilters] = useState<TransactionFilters>(EMPTY_FILTERS);
  const [reductions, setReductions] = useState<Record<string, Reduction>>({});

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isClassifying, setIsClassifying] = useState(false);
  const [aiStatus, setAiStatus] = useState('');
  const [aiError, setAiError] = useState<string | null>(null);

  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  // Hovering or focusing a toast keeps it open long enough to reach its action.
  const [toastHeld, setToastHeld] = useState(false);
  const [dragging, setDragging] = useState(false);

  const fileInput = useRef<HTMLInputElement>(null);
  const rulesRef = useRef(rules);
  // Latest transactions, for handlers that outlive their render (toast actions, async AI results).
  const txRef = useRef<Transaction[]>([]);
  const overridesRef = useRef(getOverrides());
  const loadSeq = useRef(0);

  /* ---------- Effects ---------- */

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    saveTheme(theme);
  }, [theme]);

  useEffect(() => {
    const label = VIEWS.find((v) => v.id === view)?.label ?? 'Synthèse';
    document.title = `${label} · SpendLens`;
  }, [view]);

  useEffect(() => {
    // Ignore hashes that are not views (e.g. the skip link's #main).
    const onHash = () => {
      const next = viewFromHash();
      if (next) setView(next);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (!toast || toastHeld) return;
    const id = window.setTimeout(() => setToast(null), toast.action ? 7000 : 4000);
    return () => window.clearTimeout(id);
  }, [toast, toastHeld]);

  useEffect(() => {
    txRef.current = transactions;
  }, [transactions]);

  // An imported statement (with its categories) survives reloads; the demo is never cached.
  useEffect(() => {
    if (status === 'ready' && source === 'file' && account) saveTransactionsToCache(transactions, account);
  }, [transactions, account, source, status]);

  /* ---------- Data loading ---------- */

  const adopt = useCallback((txs: Transaction[], info: AccountInfo, from: Source) => {
    setTransactions(txs);
    setAccount(info);
    setSource(from);
    setPeriod(defaultPeriod(txs));
    setFilters(EMPTY_FILTERS);
    setReductions({});
    setStatus('ready');
  }, []);

  // The xlsx parser is heavy: load it on demand so the shell paints first.
  const ingest = useCallback(
    async (buffer: ArrayBuffer, from: Source): Promise<Transaction[] | null> => {
      const seq = ++loadSeq.current;
      let parser: typeof import('./utils/parser');
      try {
        parser = await import('./utils/parser');
      } catch {
        // The reader is a lazy chunk: it fails when the server is gone or the app was updated meanwhile.
        throw new ReaderUnavailableError();
      }
      const { parseBankStatement } = parser;
      const result = parseBankStatement(buffer, rulesRef.current);
      // A newer load (another drop, the demo) wins.
      if (seq !== loadSeq.current) return null;
      if (result.transactions.length === 0) return [];
      const txs = applyOverrides(result.transactions, overridesRef.current);
      adopt(txs, result.accountInfo, from);
      return txs;
    },
    [adopt],
  );

  const loadDemo = () => {
    loadSeq.current += 1;
    adopt(applyOverrides(buildDemo(rulesRef.current), overridesRef.current), DEMO_ACCOUNT, 'demo');
  };

  useEffect(() => {
    const cached = getCachedTransactions();
    if (cached && cached.transactions.length > 0) {
      const txs = applyOverrides(recategorize(cached.transactions, rulesRef.current), overridesRef.current);
      adopt(txs, cached.accountInfo, 'file');
    } else {
      // No statement yet: show the first-run screen (import, or the fictional demo).
      setStatus('empty');
    }
  }, [adopt]);

  const loadFile = useCallback(
    (file: File) => {
      const hadData = status === 'ready' && source === 'file';
      const reader = new FileReader();
      setImporting(true);
      reader.onload = async () => {
        try {
          const txs = await ingest(reader.result as ArrayBuffer, 'file');
          if (txs === null) return;
          if (txs.length === 0) {
            setToast({ message: `Aucune opération reconnue. ${FORMAT_HELP}`, tone: 'error' });
            return;
          }
          const first = txs[txs.length - 1].date;
          const last = txs[0].date;
          setToast({
            message: `Relevé chargé : ${plural(txs.length, 'opération', 'opérations')}, du ${dateLong(first)} au ${dateLong(last)}.${hadData ? ' Il remplace le précédent.' : ''}`,
          });
        } catch (err) {
          setToast({
            message:
              err instanceof ReaderUnavailableError
                ? 'Le lecteur de fichiers n’a pas pu se charger. Rechargez la page, puis réessayez.'
                : `Fichier illisible. ${FORMAT_HELP}`,
            tone: 'error',
          });
        } finally {
          setImporting(false);
        }
      };
      reader.onerror = () => {
        setImporting(false);
        setToast({ message: 'Lecture du fichier impossible.', tone: 'error' });
      };
      reader.readAsArrayBuffer(file);
    },
    [ingest, status, source],
  );

  const onFilePicked = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
    e.target.value = '';
  };

  const forgetStatement = () => {
    clearCachedTransactions();
    overridesRef.current = {};
    saveOverrides({});
    loadSeq.current += 1;
    setTransactions([]);
    setAccount(null);
    setStatus('empty');
    setToast({ message: 'Relevé effacé de ce navigateur.' });
  };

  // Drop a statement anywhere on the page.
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes('Files') ?? false;
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth += 1;
      setDragging(true);
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const over = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      const file = e.dataTransfer?.files[0];
      if (file) loadFile(file);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
    };
  }, [loadFile]);

  /* ---------- Rules & categories ---------- */

  const applyRules = (next: Rule[]): Transaction[] => {
    rulesRef.current = next;
    setRules(next);
    saveStoredRules(next);
    const updated = recategorize(txRef.current, next);
    txRef.current = updated;
    setTransactions(updated);
    return updated;
  };

  const addRule = (rule: Rule) => {
    const updated = applyRules([rule, ...rulesRef.current.filter((r) => r.id !== rule.id)]);
    const n = updated.filter((t) => t.ruleMatched === rule.id).length;
    setToast({ message: `Règle ajoutée : ${plural(n, 'opération rangée', 'opérations rangées')} dans ${getCategory(rule.categoryId).name}.` });
  };

  const deleteRule = (id: string) => applyRules(rulesRef.current.filter((r) => r.id !== id));

  const resetRules = () => {
    applyRules(DEFAULT_RULES);
    setToast({ message: 'Vos règles ont été supprimées.' });
  };

  const changeCategory = (tx: Transaction, categoryId: string) => {
    overridesRef.current = { ...overridesRef.current, [lineKey(tx)]: categoryId };
    saveOverrides(overridesRef.current);
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === tx.id
          ? { ...t, category: categoryId, isInternalTransfer: categoryId === 'virement_interne', categorizationMethod: 'manual' as const }
          : t,
      ),
    );

    const merchant = tx.extractedMerchant ?? tx.cleanMerchant;
    // Only lines a rule can still move: manual and AI choices are never overwritten.
    const others = transactions.filter(
      (t) =>
        t.id !== tx.id &&
        (t.extractedMerchant ?? t.cleanMerchant) === merchant &&
        t.category !== categoryId &&
        t.categorizationMethod !== 'manual' &&
        t.categorizationMethod !== 'ai',
    ).length;
    setToast({
      message: `« ${tx.cleanMerchant} » rangé dans ${getCategory(categoryId).name}.`,
      action: others > 0 ? { label: `Appliquer aux ${others} autres`, onClick: () => addRule(ruleFor(tx, categoryId)) } : undefined,
    });
  };

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const saveApiKey = (key: string) => {
    setApiKey(key);
    saveStoredGroqKey(key);
  };

  const classifyWithAI = async () => {
    if (!apiKey) return;
    setIsClassifying(true);
    setAiError(null);
    setAiStatus('');
    try {
      const unclassifiedLines = transactions.filter((t) => t.category === 'autre').map((t) => ({ rawLabel: t.rawLabel, amount: t.absAmount }));
      const { results, generatedRules } = await batchClassifyWithGroq(apiKey, unclassifiedLines);
      const byLabel = new Map(results.map((r) => [r.rawLabel, r]));
      setTransactions((prev) =>
        prev.map((t) => {
          const match = t.category === 'autre' ? byLabel.get(t.rawLabel) : undefined;
          return match
            ? { ...t, category: match.category, cleanMerchant: match.cleanMerchant || t.cleanMerchant, categorizationMethod: 'ai' as const }
            : t;
        }),
      );
      // Keep only rules that would not move lines the user or the existing rules already filed elsewhere.
      const safe = generatedRules.filter((r) => {
        const test = ruleMatcher(r.pattern);
        return (
          test !== null &&
          transactions.every((t) => t.category === 'autre' || t.category === r.categoryId || !test(matchText(t.rawLabel, t.extractedMerchant ?? t.cleanMerchant)))
        );
      });
      if (safe.length > 0) {
        const next = [...safe, ...rulesRef.current];
        rulesRef.current = next;
        setRules(next);
        saveStoredRules(next);
      }
      setAiStatus(`${plural(results.length, 'libellé classé', 'libellés classés')}, ${plural(safe.length, 'règle créée', 'règles créées')}.`);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Groq n’a pas pu classer les libellés. Réessayez plus tard.');
    } finally {
      setIsClassifying(false);
    }
  };

  /* ---------- Navigation ---------- */

  const goTo = useCallback((next: View) => {
    if (window.location.hash !== `#${next}`) window.location.hash = next;
    setView(next);
    window.scrollTo({ top: 0 });
    // Move focus to the new page title so screen readers announce the change.
    requestAnimationFrame(() => document.querySelector<HTMLElement>('.view-head__title')?.focus({ preventScroll: true }));
  }, []);

  const openCategory = (categoryId: string) => {
    setFilters({ ...EMPTY_FILTERS, category: categoryId });
    goTo('transactions');
  };

  const selectMonth = (key: string) => {
    setPeriod(key);
    goTo('overview');
  };

  /* ---------- Derived data ---------- */

  const months = useMemo(() => summarizeMonths(transactions), [transactions]);
  const average = useMemo(() => averageMonth(months), [months]);
  const averageCount = averageBasis(months).length;
  const current = period === 'avg' ? average : (months.find((m) => m.key === period) ?? average);
  const scope = useMemo(() => scopeFor(transactions, months, period), [transactions, months, period]);
  const slices = useMemo(() => categoryBreakdown(scope.items, scope.divisor), [scope]);
  const largest = useMemo(() => largestExpenses(scope.items), [scope]);
  // The simulator always reasons on a typical month, never on a partial one.
  const averageSlices = useMemo(() => {
    const avg = scopeFor(transactions, months, 'avg');
    return categoryBreakdown(avg.items, avg.divisor);
  }, [transactions, months]);
  const recurring = useMemo(() => detectRecurring(transactions), [transactions]);
  const fixedMonthly = recurring.filter((c) => c.active).reduce((s, c) => s + c.monthly, 0);
  const stats = useMemo(() => classificationStats(transactions), [transactions]);
  const unclassified = useMemo(() => {
    const seen = new Set<string>();
    return stats.unclassified.filter((t) => {
      const key = normalize(t.cleanMerchant);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [stats.unclassified]);
  const periodItems = useMemo(
    () => (period === 'avg' ? transactions : transactions.filter((t) => t.monthKey === period)),
    [transactions, period],
  );

  const firstDate = transactions[transactions.length - 1]?.date;
  const lastDate = transactions[0]?.date;
  const sourceLabel = [
    source === 'demo' ? 'Données de démonstration' : null,
    account?.detectedBank && account.detectedBank !== 'Générique' ? account.detectedBank : null,
    account?.accountNumber ? `compte ···${account.accountNumber.slice(-4)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  /* ---------- Render ---------- */

  const renderView = () => {
    if (status === 'loading') {
      return (
        <div className="loading" role="status" aria-busy="true">
          <span className="sr-only">Chargement du relevé…</span>
          <div className="view-head">
            <div className="view-head__text">
              <Skeleton width={220} height={36} />
              <Skeleton width={320} height={14} />
            </div>
          </div>
          <div className="overview__top">
            <Skeleton height={380} round />
            <div className="loading__stack">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} height={48} />
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (status === 'empty' || months.length === 0) {
      return (
        <EmptyState
          variant="intro"
          title={
            <>
              Importez
              <br />
              <span className="accent">un relevé.</span>
            </>
          }
          actions={
            <>
              <button type="button" className="btn btn--primary" onClick={() => fileInput.current?.click()}>
                <Upload size={16} strokeWidth={1.75} aria-hidden="true" /> Importer un fichier
              </button>
              <button type="button" className="btn btn--outline" onClick={loadDemo}>
                Voir la démo
              </button>
            </>
          }
        >
          Importez l’export Excel de votre compte Crédit Agricole (ou un CSV avec Date, Libellé, Montant), ou glissez-le n’importe où sur la page.
          Il est lu dans ce navigateur et n’est envoyé nulle part.
        </EmptyState>
      );
    }

    switch (view) {
      case 'overview':
        return (
          <>
            <ViewHead
              title="Synthèse"
              meta={
                <>
                  {sourceLabel && <>{sourceLabel} · </>}
                  {plural(stats.total, 'opération', 'opérations')} du {dateLong(firstDate)} au {dateLong(lastDate)}
                </>
              }
              aside={<PeriodControl months={months} period={period} onChange={setPeriod} allLabel="Moyenne" allHint={plural(averageCount, 'mois', 'mois')} />}
            />
            <Overview
              period={period}
              months={months}
              current={current}
              average={average}
              averageCount={averageCount}
              slices={slices}
              largest={largest}
              fixedMonthly={fixedMonthly}
              firstDate={firstDate}
              lastDate={lastDate}
              onOpenCategory={openCategory}
              onOpenTransactions={() => {
                setFilters(EMPTY_FILTERS);
                goTo('transactions');
              }}
              onOpenFixed={() => goTo('recurring')}
            />
          </>
        );
      case 'transactions':
        return (
          <>
            <ViewHead
              title="Opérations"
              meta={period === 'avg' ? `Tout l’historique, du ${dateLong(firstDate)} au ${dateLong(lastDate)}` : monthLong(period)}
              aside={<PeriodControl months={months} period={period} onChange={setPeriod} allLabel="Tout l’historique" />}
            />
            <Transactions
              key={period}
              items={periodItems}
              filters={filters}
              onFiltersChange={setFilters}
              onCategoryChange={changeCategory}
              onSearchEverywhere={period === 'avg' ? undefined : () => setPeriod('avg')}
            />
          </>
        );
      case 'trends':
        return (
          <>
            <ViewHead
              title="Évolution"
              meta={`${plural(months.length, 'mois', 'mois')}, du ${dateLong(firstDate)} au ${dateLong(lastDate)} · moyennes sur ${plural(averageCount, 'mois complet', 'mois complets')}`}
            />
            <Trends months={months} average={average} averageCount={averageCount} period={period} onSelectMonth={selectMonth} />
          </>
        );
      case 'recurring':
        return (
          <>
            <ViewHead title="Charges fixes" meta="Abonnements et prélèvements qui reviennent chaque mois" />
            <Recurring charges={recurring} months={months} averageExpenses={average.expenses} />
          </>
        );
      case 'simulator':
        return (
          <>
            <ViewHead
              title="Simulateur"
              meta={`Réduisez un poste et voyez ce que vous mettriez de côté, sur la base d’un mois moyen (${plural(averageCount, 'mois complet', 'mois complets')}).`}
            />
            <Simulator slices={averageSlices} base={average} reductions={reductions} onChange={setReductions} />
          </>
        );
    }
  };

  return (
    <div className="app">
      <a
        className="skip"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main')?.focus();
        }}
      >
        Aller au contenu
      </a>
      <Header
        view={view}
        onViewChange={goTo}
        toClassify={status === 'ready' ? unclassified.length : null}
        onOpenCategorization={() => setDrawerOpen(true)}
        onImport={() => fileInput.current?.click()}
        importing={importing}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      />

      <main id="main" className="main" tabIndex={-1}>
        {renderView()}
      </main>

      <footer className="footer">
        <p>
          <Lock size={13} strokeWidth={1.75} aria-hidden="true" />
          <span>
            Analyse locale&nbsp;: vos relevés restent dans ce navigateur.
            {apiKey && ' Le classement par IA envoie les libellés non classés à Groq.'}
          </span>
        </p>
        {status === 'ready' && (
          <p className="footer__meta">
            <span className="num">
              {count(stats.total)} opérations · {plural(rules.length, 'règle', 'règles')}
            </span>
            {source === 'file' && (
              <button type="button" className="link-btn" onClick={forgetStatement}>
                Oublier ce relevé
              </button>
            )}
          </p>
        )}
      </footer>

      <input ref={fileInput} type="file" accept=".xlsx,.xls,.csv" onChange={onFilePicked} hidden />

      <CategorizationDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        transactions={transactions}
        stats={stats}
        unclassified={unclassified}
        rules={rules}
        onAddRule={addRule}
        onClassify={(tx, categoryId) => addRule(ruleFor(tx, categoryId))}
        onDeleteRule={deleteRule}
        onResetRules={resetRules}
        apiKey={apiKey}
        onSaveApiKey={saveApiKey}
        onClassifyWithAI={classifyWithAI}
        isClassifying={isClassifying}
        aiStatus={aiStatus}
        aiError={aiError}
      />

      <DropOverlay visible={dragging} />
      <Toast
        toast={toast}
        onHold={setToastHeld}
        onDismiss={() => {
          setToastHeld(false);
          setToast(null);
        }}
      />
    </div>
  );
}

export default App;
