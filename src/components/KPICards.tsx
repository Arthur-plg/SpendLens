import React from 'react';
import { ArrowDownRight, ArrowUpRight, PiggyBank, ArrowLeftRight, TrendingDown } from 'lucide-react';
import type { MonthlyStats } from '../types';

interface KPICardsProps {
  stats: MonthlyStats;
  selectedMonthLabel: string;
  internalTransfersCount: number;
  internalTransfersSum: number;
  excludeTransfers: boolean;
  onToggleExcludeTransfers: () => void;
}

export const KPICards: React.FC<KPICardsProps> = ({
  stats,
  selectedMonthLabel,
  internalTransfersCount,
  internalTransfersSum,
  excludeTransfers,
  onToggleExcludeTransfers,
}) => {
  const formatEuro = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const isPositiveSavings = stats.netSavings >= 0;

  return (
    <div className="kpi-grid">
      {/* 1. Dépenses totales */}
      <div className="kpi-card expense-card">
        <div className="kpi-header">
          <span className="kpi-label">Dépenses Réelles</span>
          <div className="kpi-icon-wrap expense-icon">
            <ArrowDownRight size={20} />
          </div>
        </div>
        <div className="kpi-value text-rose">{formatEuro(stats.totalExpenses)}</div>
        <div className="kpi-sub">
          <span>{selectedMonthLabel}</span>
          <span className="kpi-pill expense-pill">{stats.transactionCount} opérations</span>
        </div>
      </div>

      {/* 2. Revenus réels */}
      <div className="kpi-card income-card">
        <div className="kpi-header">
          <span className="kpi-label">Revenus Réels</span>
          <div className="kpi-icon-wrap income-icon">
            <ArrowUpRight size={20} />
          </div>
        </div>
        <div className="kpi-value text-emerald">{formatEuro(stats.totalIncome)}</div>
        <div className="kpi-sub">
          <span>Salaires, virements reçus & remboursements</span>
        </div>
      </div>

      {/* 3. Reste à Vivre / Épargne nette */}
      <div className="kpi-card savings-card">
        <div className="kpi-header">
          <span className="kpi-label">Reste à Vivre / Épargne Nette</span>
          <div className={`kpi-icon-wrap ${isPositiveSavings ? 'savings-icon' : 'deficit-icon'}`}>
            {isPositiveSavings ? <PiggyBank size={20} /> : <TrendingDown size={20} />}
          </div>
        </div>
        <div className={`kpi-value ${isPositiveSavings ? 'text-emerald' : 'text-amber'}`}>
          {isPositiveSavings ? `+${formatEuro(stats.netSavings)}` : formatEuro(stats.netSavings)}
        </div>
        <div className="kpi-sub">
          <span className={`kpi-pill ${isPositiveSavings ? 'savings-pill' : 'deficit-pill'}`}>
            Taux d'épargne : {stats.savingsRate.toFixed(1)}%
          </span>
          <span className="text-muted">Revenus - Dépenses</span>
        </div>
      </div>

      {/* 4. Virements Intercompte Neutralisés */}
      <div className="kpi-card transfer-card">
        <div className="kpi-header">
          <div className="flex-col">
            <span className="kpi-label">Virements Intercompte</span>
            <span className="kpi-badge-neutral">Neutralisés</span>
          </div>
          <div className="kpi-icon-wrap transfer-icon">
            <ArrowLeftRight size={20} />
          </div>
        </div>
        <div className="kpi-value text-slate">{formatEuro(internalTransfersSum)}</div>
        <div className="kpi-sub flex-between">
          <span className="text-muted">{internalTransfersCount} virements internes détectés</span>
          <button
            className={`btn-toggle-switch ${excludeTransfers ? 'active' : ''}`}
            onClick={onToggleExcludeTransfers}
            title={excludeTransfers ? 'Virements masqués des calculs' : 'Virements inclus dans les calculs'}
          >
            <span className="switch-text">{excludeTransfers ? 'Exclus' : 'Inclus'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
