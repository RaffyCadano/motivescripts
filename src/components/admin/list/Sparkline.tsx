const WIDTH = 64;
const HEIGHT = 24;
const PAD_X = 3;
const PAD_Y = 5;

/** Decorative trend line for a stat tile -- no axes, gridlines, or value labels. */
export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  if (values.length < 2) return null;

  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min;
  const stepX = (WIDTH - PAD_X * 2) / (values.length - 1);

  const points = values.map((value, index) => {
    const x = PAD_X + index * stepX;
    const y = range === 0 ? HEIGHT / 2 : PAD_Y + (1 - (value - min) / range) * (HEIGHT - PAD_Y * 2);
    return [x, y] as const;
  });

  const path = points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [endX, endY] = points[points.length - 1];

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width={WIDTH} height={HEIGHT} className={className} aria-hidden="true">
      <path d={path} fill="none" stroke="rgb(0 80 240 / 0.32)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={endX} cy={endY} r={4} fill="var(--admin-blue)" stroke="var(--admin-card)" strokeWidth={2} />
    </svg>
  );
}
