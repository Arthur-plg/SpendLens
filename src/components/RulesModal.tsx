import React, { useState } from 'react';
import { X, Plus, Trash2, CheckCircle2, RotateCcw } from 'lucide-react';
import type { Rule, CategoryDefinition } from '../types';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  rules: Rule[];
  categories: CategoryDefinition[];
  onSaveRule: (newRule: Rule) => void;
  onDeleteRule: (ruleId: string) => void;
  onReapplyRules: () => void;
  onResetDefaultRules: () => void;
  prefilledRule?: Partial<Rule> | null;
}

export const RulesModal: React.FC<RulesModalProps> = ({
  isOpen,
  onClose,
  rules,
  categories,
  onSaveRule,
  onDeleteRule,
  onReapplyRules,
  onResetDefaultRules,
  prefilledRule,
}) => {
  const [pattern, setPattern] = useState(prefilledRule?.pattern || '');
  const [categoryId, setCategoryId] = useState(prefilledRule?.categoryId || categories[0]?.id || 'alimentation');
  const [targetMerchantName, setTargetMerchantName] = useState(prefilledRule?.targetMerchantName || '');
  const [isRegex, setIsRegex] = useState(prefilledRule?.isRegex || false);
  const [reappliedNotice, setReappliedNotice] = useState(false);

  // Sync if prefilled rule changes
  React.useEffect(() => {
    if (prefilledRule) {
      setPattern(prefilledRule.pattern || '');
      setCategoryId(prefilledRule.categoryId || categories[0]?.id || 'alimentation');
      setTargetMerchantName(prefilledRule.targetMerchantName || '');
      setIsRegex(prefilledRule.isRegex || false);
    }
  }, [prefilledRule, categories]);

  if (!isOpen) return null;

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pattern.trim()) return;

    const newRule: Rule = {
      id: `rule_custom_${Date.now()}`,
      pattern: pattern.trim(),
      categoryId,
      targetMerchantName: targetMerchantName.trim() || undefined,
      isRegex,
      priority: 85,
      createdAt: new Date().toISOString(),
    };

    onSaveRule(newRule);
    setPattern('');
    setTargetMerchantName('');
    setIsRegex(false);
  };

  const handleReapply = () => {
    onReapplyRules();
    setReappliedNotice(true);
    setTimeout(() => setReappliedNotice(false), 3000);
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card rules-modal">
        {/* Header */}
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Moteur de Règles Automatiques</h2>
            <p className="modal-desc">
              Définis des règles locales par mots-clés ou regex pour catégoriser instantanément tes dépenses.
            </p>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Add Rule Form */}
        <form onSubmit={handleAddRule} className="rule-form-card">
          <div className="form-row-grid">
            <div className="form-group">
              <label className="form-label">Mot-clé ou Regex</label>
              <input
                type="text"
                placeholder="Ex: UBER, LIDL, NAVIGO..."
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Catégorie Cible</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="form-select"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Nom Commerçant Nettoyé (optionnel)</label>
              <input
                type="text"
                placeholder="Ex: Uber VTC"
                value={targetMerchantName}
                onChange={(e) => setTargetMerchantName(e.target.value)}
                className="form-input"
              />
            </div>
          </div>

          <div className="form-bottom-row">
            <label className="regex-checkbox-label">
              <input
                type="checkbox"
                checked={isRegex}
                onChange={(e) => setIsRegex(e.target.checked)}
              />
              <span>Expression régulière (Regex)</span>
            </label>

            <button type="submit" className="btn btn-primary btn-sm">
              <Plus size={16} />
              <span>Ajouter la règle</span>
            </button>
          </div>
        </form>

        {/* Reapply Bar */}
        <div className="reapply-toolbar">
          <button className="btn btn-secondary btn-sm" onClick={handleReapply}>
            <CheckCircle2 size={15} className="text-emerald" />
            <span>Réappliquer les règles à toutes les transactions</span>
          </button>

          <button className="btn btn-ghost btn-sm text-muted" onClick={onResetDefaultRules}>
            <RotateCcw size={14} />
            <span>Réinitialiser les règles par défaut</span>
          </button>

          {reappliedNotice && (
            <span className="reapply-success-tag">Règles appliquées avec succès !</span>
          )}
        </div>

        {/* Rules List */}
        <div className="rules-scroll-list">
          <div className="rules-list-header">
            <span>{rules.length} règles actives (par ordre de priorité)</span>
          </div>

          {rules.map((rule) => {
            const cat = categories.find((c) => c.id === rule.categoryId) || {
              name: rule.categoryId,
              color: '#94a3b8',
              bgLight: 'rgba(148, 163, 184, 0.1)',
            };

            return (
              <div key={rule.id} className="rule-item-row">
                <div className="rule-item-pattern">
                  <code>{rule.pattern}</code>
                  {rule.isRegex && <span className="regex-pill">regex</span>}
                  {rule.targetMerchantName && (
                    <span className="target-merchant-sub">→ "{rule.targetMerchantName}"</span>
                  )}
                </div>

                <div className="rule-item-category">
                  <span
                    className="cat-badge"
                    style={{ backgroundColor: cat.bgLight, color: cat.color }}
                  >
                    {cat.name}
                  </span>
                </div>

                <button
                  className="btn-delete-rule"
                  onClick={() => onDeleteRule(rule.id)}
                  title="Supprimer la règle"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
