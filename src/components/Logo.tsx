/** 7×7 pixel ring with one signal pixel: a lens, not a search icon. */
const RING = [
  [2, 0], [3, 0], [4, 0],
  [1, 1], [5, 1],
  [0, 2], [6, 2],
  [0, 3], [6, 3],
  [0, 4], [6, 4],
  [1, 5], [5, 5],
  [2, 6], [3, 6], [4, 6],
];

export function LogoMark({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 7 7" shapeRendering="crispEdges" aria-hidden="true">
      {RING.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="currentColor" />
      ))}
      <rect x="2" y="2" width="1" height="1" fill="var(--accent)" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="logo">
      <LogoMark />
      <span className="logo__word">SpendLens</span>
    </span>
  );
}
