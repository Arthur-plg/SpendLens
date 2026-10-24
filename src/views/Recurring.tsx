import type { MonthSummary, RecurringCharge } from '../lib/analytics';
import { dateLong, euros, monthLong, monthShort, percent, plural } from '../lib/format';
import { Money } from '../components/Money';
import { CategoryLabel, EmptyState, SectionHead, SignalPanel } from '../components/ui';

interface RecurringProps {
  charges: RecurringCharge[];
  months: MonthSummary[];
  averageExpenses: number;
}

function ChargeRow({ c, months }: { c: RecurringCharge; months: MonthSummary[] }) {
  const charged = months.filter((m) => c.months.has(m.key)).length;
  return (
    <li className={`rec ${c.active ? '' : 'is-stopped'}`}>
      <div className="rec__name">
        <span className="rec__merchant">
          {c.merchant}
          {!c.stable && (
            <span className="tag" title="Le montant change d’un mois à l’autre">
              Variable
            </span>
          )}
        </span>
        <CategoryLabel id={c.categoryId} />
      </div>
      <div
        className="presence"
        role="img"
        aria-label={`Prélevé ${charged} mois sur ${months.length}, de ${monthLong(months[0].key)} à ${monthLong(months[months.length - 1].key)}`}
      >
        {months.map((m) => (
          <span key={m.key} className={c.months.has(m.key) ? 'is-on' : ''} title={`${monthShort(m.key)} · ${c.months.has(m.key) ? 'prélevé' : 'aucun prélèvement'}`} />
        ))}
      </div>
      <div className="rec__amount">
        <span className="num">{euros(c.monthly)}</span>
        <span className="faint">/&nbsp;mois</span>
      </div>
      <div className="rec__last">
        {c.active ? 'Dernier prélèvement' : 'Arrêté depuis'}&nbsp;: <span className="num">{dateLong(c.lastDate)}</span>
      </div>
    </li>
  );
}

export function Recurring({ charges, months, averageExpenses }: RecurringProps) {
  const active = charges.filter((c) => c.active);
  const stopped = charges.filter((c) => !c.active);
  const total = active.reduce((s, c) => s + c.monthly, 0);

  if (charges.length === 0) {
    return (
      <EmptyState title="Aucune charge fixe repérée">
        Il faut au moins trois mois de relevés pour repérer un abonnement ou un prélèvement régulier.
      </EmptyState>
    );
  }

  return (
    <div className="recurring">
      <SignalPanel className="recurring__summary" label="Total des charges fixes">
        <p className="signal__eyebrow">Charges fixes en cours</p>
        <Money value={total} size="display" className="hero__figure" />
        <p className="hero__lede">
          par mois, soit {averageExpenses > 0 ? percent((total / averageExpenses) * 100) : '—'} d’un mois moyen de dépenses, réparties sur{' '}
          {plural(active.length, 'prélèvement actif', 'prélèvements actifs')}.
        </p>
      </SignalPanel>

      <section aria-label="Prélèvements en cours">
        <SectionHead title="En cours" aside={<span>Présence sur les {plural(months.length, 'mois', 'mois')}</span>} />
        <ul className="rec-list">
          {active.map((c) => (
            <ChargeRow key={c.merchant} c={c} months={months} />
          ))}
        </ul>
      </section>

      {stopped.length > 0 && (
        <section aria-label="Prélèvements arrêtés">
          <SectionHead title="Arrêtés" aside={<span>Exclus du total</span>} />
          <ul className="rec-list">
            {stopped.map((c) => (
              <ChargeRow key={c.merchant} c={c} months={months} />
            ))}
          </ul>
        </section>
      )}

      <p className="footnote">
        Repérage automatique&nbsp;: un même bénéficiaire prélevé au moins trois mois différents, environ une fois par mois et pour un montant
        stable. Logement, abonnements et frais bancaires sont retenus même si le montant varie. Un prélèvement absent depuis plus d’un mois
        est considéré comme arrêté.
      </p>
    </div>
  );
}
