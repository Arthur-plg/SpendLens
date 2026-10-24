import React, { useRef } from 'react';
import { Eye, Upload, Sliders, Sparkles, FileSpreadsheet, RefreshCw } from 'lucide-react';
import type { AccountInfo } from '../types';

interface NavbarProps {
  accountInfo: AccountInfo;
  onFileUpload: (file: File) => void;
  onLoadSample: () => void;
  onOpenRules: () => void;
  onOpenGroq: () => void;
  ruleCount: number;
  hasGroqKey: boolean;
  isLoading: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  accountInfo,
  onFileUpload,
  onLoadSample,
  onOpenRules,
  onOpenGroq,
  ruleCount,
  hasGroqKey,
  isLoading,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
    }
  };

  return (
    <header className="navbar-container">
      <div className="navbar-left">
        <div className="logo-badge">
          <Eye size={18} />
        </div>
        <div>
          <div className="logo-text">
            Spend<span>Lens</span>
            <span className="badge-counter" style={{ fontSize: '0.65rem', padding: '0.05rem 0.35rem', color: 'var(--brand-orange)' }}>lemon</span>
          </div>
          <div className="logo-sub">Analyse bancaire déterministe • 100% locale</div>
        </div>

        {accountInfo.holderName && (
          <div className="account-tag">
            <span className="dot-pulse" />
            <span className="account-name">{accountInfo.holderName}</span>
            <span className="bank-pill">{accountInfo.detectedBank}</span>
          </div>
        )}
      </div>

      <div className="navbar-actions">
        <button
          id="btn-load-sample-nav"
          className="btn btn-secondary load-sample-btn"
          onClick={onLoadSample}
          disabled={isLoading}
          title="Charger l'extrait Crédit Agricole"
        >
          {isLoading ? (
            <RefreshCw className="spin" size={16} />
          ) : (
            <FileSpreadsheet size={16} className="text-emerald" />
          )}
          <span>Charger mon relevé CA</span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        <button
          id="btn-import-file"
          className="btn btn-primary"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
        >
          <Upload size={16} />
          <span>Importer un relevé</span>
        </button>

        <button
          id="btn-open-rules"
          className="btn btn-outline"
          onClick={onOpenRules}
          title="Gérer les règles de catégorisation"
        >
          <Sliders size={16} />
          <span>Règles</span>
          <span className="badge-counter">{ruleCount}</span>
        </button>

        <button
          id="btn-open-groq"
          className={`btn ${hasGroqKey ? 'btn-groq-active' : 'btn-outline'}`}
          onClick={onOpenGroq}
          title="Catégorisation IA avec Groq"
        >
          <Sparkles size={16} className={hasGroqKey ? 'text-amber' : ''} />
          <span>IA Groq</span>
          {hasGroqKey && <span className="active-dot" />}
        </button>
      </div>
    </header>
  );
};
