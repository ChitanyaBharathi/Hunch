// Small, dependency-free statistics. Every function is pure; randomness comes from a seeded generator
// so reports are reproducible run to run.

export const sum = xs => xs.reduce((a, b) => a + b, 0);
export const mean = xs => (xs.length ? sum(xs) / xs.length : NaN);

export function quantile(values, q) {
  if (!values.length) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi || sorted[lo] === sorted[hi]) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}
export const median = values => quantile(values, 0.5);

export function variance(xs) {
  if (xs.length < 2) return NaN;
  const m = mean(xs);
  return sum(xs.map(x => (x - m) ** 2)) / (xs.length - 1);
}
export const sd = xs => Math.sqrt(variance(xs));

// mulberry32: tiny, fast, good enough for resampling.
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Percentile bootstrap interval for the median.
export function bootstrapMedianCI(values, { level = 0.9, reps = 1000, seed = 7 } = {}) {
  if (values.length < 2) return [NaN, NaN];
  const random = rng(seed);
  const medians = new Array(reps);
  const sample = new Array(values.length);
  for (let r = 0; r < reps; r++) {
    for (let i = 0; i < values.length; i++) sample[i] = values[Math.floor(random() * values.length)];
    medians[r] = median(sample);
  }
  const tail = (1 - level) / 2;
  return [quantile(medians, tail), quantile(medians, 1 - tail)];
}

export function pearson(xs, ys) {
  const n = xs.length;
  if (n < 2 || ys.length !== n) return NaN;
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : NaN;
}

// Two-sided normal quantile for common confidence levels (good to 3 dp, enough for reporting).
export const zFor = level => ({ 0.8: 1.2816, 0.9: 1.6449, 0.95: 1.96, 0.99: 2.5758 })[level] ?? 1.96;

// Perception error on a log scale: guessing double and guessing half are equally far off.
export const logBias = (value, actual) => Math.log(value / actual);
// Back to a human percentage: exp(bias) - 1, so -0.25 → -22%.
export const pctFromLog = l => (Number.isFinite(l) ? Math.exp(l) - 1 : l === -Infinity ? -1 : NaN);
