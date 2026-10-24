import { RotateCcw } from 'lucide-react';
import type { CategorySlice, MonthSummary, Reduction } from '../lib/analytics';
import { REDUCTIONS, simulate } from '../lib/analytics';
import { euros, percent } from '../lib/format';
import { Money } from '../components/Money';
import { EmptyState, SectionHead, Segmented, SignalPanel, Swatch } from '../components/ui';

interface SimulatorProps {
  slices: CategorySlice[];
  base: MonthSummary;
  reductions: Record<string, Reduction>;
  onChange: (reductions: Record<string, Reduction>) => void;
}

const LABELS: Record<Reduction, string> = { 0: 'Garder', 0.25: '−25 %', 0.5: '−50 %', 1: 'Couper' };

const rateText = (rate: number) => (Number.isFinite(rate) && rate >= 0 ? percent(rate) : '—');

export function Simulator({ slices, base, reductions, onChange }: SimulatorProps) {
  const result = simulate(slices, reductions, base);
  const touched = Object.values(reductions).some((r) => r > 0);

  if (slices.length === 0) {
    return <EmptyState title="Rien à simuler">Aucune dépense sur les mois complets du relevé.</EmptyState>;
  }

  return (
    <div className="sim">
      <section className="sim__controls" aria-label="Postes de dépense">
        <SectionHead
          title="Dépenses d’un mois moyen"
          aside={
            touched && (
              <button type="button" className="link-btn" onClick={() => onChange({})}>
                <RotateCcw size={13} strokeWidth={1.75} aria-hidden="true" /> Tout remettre
              </button>
            )
          }
        />
        <ul className="sim__list">
          {slices.map((s) => {
            const r = reductions[s.id] ?? 0;
            return (
              <li key={s.id} className={`sim-row ${r > 0 ? 'is-cut' : ''}`}>
                <div className="sim-row__name">
                  <Swatch color={s.color} />
                  <span>{s.name}</span>
                </div>
                <div className="sim-row__amount num">
                  {r > 0 && (
                    <s className="faint">
                      <span className="sr-only">au lieu de </span>
                      {euros(s.amount, { decimals: false })}
                    </s>
                  )}
                  {euros(s.amount * (1 - r), { decimals: false })}
                </div>
                <Segmented<Reduction>
                  size="sm"
                  label={`Réduction pour ${s.name}`}
                  value={r}
                  onChange={(value) => onChange({ ...reductions, [s.id]: value })}
                  options={REDUCTIONS.map((v) => ({ value: v, label: LABELS[v] }))}
                />
              </li>
            );
          })}
        </ul>
      </section>

      <SignalPanel className="sim__result" label="Résultat de la simulation">
        <p className="signal__eyebrow">Économie par mois</p>
        <Money value={result.saved} sign size="display" className="hero__figure" />
        {touched ? (
          <dl className="sim__facts">
            <div>
              <dt>Sur 12 mois</dt>
              <dd className="num">{euros(result.saved * 12, { sign: true, decimals: false })}</dd>
            </div>
            <div>
              <dt>Bilan mensuel</dt>
              <dd className="num">
                {euros(base.net, { sign: true, decimals: false })} → <b>{euros(result.net, { sign: true, decimals: false })}</b>
              </dd>
            </div>
            <div>
              <dt>Taux d’épargne</dt>
              <dd className="num">
                {rateText(base.rate)} → <b>{rateText(result.rate)}</b>
              </dd>
            </div>
          </dl>
        ) : (
          <p className="sim__hint">Choisissez une réduction sur un poste pour voir ce que vous mettriez de côté.</p>
        )}
      </SignalPanel>
    </div>
  );
}
