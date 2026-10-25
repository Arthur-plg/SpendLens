import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Check, ChevronDown, Eye, EyeOff, LoaderCircle, Plus, Trash2 } from 'lucide-react';
import type { Rule, Transaction } from '../types';
import type { ClassificationStats } from '../lib/analytics';
import { count, euros, percent, plural } from '../lib/format';
import { DEFAULT_CATEGORIES, getCategory } from '../utils/categories';
import { matchText, ruleMatcher } from '../utils/rules';
import { knowledgeSize } from '../utils/engine';
import { Drawer } from './overlays';
import { CategoryLabel, CategorySelect } from './ui';
import { Bar } from './charts';

interface CategorizationDrawerProps {
  open: boolean;
  onClose: () => void;
  transactions: Transaction[];
  stats: ClassificationStats;
  /** One line per distinct merchant still without a category. */
  unclassified: Transaction[];
  rules: Rule[];
  onAddRule: (rule: Rule) => void;
  onClassify: (tx: Transaction, categoryId: string) => void;
  onDeleteRule: (id: string) => void;
  onResetRules: () => void;
  apiKey: string;
  onSaveApiKey: (key: string) => void;
  onClassifyWithAI: () => void;
  isClassifying: boolean;
  aiStatus: string;
  aiError: string | null;
}

/** "sncf|ratp|navigo" → "sncf · ratp · navigo +12": rules read as words, not syntax. */
function readableTerms(pattern: string): string {
  const terms = pattern
    .replace(/\\b/g, '')
    .replace(/\\(.)/g, '$1')
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);
  return terms.length > 4 ? `${terms.slice(0, 4).join(' · ')} +${terms.length - 4}` : terms.join(' · ');
}

export function CategorizationDrawer(props: CategorizationDrawerProps) {
  const { open, onClose, transactions, stats, unclassified, rules, onAddRule, onClassify, onDeleteRule, onResetRules } = props;

  const [pattern, setPattern] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [merchant, setMerchant] = useState('');
  const [ruleQuery, setRuleQuery] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const patternRef = useRef<HTMLInputElement>(null);

  const matcher = useMemo(() => ruleMatcher(pattern), [pattern]);
  const matchCount = useMemo(
    () => (matcher ? transactions.filter((t) => matcher(matchText(t.rawLabel, t.extractedMerchant ?? t.cleanMerchant))).length : 0),
    [matcher, transactions],
  );

  const visibleRules = useMemo(() => {
    const q = ruleQuery.trim().toLowerCase();
    if (!q) return rules;
    return rules.filter(
      (r) =>
        r.pattern.toLowerCase().includes(q) ||
        (r.targetMerchantName ?? '').toLowerCase().includes(q) ||
        getCategory(r.categoryId).name.toLowerCase().includes(q),
    );
  }, [rules, ruleQuery]);

  const canSubmit = pattern.trim() !== '' && categoryId !== '';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onAddRule({
      id: `rule_custom_${Date.now()}`,
      pattern: pattern.trim(),
      categoryId,
      targetMerchantName: merchant.trim() || undefined,
      priority: 99,
      createdAt: new Date().toISOString(),
    });
    setPattern('');
    setMerchant('');
    patternRef.current?.focus();
  };

  return (
    <Drawer open={open} onClose={onClose} title="Catégorisation">
      <section className="cz-score" aria-label="Taux de classement">
        <div className="cz-score__figure">
          <span className="pixel">{percent(stats.rate)}</span>
          <span className="muted">
            des opérations ont une catégorie
            <br />
            <span className="num">
              {count(stats.classified)} sur {count(stats.total)}
            </span>
          </span>
        </div>
        <Bar value={stats.rate} color="var(--accent)" />
      </section>

      <section className="cz-block" aria-label="À classer">
        <h3 className="cz-head eyebrow">À classer · {unclassified.length}</h3>
        {unclassified.length === 0 ? (
          <p className="cz-done">
            <Check size={15} strokeWidth={2} aria-hidden="true" /> Tout est classé.
          </p>
        ) : (
          <>
            <p className="cz-help">Choisissez une catégorie&nbsp;: toutes les opérations de ce commerçant suivront.</p>
            <ul className="cz-list">
              {unclassified.map((t) => (
                <li key={t.id} className="cz-item">
                  <span className="cz-item__text">
                    <span className="cz-item__merchant">{t.cleanMerchant}</span>
                    <span className="cz-item__raw" title={t.rawLabel}>
                      {t.rawLabel.split('\n')[0]}
                    </span>
                  </span>
                  <span className="cz-item__amount num">{euros(t.amount)}</span>
                  <CategorySelect value={t.category} placeholder="Choisir…" onChange={(id) => onClassify(t, id)} label={`Catégorie pour ${t.cleanMerchant}`} />
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <form className="cz-block cz-form" onSubmit={submit} aria-label="Nouvelle règle">
        <h3 className="cz-head eyebrow">Nouvelle règle</h3>
        <div className="field">
          <label htmlFor="rule-pattern">Si le libellé contient</label>
          <input
            id="rule-pattern"
            ref={patternRef}
            className="input"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="ex. uber, lidl, navigo"
            autoComplete="off"
            spellCheck={false}
            aria-describedby="rule-preview"
          />
          <p id="rule-preview" className="field__hint" aria-live="polite">
            {pattern.trim()
              ? `Correspond à ${plural(matchCount, 'opération', 'opérations')}.`
              : 'Un mot du libellé bancaire. Majuscules et accents ignorés.'}
          </p>
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="rule-cat">Ranger dans</label>
            <select id="rule-cat" className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="" disabled>
                Choisir une catégorie
              </option>
              {DEFAULT_CATEGORIES.filter((c) => c.id !== 'autre').map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="rule-name">
              Afficher sous le nom <span className="faint">(facultatif)</span>
            </label>
            <input id="rule-name" className="input" value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="ex. Uber" autoComplete="off" />
          </div>
        </div>
        <div className="cz-form__foot">
          <button type="submit" className="btn btn--primary btn--sm" aria-disabled={!canSubmit}>
            <Plus size={15} strokeWidth={2} aria-hidden="true" /> Ajouter la règle
          </button>
        </div>
      </form>

      <details className="cz-block cz-rules">
        <summary className="cz-head eyebrow">
          <span>Vos règles · {rules.length}</span>
          <ChevronDown size={14} strokeWidth={1.75} aria-hidden="true" />
        </summary>
        <input
          className="input input--sm"
          type="search"
          value={ruleQuery}
          onChange={(e) => setRuleQuery(e.target.value)}
          placeholder="Filtrer les règles"
          aria-label="Filtrer les règles"
        />
        <ul className="rules">
          {visibleRules.map((r) => (
            <li key={r.id} className="rule">
              <div className="rule__body">
                <span className="rule__pattern" title={r.pattern}>
                  {readableTerms(r.pattern)}
                </span>
                <span className="rule__meta">
                  <CategoryLabel id={r.categoryId} />
                  {r.targetMerchantName && <span className="faint">affiché «&nbsp;{r.targetMerchantName}&nbsp;»</span>}
                  {r.id.startsWith('rule_groq') && <span className="tag">IA</span>}
                </span>
              </div>
              <button
                type="button"
                className="icon-btn icon-btn--sm"
                onClick={() => onDeleteRule(r.id)}
                aria-label={`Supprimer la règle ${readableTerms(r.pattern)}`}
                title="Supprimer"
              >
                <Trash2 size={15} strokeWidth={1.75} />
              </button>
            </li>
          ))}
          {visibleRules.length === 0 && (
            <li className="cz-more">
              {rules.length === 0
                ? `Aucune règle pour l’instant. SpendLens reconnaît déjà ${count(knowledgeSize())} commerçants et enseignes ; ajoutez une règle pour ceux qu’il ne connaît pas.`
                : 'Aucune règle ne correspond.'}
            </li>
          )}
        </ul>
        <div aria-live="polite">
          <button
            type="button"
            className={`link-btn cz-reset ${confirmReset ? 'is-armed' : ''}`}
            onBlur={() => setConfirmReset(false)}
            onClick={() => {
              if (confirmReset) {
                onResetRules();
                setConfirmReset(false);
              } else {
                setConfirmReset(true);
              }
            }}
          >
            {confirmReset ? 'Confirmer\u00a0: supprimer toutes mes règles' : 'Supprimer toutes mes règles'}
          </button>
        </div>
      </details>

      <AiSection {...props} />
    </Drawer>
  );
}

function AiSection({ apiKey, onSaveApiKey, onClassifyWithAI, isClassifying, aiStatus, aiError, unclassified }: CategorizationDrawerProps) {
  const [key, setKey] = useState(apiKey);
  const [reveal, setReveal] = useState(false);
  const [saved, setSaved] = useState(false);
  const labels = unclassified.length;

  useEffect(() => {
    if (!saved) return;
    const id = window.setTimeout(() => setSaved(false), 2500);
    return () => window.clearTimeout(id);
  }, [saved]);

  const unchanged = key.trim() === apiKey;

  return (
    <section className="cz-block cz-ai" aria-label="Classement par IA">
      <h3 className="cz-head eyebrow">Classement par IA · facultatif</h3>
      <p className="cz-help">
        Envoie à Groq les libellés non classés, tels qu’écrits par la banque. Groq propose une catégorie et SpendLens en fait une règle locale&nbsp;:
        la fois suivante, plus besoin de l’IA.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (unchanged) return;
          onSaveApiKey(key.trim());
          setSaved(true);
        }}
      >
        <div className="field">
          <label htmlFor="groq-key">Clé API Groq</label>
          <div className="input-group">
            <input
              id="groq-key"
              className="input"
              type={reveal ? 'text' : 'password'}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="gsk_…"
              autoComplete="off"
              spellCheck={false}
              aria-describedby="groq-key-hint"
            />
            <button type="button" className="icon-btn" onClick={() => setReveal((r) => !r)} aria-label={reveal ? 'Masquer la clé' : 'Afficher la clé'}>
              {reveal ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}
            </button>
            <button type="submit" className="btn btn--outline btn--sm" aria-disabled={unchanged}>
              {saved && <Check size={14} strokeWidth={2} aria-hidden="true" />}
              {saved ? 'Enregistrée' : 'Enregistrer'}
            </button>
          </div>
          <p id="groq-key-hint" className="field__hint" role="status">
            {saved ? 'Clé enregistrée dans ce navigateur.' : 'Gardée uniquement dans ce navigateur. '}
            {!saved && (
              <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer">
                Obtenir une clé gratuite<span className="sr-only"> (nouvel onglet)</span> ↗
              </a>
            )}
          </p>
        </div>
      </form>

      <button
        type="button"
        className="btn btn--primary cz-ai__run"
        onClick={() => !isClassifying && onClassifyWithAI()}
        disabled={!apiKey || labels === 0}
        aria-disabled={isClassifying}
      >
        {isClassifying && <LoaderCircle size={16} strokeWidth={1.75} className="spin" aria-hidden="true" />}
        {isClassifying ? 'Classement en cours…' : labels === 0 ? 'Rien à classer' : `Classer ${plural(Math.min(labels, 25), 'libellé', 'libellés')}`}
      </button>
      <p className="field__hint" role="status">
        {aiError ? <span className="alert">{aiError}</span> : aiStatus}
      </p>
    </section>
  );
}
