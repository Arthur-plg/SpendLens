import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import type { MonthSummary, Period } from '../lib/analytics';
import { monthLong } from '../lib/format';

interface PeriodControlProps {
  months: MonthSummary[];
  period: Period;
  onChange: (period: Period) => void;
  /** Label of the "whole period" toggle: "Moyenne" on Synthèse, "Tout l’historique" on Opérations. */
  allLabel: string;
  allHint?: string;
}

/** Month stepper over a native select (keeps the OS picker on mobile), plus the whole-period toggle. */
export function PeriodControl({ months, period, onChange, allLabel, allHint }: PeriodControlProps) {
  const keys = months.map((m) => m.key);
  const index = keys.indexOf(period);
  const isAll = period === 'avg';
  const lastKey = keys[keys.length - 1];
  const lastFullKey = [...months].reverse().find((m) => !m.partial)?.key ?? lastKey;

  const step = (delta: number) => {
    const from = isAll ? keys.length : index;
    const next = keys[Math.min(keys.length - 1, Math.max(0, from + delta))];
    if (next) onChange(next);
  };

  const suffix = (m: MonthSummary) => (!m.partial ? '' : m.key === lastKey ? ' (en cours)' : ' (incomplet)');

  return (
    <div className="period" role="group" aria-label="Période analysée">
      <div className={`period__month ${isAll ? 'is-idle' : ''}`}>
        <button
          type="button"
          className="period__step"
          onClick={() => step(-1)}
          disabled={!isAll && index <= 0}
          aria-label="Mois précédent"
        >
          <ChevronLeft size={16} strokeWidth={1.75} />
        </button>
        <label className="period__select">
          <span className="sr-only">Mois</span>
          <select value={isAll ? '' : period} onChange={(e) => onChange(e.target.value)}>
            {isAll && <option value="">Choisir un mois</option>}
            {[...months].reverse().map((m) => (
              <option key={m.key} value={m.key}>
                {monthLong(m.key)}
                {suffix(m)}
              </option>
            ))}
          </select>
          <span className="period__label" aria-hidden="true">
            {isAll ? 'Choisir un mois' : monthLong(period)}
          </span>
          <ChevronDown size={14} strokeWidth={1.75} aria-hidden="true" />
        </label>
        <button
          type="button"
          className="period__step"
          onClick={() => (isAll ? onChange(lastKey) : step(1))}
          disabled={!isAll && index >= keys.length - 1}
          aria-label="Mois suivant"
        >
          <ChevronRight size={16} strokeWidth={1.75} />
        </button>
      </div>

      <button type="button" className="period__avg" aria-pressed={isAll} onClick={() => onChange(isAll ? lastFullKey : 'avg')}>
        {allLabel}
        {allHint && <span className="period__hint"> {allHint}</span>}
      </button>
    </div>
  );
}
