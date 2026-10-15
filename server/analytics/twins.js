import { pearson } from './stats.js';

export const MIN_SHARED_ITEMS = 5;

// Similarity between two people = correlation of their bias vectors over the items (or categories) both answered.
// vectors: Map/obj of key → bias. Returns NaN when they share too little or one of them never varies.
export function similarity(a, b, minShared = MIN_SHARED_ITEMS) {
  const keys = Object.keys(a).filter(k => Number.isFinite(a[k]) && Number.isFinite(b[k]));
  if (keys.length < minShared) return NaN;
  return pearson(keys.map(k => a[k]), keys.map(k => b[k]));
}

// The closest match for `selfId` among `people` ({ id, name, vector }). In-game only; reports use aggregates.
export function priceTwin(selfId, people, minShared = MIN_SHARED_ITEMS) {
  const self = people.find(p => p.id === selfId);
  if (!self) return null;
  let best = null;
  for (const other of people) {
    if (other.id === selfId) continue;
    const match = similarity(self.vector, other.vector, minShared);
    if (Number.isFinite(match) && (!best || match > best.match)) best = { name: other.name, match: Math.round(match * 100) / 100 };
  }
  return best;
}
