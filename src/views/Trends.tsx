import { useState } from 'react';
import type { MonthSummary, Period } from '../lib/analytics';
import { count, euros, monthLong, monthShort, percent } from '../lib/format';
import { SectionHead } from '../components/ui';

interface TrendsProps {
  months: MonthSummary[];
  average: MonthSummary;
  averageCount: number;
  period: Period;
  onSelectMonth: (key: string) => void;
}

/** Rounds the axis maximum up to a readable step (500, 1 000, 2 000…). */
function niceMax(value: number): number {
  const steps = [500, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 7500, 10000, 15000, 20000, 50000];
  return steps.find((s) => s >= value) ?? Math.ceil(value / 10000) * 10000;
}

const axisK = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

function compact(value: number): string {
  return value >= 1000 ? `${axisK.format(value / 1000)}\u00a0k€` : `${count(value)}\u00a0€`;
}

/** A negative or income-less savings rate means nothing to read: show a dash. */
const rateText = (m: MonthSummary) => (m.partial || !Number.isFinite(m.rate) || m.rate < 0 ? '—' : percent(m.rate));

export function Trends({ months, average, averageCount, period, onSelectMonth }: TrendsProps) {
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const max = niceMax(Math.max(...months.map((m) => Math.max(m.expenses, m.income)), 1));
  const ticks = [1, 0.75, 0.5, 0.25, 0];
  const lastKey = months[months.length - 1]?.key;
  const focusKey = hoverKey ?? (period === 'avg' ? lastKey : period);
  const focus = months.find((m) => m.key === focusKey) ?? months[months.length - 1];
  const partialLabel = (m: MonthSummary) => (m.key === lastKey ? 'En cours' : 'Incomplet');

  return (
    <div className="trends">
      <section className="chart-card" aria-label="Dépenses et revenus par mois">
        <div className="readout">
          <h2 className="readout__month">{monthLong(focus.key)}</h2>
          <span className="readout__vals">
            <span>
              <span className="key key--expense" aria-hidden="true" />
              Dépenses <b className="num">{euros(focus.expenses, { decimals: false })}</b>
            </span>
            <span>
              <span className="key key--income" aria-hidden="true" />
              Revenus <b className="num">{euros(focus.income, { decimals: false })}</b>
            </span>
            <span>
              Bilan <b className="num">{euros(focus.net, { decimals: false, sign: true })}</b>
            </span>
            {focus.partial && <span className="tag">{partialLabel(focus)}</span>}
          </span>
        </div>

        <div className="chart">
          <div className="chart__axis" aria-hidden="true">
            {ticks.map((t) => (
              <span key={t} style={{ bottom: `${t * 100}%` }}>
                {compact(max * t)}
              </span>
            ))}
          </div>
          <div className="chart__plot" onMouseLeave={() => setHoverKey(null)}>
            {ticks.map((t) => (
              <span key={t} className="chart__grid" style={{ bottom: `${t * 100}%` }} aria-hidden="true" />
            ))}
            {months.map((m, i) => {
              const prev = months[i - 1];
              const inc = (m.income / max) * 100;
              const prevInc = prev ? (prev.income / max) * 100 : inc;
              const selected = m.key === period;
              return (
                <button
                  key={m.key}
                  type="button"
                  className={`chart__col ${selected ? 'is-selected' : ''} ${m.partial ? 'is-partial' : ''}`}
                  onMouseEnter={() => setHoverKey(m.key)}
                  onFocus={() => setHoverKey(m.key)}
                  onBlur={() => setHoverKey(null)}
                  onClick={() => onSelectMonth(m.key)}
                  aria-label={`${monthLong(m.key)}${m.partial ? ` (${partialLabel(m).toLowerCase()})` : ''} : dépenses ${euros(m.expenses, { decimals: false })}, revenus ${euros(m.income, { decimals: false })}. Ouvrir la synthèse.`}
                >
                  <span className="chart__bar" style={{ height: `${(m.expenses / max) * 100}%` }} />
                  <span className="chart__step" style={{ bottom: `${inc}%` }} />
                  {i > 0 && (
                    <span className="chart__riser" style={{ bottom: `${Math.min(inc, prevInc)}%`, height: `${Math.abs(inc - prevInc)}%` }} />
                  )}
                  <span className="chart__label">{monthShort(m.key, false)}</span>
                </button>
              );
            })}
          </div>
        </div>
        <p className="chart-card__note">Hachuré : mois incomplet. Choisissez un mois pour ouvrir sa synthèse.</p>
      </section>

      <section aria-label="Mois par mois">
        <SectionHead title="Mois par mois" />
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Mois</th>
                <th scope="col" className="r">
                  Revenus
                </th>
                <th scope="col" className="r">
                  Dépenses
                </th>
                <th scope="col" className="r">
                  Bilan
                </th>
                <th scope="col" className="r hide-sm">
                  Taux d’épargne
                </th>
              </tr>
            </thead>
            <tbody>
              {[...months].reverse().map((m) => (
                <tr key={m.key} className={m.key === period ? 'is-selected' : ''} aria-current={m.key === period ? 'true' : undefined}>
                  <th scope="row">
                    <button type="button" className="table__link" onClick={() => onSelectMonth(m.key)}>
                      {monthLong(m.key)}
                    </button>
                    {m.partial && <span className="tag">{partialLabel(m)}</span>}
                  </th>
                  <td className="r num">{euros(m.income, { decimals: false })}</td>
                  <td className="r num">{euros(m.expenses, { decimals: false })}</td>
                  <td className="r num">{euros(m.net, { decimals: false, sign: true })}</td>
                  <td className="r num hide-sm">{rateText(m)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Mois moyen · {averageCount}&nbsp;mois</th>
                <td className="r num">{euros(average.income, { decimals: false })}</td>
                <td className="r num">{euros(average.expenses, { decimals: false })}</td>
                <td className="r num">{euros(average.net, { decimals: false, sign: true })}</td>
                <td className="r num hide-sm">{rateText(average)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}
