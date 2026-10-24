import React, { useState } from 'react';
import { X, Sparkles, Key, Zap, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import type { Transaction } from '../types';

interface GroqModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  onSaveApiKey: (key: string) => void;
  unclassifiedTransactions: Transaction[];
  onClassify: () => Promise<void>;
  isClassifying: boolean;
  statusMessage?: string;
  error?: string | null;
}

export const GroqModal: React.FC<GroqModalProps> = ({
  isOpen,
  onClose,
  apiKey,
  onSaveApiKey,
  unclassifiedTransactions,
  onClassify,
  isClassifying,
  statusMessage,
  error,
}) => {
  const [inputKey, setInputKey] = useState(apiKey);
  const [savedSuccess, setSavedSuccess] = useState(false);

  React.useEffect(() => {
    setInputKey(apiKey);
  }, [apiKey]);

  if (!isOpen) return null;

  const handleSaveKey = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveApiKey(inputKey.trim());
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card groq-modal">
        {/* Header */}
        <div className="modal-header">
          <div className="flex-align-gap">
            <div className="groq-icon-wrap">
              <Sparkles size={22} className="text-amber" />
            </div>
            <div>
              <h2 className="modal-title">Classification IA via Groq (Gratuit & Rapide)</h2>
              <p className="modal-desc">
                Utilise le modèle <code>llama-3.1-8b-instant</code> pour catégoriser les dépenses inconnues et générer des règles locales pérennes.
              </p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* API Key Form */}
        <form onSubmit={handleSaveKey} className="groq-key-card">
          <div className="form-group">
            <div className="flex-between mb-1">
              <label className="form-label flex-align-gap">
                <Key size={14} className="text-cyan" />
                <span>Clé API Groq (gsk_...)</span>
              </label>
              <a
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noreferrer"
                className="groq-external-link"
              >
                Obtenir une clé gratuite sur Groq →
              </a>
            </div>
            <div className="flex-gap">
              <input
                type="password"
                placeholder="gsk_..."
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                className="form-input flex-1"
              />
              <button type="submit" className="btn btn-secondary">
                Enregistrer la clé
              </button>
            </div>
            {savedSuccess && (
              <span className="key-saved-text">
                <CheckCircle2 size={13} /> Clé sauvegardée localement dans ton navigateur.
              </span>
            )}
          </div>
        </form>

        {/* Token-friendly explanation */}
        <div className="groq-strategy-banner">
          <Zap size={18} className="text-amber flex-shrink-0" />
          <div className="groq-strategy-text">
            <strong>Économie maximale de tokens (Free Tier compliant) :</strong>
            <p>
              Groq n'est appelé <em>que</em> pour les libellés orphelins. Dès que Groq identifie un commerçant, il génère une règle locale permanente. Tes prochains relevés ne dépenseront donc aucun token supplémentaire !
            </p>
          </div>
        </div>

        {/* Action area */}
        <div className="groq-action-box">
          <div className="groq-stat-row">
            <span>Transactions non catégorisées ou dans « Autre » :</span>
            <strong className="text-amber">{unclassifiedTransactions.length} opérations</strong>
          </div>

          {error && (
            <div className="groq-error-alert">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {statusMessage && (
            <div className="groq-status-text">
              <RefreshCw size={14} className="spin text-cyan" />
              <span>{statusMessage}</span>
            </div>
          )}

          <button
            className="btn btn-primary btn-groq-run"
            disabled={!apiKey || unclassifiedTransactions.length === 0 || isClassifying}
            onClick={onClassify}
          >
            {isClassifying ? (
              <>
                <RefreshCw size={16} className="spin" />
                <span>Analyse IA en cours sur Groq...</span>
              </>
            ) : (
              <>
                <Sparkles size={16} />
                <span>Classifier avec Groq ({Math.min(unclassifiedTransactions.length, 25)} transactions)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
