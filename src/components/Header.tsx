import { Download, LoaderCircle, Moon, Sun, Tags, Upload } from 'lucide-react';
import { Logo } from './Logo';
import type { Theme } from '../utils/storage';
import { VIEWS } from '../lib/views';
import type { View } from '../lib/views';

interface HeaderProps {
  view: View;
  onViewChange: (view: View) => void;
  /** Distinct merchants still without a category; null while nothing is loaded. */
  toClassify: number | null;
  onOpenCategorization: () => void;
  onImport: () => void;
  importing: boolean;
  theme: Theme;
  onToggleTheme: () => void;
  hasData?: boolean;
  onExport?: () => void;
}

export function Header({
  view,
  onViewChange,
  toClassify,
  onOpenCategorization,
  onImport,
  importing,
  theme,
  onToggleTheme,
  hasData,
  onExport,
}: HeaderProps) {
  const pending = toClassify ?? 0;

  return (
    <>
      <header className="topbar">
        <div className="topbar__inner">
          <a
            className="topbar__brand"
            href="#overview"
            onClick={(e) => {
              e.preventDefault();
              onViewChange('overview');
            }}
          >
            <Logo />
          </a>

          <nav className="tabs" aria-label="Vues">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                className="tabs__item"
                aria-current={view === v.id ? 'page' : undefined}
                onClick={() => onViewChange(v.id)}
              >
                {v.label}
              </button>
            ))}
          </nav>

          <div className="topbar__actions">
            <button
              type="button"
              className="btn btn--ghost topbar__rules"
              onClick={onOpenCategorization}
              aria-label={pending > 0 ? `Catégorisation, ${pending} à classer` : 'Catégorisation'}
            >
              <Tags size={16} strokeWidth={1.75} aria-hidden="true" />
              <span className="topbar__rules-label">Catégorisation</span>
              {pending > 0 && (
                <span className="tag tag--accent">
                  {pending}
                  <span className="topbar__rules-suffix">&nbsp;à classer</span>
                </span>
              )}
            </button>
            {hasData && onExport && (
              <button
                type="button"
                className="btn btn--outline"
                onClick={onExport}
                title="Exporter le rapport des dépenses en PDF"
                aria-label="Exporter le rapport des dépenses en PDF"
              >
                <Download size={16} strokeWidth={1.75} aria-hidden="true" />
                <span className="hide-sm">Export</span>
              </button>
            )}
            <button
              type="button"
              className="btn btn--primary"
              onClick={onImport}
              disabled={importing}
              aria-label="Importer un relevé"
            >
              {importing ? (
                <LoaderCircle size={16} strokeWidth={1.75} className="spin" aria-hidden="true" />
              ) : (
                <Upload size={16} strokeWidth={1.75} aria-hidden="true" />
              )}
              <span className="hide-sm">Importer</span>
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={onToggleTheme}
              aria-label={theme === 'dark' ? 'Passer en thème clair' : 'Passer en thème sombre'}
              title={theme === 'dark' ? 'Thème clair' : 'Thème sombre'}
            >
              {theme === 'dark' ? <Sun size={17} strokeWidth={1.75} /> : <Moon size={17} strokeWidth={1.75} />}
            </button>
          </div>
        </div>
      </header>

      <nav className="tabbar" aria-label="Vues">
        {VIEWS.map((v) => {
          const Icon = v.icon;
          return (
            <button
              key={v.id}
              type="button"
              className="tabbar__item"
              aria-current={view === v.id ? 'page' : undefined}
              onClick={() => onViewChange(v.id)}
            >
              <Icon size={19} strokeWidth={1.6} aria-hidden="true" />
              <span>{v.short}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
