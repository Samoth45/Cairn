/** Pas « rond » (1, 2, 2,5 ou 5 × 10^n) donnant environ `target` graduations sur `range`. */
export function niceStep(range: number, target: number): number {
  if (!(range > 0) || target <= 0) return 1;
  const raw = range / target;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  const mult = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return mult * pow;
}

/** Graduations multiples de `step` comprises dans [min, max]. */
export function ticks(min: number, max: number, step: number): number[] {
  const out: number[] = [];
  const start = Math.ceil(min / step) * step;
  for (let v = start; v <= max + step * 1e-9; v += step) out.push(Number(v.toFixed(10)));
  return out;
}
