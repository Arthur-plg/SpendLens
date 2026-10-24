import React from 'react';
import { Calendar } from 'lucide-react';

export interface MonthOption {
  key: string;
  label: string;
  expenseTotal: number;
  count: number;
}

interface MonthSelectorProps {
  months: MonthOption[];
  selectedMonthKey: string;
  onSelectMonth: (monthKey: string) => void;
}

export const MonthSelector: React.FC<MonthSelectorProps> = ({
  months,
  selectedMonthKey,
  onSelectMonth,
}) => {
  const formatCompactEuro = (amt: number) => {
    if (amt >= 1000) {
      return `${(amt / 1000).toFixed(1)}k €`;
    }
    return `${Math.round(amt)} €`;
  };

  return (
    <div className="month-selector-bar">
      <div className="month-icon-label">
        <Calendar size={16} className="text-cyan" />
        <span>Période :</span>
      </div>

      <div className="month-pills-scroll">
        <button
          className={`month-pill ${selectedMonthKey === 'all' ? 'active' : ''}`}
          onClick={() => onSelectMonth('all')}
        >
          <span className="month-name">Vue Globale</span>
          <span className="month-sub">Toutes opérations</span>
        </button>

        {months.map((m) => (
          <button
            key={m.key}
            className={`month-pill ${selectedMonthKey === m.key ? 'active' : ''}`}
            onClick={() => onSelectMonth(m.key)}
          >
            <span className="month-name">{m.label}</span>
            <span className="month-sub text-rose">{formatCompactEuro(m.expenseTotal)}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
