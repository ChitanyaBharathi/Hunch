import { median, mean, rng, logBias, pctFromLog } from './stats.js';
import { MIN_PERSONA_SIZE, MIN_CLUSTER_RESPONDENTS, MIN_SEGMENT_N, suppressed } from './thresholds.js';

// ── Vectors ──────────────────────────────────────────────────────────────────
// One 8-number vector per respondent: their median bias in each category. Respondents need enough answers spread
// across categories; a missing category is filled with that respondent's own overall median.
//   raw     ln(guess / actual)                         — used to name and describe a persona
//   vector  raw minus that product's crowd median bias — used to cluster. Every player sees different products, and
//           some products fool everyone; centring removes that shared noise so people are compared with each other.
//           The crowd's overall level is added back so "underestimates everything" still stands out.
// Eligible: at least 20 answers (two games) covering six or more categories; one game gives one or two answers per
// category, which is too noisy to tell people apart.
export function respondentVectors(rows, categories, { minAnswers = 20, minCategories = Math.min(6, categories.length) } = {}) {
  const byProduct = new Map();
  for (const r of rows) byProduct.set(r.productId, [...(byProduct.get(r.productId) ?? []), logBias(r.guessCents, r.actualCents)]);
  const productMedian = new Map([...byProduct].map(([id, b]) => [id, median(b)]));
  const level = median([...productMedian.values()]);
  const byRespondent = new Map();
  for (const r of rows) byRespondent.set(r.respondentId, [...(byRespondent.get(r.respondentId) ?? []), r]);
  const vectors = [];
  for (const [respondentId, answers] of byRespondent) {
    if (answers.length < minAnswers) continue;
    const biases = answers.map(r => { const bias = logBias(r.guessCents, r.actualCents); return { category: r.category, bias, centred: bias - productMedian.get(r.productId) + level }; });
    if (categories.filter(c => biases.some(b => b.category === c)).length < minCategories) continue;
    const perCategory = key => {
      const overall = median(biases.map(b => b[key]));
      return categories.map(c => { const own = biases.filter(b => b.category === c).map(b => b[key]); return own.length ? median(own) : overall; });
    };
    vectors.push({ respondentId, vector: perCategory('centred'), raw: perCategory('bias') });
  }
  return vectors;
}

// ── k-means (k-means++ seeding, several restarts, keep the lowest inertia) ──
const dist2 = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2; return s; };

export function kmeans(points, k, { seed = 11, restarts = 8, maxIter = 100 } = {}) {
  const random = rng(seed);
  let best = null;
  for (let attempt = 0; attempt < restarts; attempt++) {
    const centroids = [points[Math.floor(random() * points.length)]];
    while (centroids.length < k) {
      const d = points.map(p => Math.min(...centroids.map(c => dist2(p, c))));
      const total = d.reduce((a, b) => a + b, 0);
      let pick = random() * total, i = 0;
      while (i < d.length - 1 && (pick -= d[i]) > 0) i++;
      centroids.push(points[i]);
    }
    let assignments = new Array(points.length).fill(-1);
    for (let iter = 0; iter < maxIter; iter++) {
      const next = points.map(p => { let bi = 0, bd = Infinity; centroids.forEach((c, j) => { const dd = dist2(p, c); if (dd < bd) { bd = dd; bi = j; } }); return bi; });
      const changed = next.some((a, i) => a !== assignments[i]);
      assignments = next;
      for (let j = 0; j < k; j++) {
        const members = points.filter((_, i) => assignments[i] === j);
        if (members.length) centroids[j] = members[0].map((_, dim) => mean(members.map(m => m[dim])));
      }
      if (!changed) break;
    }
    const inertia = points.reduce((s, p, i) => s + dist2(p, centroids[assignments[i]]), 0);
    if (!best || inertia < best.inertia) best = { k, centroids: centroids.map(c => [...c]), assignments, inertia };
  }
  return best;
}

// Mean silhouette: for each point, (b - a) / max(a, b), where a is its mean distance to its own cluster and b to the
// nearest other cluster. Near 1 = clear groups; near 0 = overlapping.
export function silhouette(points, assignments, k) {
  const scores = points.map((p, i) => {
    const sums = new Array(k).fill(0), counts = new Array(k).fill(0);
    points.forEach((q, j) => { if (i !== j) { sums[assignments[j]] += Math.sqrt(dist2(p, q)); counts[assignments[j]]++; } });
    const own = assignments[i];
    if (!counts[own]) return 0;
    const a = sums[own] / counts[own];
    const b = Math.min(...sums.map((s, c) => (c === own || !counts[c] ? Infinity : s / counts[c])));
    return Number.isFinite(b) ? (b - a) / Math.max(a, b) : 0;
  });
  return mean(scores);
}

export function chooseK(points, { kMin = 3, kMax = 6, seed = 11 } = {}) {
  let best = null;
  for (let k = kMin; k <= Math.min(kMax, points.length - 1); k++) {
    const fit = kmeans(points, k, { seed });
    const score = silhouette(points, fit.assignments, k);
    if (!best || score > best.silhouette + 1e-9) best = { ...fit, silhouette: score };
  }
  return best;
}

// ── Naming from the centroid's shape ────────────────────────────────────────
// Names come from how a group differs from the shared baseline: the median of all groups in each category. Without
// that, effects everyone shares (most people underestimate expensive gadgets and overestimate cheap snacks) would
// decide the names. Descriptions quote the group's actual figure next to the baseline.
const NAMES = {
  Tech: ['Tech Optimist', 'Gadget Splurger'],
  Fashion: ['Fashion Bargainer', 'Label Believer'],
  Beauty: ['Drugstore Mindset', 'Premium Believer'],
  Home: ['Home Bargainer', 'Home Splurger'],
  'Food & Drink': ['Hawker Anchor', 'Café Crowd'],
  Sports: ['Gear Bargainer', 'Gear Splurger'],
  Hobbies: ['Hobby Bargainer', 'Hobby Splurger'],
  Everyday: ['Everyday Anchor', 'Everyday Inflator'],
  Experiences: ['Homebody Pricer', 'Experience Splurger'],
};
const signed = l => { const p = Math.round(pctFromLog(l) * 100); return `${p > 0 ? '+' : p < 0 ? '−' : ''}${Math.abs(p)}%`; };
const meanAbs = c => mean(c.map(Math.abs));

export function nameCentroid(centroid, categories, taken = new Set(), baseline = categories.map(() => 0)) {
  const dev = centroid.map((c, i) => c - baseline[i]);
  const m = mean(dev);
  const candidates = [];
  if (meanAbs(centroid) < 0.12 && Math.max(...centroid.map(Math.abs)) < 0.3) candidates.push(['Calibrated Shopper', `Lands close to real prices: about ${signed(meanAbs(centroid)).replace('+', '')} off in a typical category.`]);
  // Specific shapes before general ones: a group that mostly overestimates beauty and fashion is a Premium Believer
  // even if it guesses a little high elsewhere too.
  const b = categories.indexOf('Beauty'), f = categories.indexOf('Fashion');
  if (b >= 0 && f >= 0 && dev[b] - m > 0.15 && dev[f] - m > 0.15)
    candidates.push(['Premium Believer', `Overestimates beauty (${signed(centroid[b])}) and fashion (${signed(centroid[f])}) far more than most people: reads brand as price.`]);
  if (m < -0.2 && dev.every(d => d < 0.05)) candidates.push(['Bargain Anchor', `Guesses lower than most people in every category, by about ${signed(m).replace('−', '')} overall: expects prices from a cheaper era.`]);
  if (m > 0.2 && dev.every(d => d > -0.05)) candidates.push(['Premium Assumer', `Guesses higher than most people in every category, by about ${signed(m).replace('+', '')} overall.`]);
  const ranked = categories.map((c, i) => ({ c, i, rel: dev[i] - m })).sort((x, y) => Math.abs(y.rel) - Math.abs(x.rel));
  for (const { c, i, rel } of ranked) {
    const [lower, higher] = NAMES[c] ?? [`${c} Optimist`, `${c} Splurger`];
    candidates.push([rel < 0 ? lower : higher, `Guesses ${c.toLowerCase()} ${rel < 0 ? 'lower' : 'higher'} than most people: ${signed(centroid[i])} vs ${signed(baseline[i])}.`]);
  }
  const pick = candidates.find(([name]) => !taken.has(name)) ?? [`${candidates[0][0]} (${taken.size + 1})`, candidates[0][1]];
  return { name: pick[0], description: pick[1] };
}

// Names for a set of raw centroids. The most accurate group is "Calibrated Shopper" if it is reasonably close;
// the rest are named in order of how distinctive they are, so the clearest groups get first pick of names.
export function namePersonas(centroids, categories) {
  const baseline = categories.map((_, d) => median(centroids.map(c => c[d])));
  const names = new Array(centroids.length);
  const taken = new Set();
  const accuracy = centroids.map(meanAbs);
  const best = accuracy.indexOf(Math.min(...accuracy));
  if (accuracy[best] < 0.2) {
    names[best] = { name: 'Calibrated Shopper', description: `The most accurate group: about ${signed(accuracy[best]).replace('+', '')} off in a typical category.` };
    taken.add(names[best].name);
  }
  const distinct = c => Math.max(...c.map((v, i) => Math.abs(v - baseline[i])));
  const order = centroids.map((_, j) => j).filter(j => !names[j]).sort((a, b) => distinct(centroids[b]) - distinct(centroids[a]));
  for (const j of order) { names[j] = nameCentroid(centroids[j], categories, taken, baseline); taken.add(names[j].name); }
  return names;
}

// ── Personas: fit on all eligible respondents, report only groups of MIN_PERSONA_SIZE+ ──
export function buildPersonas(rows, categories, { seed = 11 } = {}) {
  const vectors = respondentVectors(rows, categories);
  if (vectors.length < MIN_CLUSTER_RESPONDENTS) return { ...suppressed(vectors.length, MIN_CLUSTER_RESPONDENTS), eligibleRespondents: vectors.length };
  const fit = chooseK(vectors.map(v => v.vector), { seed });
  const sizes = fit.centroids.map((_, j) => fit.assignments.filter(a => a === j).length);
  const order = sizes.map((s, j) => j).sort((a, b) => sizes[b] - sizes[a]);
  // Raw profile: how far each group actually over- or under-estimates each category.
  const raws = fit.centroids.map((_, j) => {
    const members = vectors.filter((_, i) => fit.assignments[i] === j);
    return categories.map((_, d) => mean(members.map(m => m.raw[d])));
  });
  const names = namePersonas(raws, categories);
  const personas = order.map(j => {
    const raw = raws[j];
    const { name, description } = names[j];
    return { cluster: j, name, description, size: sizes[j], reported: sizes[j] >= MIN_PERSONA_SIZE,
      profile: Object.fromEntries(categories.map((c, i) => [c, Math.round(pctFromLog(raw[i]) * 1000) / 1000])) };
  });
  const membership = new Map(vectors.map((v, i) => [v.respondentId, fit.assignments[i]]));
  return { k: fit.k, silhouette: Math.round(fit.silhouette * 1000) / 1000, eligibleRespondents: vectors.length, personas, membership };
}

// How each reported persona sees one product (segment threshold applies within the persona).
export function personaView(personaFit, productRows, perceptionGap, valueGap) {
  if (personaFit.suppressed) return [];
  return personaFit.personas.filter(p => p.reported).map(p => {
    const rows = productRows.filter(r => personaFit.membership.get(r.respondentId) === p.cluster);
    if (rows.length < MIN_SEGMENT_N) return { name: p.name, size: p.size, product: suppressed(rows.length, MIN_SEGMENT_N) };
    return { name: p.name, size: p.size, product: { n: rows.length, perceptionGapPct: perceptionGap(rows, MIN_SEGMENT_N).pct, valueGap: valueGap(rows, MIN_SEGMENT_N) } };
  });
}
