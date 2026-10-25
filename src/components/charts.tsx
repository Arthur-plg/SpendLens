/* ---------- Pixel bars: monthly values quantised to a grid of squares ---------- */

interface PixelBarsProps {
  values: number[];
  activeIndex: number;
  rows?: number;
  label: string;
  onSelectColumn?: (colIndex: number) => void;
  columnTitles?: string[];
}

/** Same 10px cell / 3px gap lattice as the presence strips on Charges fixes. */
export const PIXEL_CELL = 10;
export const PIXEL_GAP = 3;

export function PixelBars({ values, activeIndex, rows = 8, label, onSelectColumn, columnTitles }: PixelBarsProps) {
  const max = Math.max(...values, 1);
  const pitch = PIXEL_CELL + PIXEL_GAP;
  const width = values.length * pitch - PIXEL_GAP;
  const height = rows * pitch - PIXEL_GAP;

  return (
    <svg
      className="pixel-bars"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role={onSelectColumn ? 'region' : 'img'}
      aria-label={label}
      shapeRendering="crispEdges"
    >
      {values.map((v, col) => {
        const filled = v > 0 ? Math.max(1, Math.round((v / max) * rows)) : 0;
        const isActive = col === activeIndex;
        const colTitle = columnTitles?.[col] ?? `Colonne ${col + 1}`;

        return (
          <g
            key={col}
            className={`pixel-bars__col ${isActive ? 'pixel-bars__col--active' : ''} ${onSelectColumn ? 'pixel-bars__col--interactive' : ''}`}
            role={onSelectColumn ? 'button' : undefined}
            tabIndex={onSelectColumn ? 0 : undefined}
            aria-label={colTitle}
            aria-pressed={onSelectColumn ? isActive : undefined}
            onClick={() => onSelectColumn?.(col)}
            onKeyDown={(e) => {
              if (onSelectColumn && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onSelectColumn(col);
              }
            }}
          >
            <title>{colTitle}</title>
            {onSelectColumn && (
              <rect
                x={col * pitch}
                y={0}
                width={PIXEL_CELL}
                height={height}
                fill="transparent"
                style={{ cursor: 'pointer' }}
              />
            )}
            {Array.from({ length: rows }, (_, row) => {
              const on = rows - row <= filled;
              const cls = !on ? 'pixel-bars__off' : isActive ? 'pixel-bars__hit' : 'pixel-bars__on';
              return (
                <rect
                  key={row}
                  className={cls}
                  x={col * pitch}
                  y={row * pitch}
                  width={PIXEL_CELL}
                  height={PIXEL_CELL}
                />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

/* ---------- Bar: a length, relative to the largest item in its list ---------- */

export function Bar({ value, color = 'var(--ink)' }: { value: number; color?: string }) {
  return (
    <span className="bar" aria-hidden="true">
      <span className="bar__fill" style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }} />
    </span>
  );
}
