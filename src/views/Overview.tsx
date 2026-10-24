import { ArrowRight } from 'lucide-react';
import type { Transaction } from '../types';
import type { CategorySlice, MonthSummary, Period } from '../lib/analytics';
import { dateLong, dateShort, euros, monthLong, monthShort, percent, plural } from '../lib/format';
import { Money } from '../components/Money';
import { Bar, PIXEL_CELL, PIXEL_GAP, PixelBars } from '../components/charts';
import { CategoryLabel, SectionHead, SignalPanel, Swatch } from '../components/ui';

interface OverviewProps {
  period: Period;
  months: MonthSummary[];
  current: MonthSummary;
  average: MonthSummary;
  averageCount: number;
  slices: CategorySlice[];
  largest: Transaction[];
  fixedMonthly: number;
  firstDate: string;
  lastDate: string;
  onOpenCategory: (categoryId: string) => void;
  onOpenTransactions: () => void;
  onOpenFixed: () => void;
}

type MonthState = 'average' | 'current' | 'truncated' | 'complete';

function headline(state: MonthState, m: MonthSummary, average: MonthSummary, firstDate: string, lastDate: string): string {
  const invested = m.invested > 1 ? ` dont ${euros(m.invested, { decimals: false })} placés,` : '';

  if (state === 'average') {
    return `En moyenne, vous gagnez ${euros(m.income, { decimals: false })} et dépensez ${euros(m.expenses, { decimals: false })} par mois.`;
  }
  if (state === 'truncated') {
    return `Le relevé commence le ${dateLong(firstDate)} : ce mois est incomplet.`;
  }
  if (state === 'current') {
    return m.net >= 0
      ? `Au ${dateShort(lastDate)}, il vous reste ${euros(m.net, { decimals: false })} sur vos revenus du mois. Le mois n’est pas terminé.`
      : `Au ${dateShort(lastDate)}, vous avez dépensé ${euros(-m.net, { decimals: false })} de plus que vos revenus. Le mois n’est pas terminé.`;
  }
  if (m.income === 0) return 'Aucun revenu enregistré ce mois-ci.';
  if (m.net >= 0) {
    return `Vous avez mis de côté ${euros(m.net, { decimals: false })},${invested} soit ${percent(m.rate)} de vos revenus.`;
  }
  const vsAvg = average.expenses > 0 ? (m.expenses / average.expenses - 1) * 100 : 0;
  const trend = Math.abs(vsAvg) >= 5 ? ` C’est ${percent(Math.abs(vsAvg))} ${vsAvg > 0 ? 'au-dessus' : 'en dessous'} d’un mois moyen.` : '';
  return `Vous avez dépensé ${euros(-m.net, { decimals: false })} de plus que vos revenus.${trend}`;
}

/** Change against the average month, written out rather than colour-coded. */
function versusAverage(value: number, base: number): string {
  if (base === 0) return '';
  const pct = ((value - base) / Math.abs(base)) * 100;
  if (Math.abs(pct) < 1) return 'Comme un mois moyen';
  return `${percent(pct, { sign: true })} vs un mois moyen`;
}

export function Overview(props: OverviewProps) {
  const { period, months, current, average, averageCount, slices, largest, fixedMonthly, firstDate, lastDate } = props;
  const isAvg = period === 'avg';
  const activeIndex = isAvg ? -1 : months.findIndex((m) => m.key === period);
  const state: MonthState = isAvg
    ? 'average'
    : !current.partial
      ? 'complete'
      : activeIndex === months.length - 1
        ? 'current'
        : 'truncated';
  const topAmount = Math.max(slices[0]?.amount ?? 0, 1);

  const eyebrow =
    state === 'average'
      ? `Dépensé par mois en moyenne · ${plural(averageCount, 'mois complet', 'mois complets')}`
      : state === 'current'
        ? `Dépensé en ${monthLong(period).toLowerCase()} · au ${dateShort(lastDate)}`
        : `Dépensé en ${monthLong(period).toLowerCase()}`;

  const sub = state === 'current' ? 'Mois en cours' : state === 'truncated' ? 'Relevé incomplet' : null;
  const rateShown = !sub && Number.isFinite(current.rate) && current.rate >= 0;

  return (
    <div className="overview">
      <div className="overview__top">
        <SignalPanel className="hero" label="Dépenses de la période">
          <p className="signal__eyebrow">{eyebrow}</p>
          <Money value={current.expenses} size="display" className="hero__figure" />
          <p className="hero__lede">{headline(state, current, average, firstDate, lastDate)}</p>
          <div className="hero__foot">
            <PixelBars
              values={months.map((m) => m.expenses)}
              activeIndex={activeIndex}
              label={`Dépenses mois par mois, de ${monthLong(months[0].key)} à ${monthLong(months[months.length - 1].key)}`}
            />
            <div className="hero__scale" style={{ width: months.length * (PIXEL_CELL + PIXEL_GAP) - PIXEL_GAP }} aria-hidden="true">
              <span>{monthShort(months[0].key)}</span>
              <span>{monthShort(months[months.length - 1].key)}</span>
            </div>
          </div>
        </SignalPanel>

        <dl className="kpis">
          <div className="kpi">
            <dt className="eyebrow">Revenus</dt>
            <dd>
              <Money value={current.income} size="lg" />
              <span className="kpi__note">{isAvg ? 'par mois' : (sub ?? versusAverage(current.income, average.income))}</span>
            </dd>
          </div>
          <div className="kpi">
            <dt className="eyebrow">Bilan</dt>
            <dd>
              <Money value={current.net} sign size="lg" />
              <span className="kpi__note">Revenus − dépenses</span>
            </dd>
          </div>
          <div className="kpi">
            <dt className="eyebrow">Taux d’épargne</dt>
            <dd>
              <span className="kpi__figure num">{rateShown ? percent(current.rate) : '—'}</span>
              <span className="kpi__note">
                {sub ?? (rateShown ? (isAvg ? 'du revenu mis de côté' : `Moyenne ${percent(average.rate)}`) : 'Dépenses > revenus')}
              </span>
            </dd>
          </div>
          <div className="kpi">
            <dt className="eyebrow">Charges fixes</dt>
            <dd>
              <button type="button" className="kpi__link" onClick={props.onOpenFixed}>
                <Money value={fixedMonthly} size="lg" />
                <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
                <span className="sr-only">Voir les charges fixes</span>
              </button>
              <span className="kpi__note">
                par mois · {average.expenses > 0 ? percent((fixedMonthly / average.expenses) * 100) : '—'} d’un mois moyen
              </span>
            </dd>
          </div>
        </dl>
      </div>

      <div className="overview__split">
        <section className="breakdown" aria-label="Répartition des dépenses">
          <SectionHead title="Où part l’argent" aside={<span className="num">{plural(slices.length, 'catégorie', 'catégories')}</span>} />
          <ul className="cat-table">
            {slices.map((s) => (
              <li key={s.id}>
                <button type="button" className="cat-row" onClick={() => props.onOpenCategory(s.id)}>
                  <span className="cat-row__name">
                    <span className="cat-row__title">
                      <Swatch color={s.color} />
                      {s.name}
                    </span>
                    <span className="cat-row__sub">
                      {plural(s.count, 'opération', 'opérations')}
                      {s.topMerchants.length > 0 && ` · ${s.topMerchants.map((m) => m.name).join(', ')}`}
                    </span>
                  </span>
                  <span className="cat-row__share">
                    <Bar value={(s.amount / topAmount) * 100} color={s.color} />
                    <span className="num">{percent(s.share)}</span>
                  </span>
                  <span className="cat-row__amount num">{euros(s.amount)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="largest" aria-label="Plus grosses dépenses">
          <SectionHead title="Plus grosses dépenses" />
          <ul className="largest__list">
            {largest.map((t) => (
              <li key={t.id} className="largest__item">
                <span className="largest__date num">{dateShort(t.date)}</span>
                <span className="largest__body">
                  <span className="largest__merchant">{t.cleanMerchant}</span>
                  <CategoryLabel id={t.category} />
                </span>
                <span className="largest__amount num">{euros(t.amount)}</span>
              </li>
            ))}
          </ul>
          <button type="button" className="link-btn" onClick={props.onOpenTransactions}>
            Toutes les opérations <ArrowRight size={14} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </section>
      </div>
    </div>
  );
}
