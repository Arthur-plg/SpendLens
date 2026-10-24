import type { KeyboardEvent, ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { DEFAULT_CATEGORIES, getCategory } from '../utils/categories';

/* ---------- Segmented control (radio group, roving focus) ---------- */

interface SegmentedProps<T extends string | number> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
}

export function Segmented<T extends string | number>({ label, value, options, onChange, size = 'md' }: SegmentedProps<T>) {
  const index = Math.max(0, options.findIndex((o) => o.value === value));

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const delta = ['ArrowRight', 'ArrowDown'].includes(e.key) ? 1 : ['ArrowLeft', 'ArrowUp'].includes(e.key) ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (index + delta + options.length) % options.length;
    onChange(options[next].value);
    (e.currentTarget.children[next] as HTMLElement | undefined)?.focus();
  };

  return (
    <div className={`segmented segmented--${size}`} role="radiogroup" aria-label={label} onKeyDown={onKeyDown}>
      {options.map((o, i) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          tabIndex={i === index ? 0 : -1}
          className="segmented__item"
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Category ---------- */

export function Swatch({ color, size = 10 }: { color: string; size?: number }) {
  return <span className="swatch" style={{ background: color, width: size, height: size }} aria-hidden="true" />;
}

export function CategoryLabel({ id }: { id: string }) {
  const c = getCategory(id);
  return (
    <span className="cat-label">
      <Swatch color={c.color} size={8} />
      <span>{c.name}</span>
    </span>
  );
}

interface CategorySelectProps {
  value: string;
  onChange: (id: string) => void;
  label: string;
  /** Shown instead of the current category, e.g. "Choisir…" for unclassified lines. */
  placeholder?: string;
}

/** Category shown as a quiet chip that is also a native select, so recategorising is one tap. */
export function CategorySelect({ value, onChange, label, placeholder }: CategorySelectProps) {
  const c = getCategory(value);
  return (
    <label className={`cat-select ${placeholder ? 'is-empty' : ''}`}>
      {!placeholder && <Swatch color={c.color} size={8} />}
      <span className="cat-select__name">{placeholder ?? c.name}</span>
      <ChevronDown size={13} strokeWidth={1.75} aria-hidden="true" />
      <select value={placeholder ? '' : value} onChange={(e) => e.target.value && onChange(e.target.value)} aria-label={label}>
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {DEFAULT_CATEGORIES.filter((cat) => !placeholder || cat.id !== 'autre').map((cat) => (
          <option key={cat.id} value={cat.id}>
            {cat.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/* ---------- Layout bits ---------- */

export function ViewHead({ title, meta, aside }: { title: ReactNode; meta?: ReactNode; aside?: ReactNode }) {
  return (
    <div className="view-head">
      <div className="view-head__text">
        {/* Focus target after a view switch, so screen readers announce the new page. */}
        <h1 className="view-head__title pixel" tabIndex={-1}>
          {title}
        </h1>
        {meta && <p className="view-head__meta">{meta}</p>}
      </div>
      {aside && <div className="view-head__aside">{aside}</div>}
    </div>
  );
}

export function SectionHead({ title, aside, as: Tag = 'h2' }: { title: string; aside?: ReactNode; as?: 'h2' | 'h3' }) {
  return (
    <div className="section-head">
      <Tag className="eyebrow">{title}</Tag>
      {aside && <div className="section-head__aside">{aside}</div>}
    </div>
  );
}

/** Navy block with Spore's stepped tab: reserved for the one figure that matters on a view. */
export function SignalPanel({ children, className = '', label }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <section className={`signal ${className}`} aria-label={label}>
      {children}
    </section>
  );
}

/* ---------- Empty / loading ---------- */

const EMPTY_PIXELS = [
  [1, 0], [2, 0], [3, 0], [4, 0],
  [1, 1], [5, 1],
  [1, 2], [6, 2],
  [1, 3], [6, 3],
  [1, 4], [3, 4], [4, 4], [6, 4],
  [1, 5], [6, 5],
  [1, 6], [3, 6], [4, 6], [6, 6],
  [1, 7], [6, 7],
  [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [6, 8],
];

interface EmptyStateProps {
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  /** 'intro' is the first-run screen: left-aligned, display-size title, no icon. */
  variant?: 'default' | 'intro';
}

export function EmptyState({ title, children, actions, variant = 'default' }: EmptyStateProps) {
  return (
    <div className={`empty empty--${variant}`}>
      {variant === 'default' && (
        <svg className="empty__art" width="40" height="45" viewBox="0 0 8 9" shapeRendering="crispEdges" aria-hidden="true">
          {EMPTY_PIXELS.map(([x, y]) => (
            <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="currentColor" />
          ))}
          <rect x="5" y="0" width="1" height="1" fill="var(--accent)" />
        </svg>
      )}
      <p className="empty__title pixel">{title}</p>
      {children && <div className="empty__text">{children}</div>}
      {actions && <div className="empty__actions">{actions}</div>}
    </div>
  );
}

export function Skeleton({ width = '100%', height = 16, round = false }: { width?: number | string; height?: number | string; round?: boolean }) {
  return <span className={`skeleton ${round ? 'skeleton--panel' : ''}`} style={{ width, height }} aria-hidden="true" />;
}
