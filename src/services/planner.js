const { formatRecipe } = require('./recipeFormat');

const NOTES = [
  'A cosy one for after a long day.',
  'Simple, tasty and kind to the washing-up.',
  'Something fresh to keep things interesting.',
  'Treat yourself, you earned it.',
  'A warm bowl always helps.',
  'Cook together if you can.',
  'Leftovers tomorrow, hooray.',
];

/** Small deterministic hash so the same user + day count gives a stable (but varied) plan. */
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function shuffle(list, seed) {
  const out = [...list];
  let s = seed || 1;
  for (let i = out.length - 1; i > 0; i -= 1) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Plan lunches from the lighter half of the candidates and dinners from the heavier half,
 * never repeating a recipe until the pool is used up. Works with no AI at all.
 */
function buildLocalPlan(candidates, days, seed = 1) {
  const sorted = [...candidates].sort((a, b) => (a.calories ?? 9999) - (b.calories ?? 9999));
  const half = Math.ceil(sorted.length / 2);
  const lunchPool = shuffle(sorted.slice(0, half), seed);
  const dinnerPool = shuffle(sorted.slice(half).length ? sorted.slice(half) : sorted, seed + 7);

  const pick = (pool, i) => pool[i % pool.length].id;
  return Array.from({ length: days }, (_, i) => ({
    day: i + 1,
    lunch: pick(lunchPool, i),
    dinner: pick(dinnerPool, i),
    note: NOTES[(seed + i) % NOTES.length],
  }));
}

function hydrate(plan, byId) {
  const get = (id) => (byId.get(id) ? formatRecipe(byId.get(id)) : null);
  return {
    id: plan.id,
    days: plan.days,
    generatedBy: plan.generatedBy,
    createdAt: plan.createdAt,
    plan: plan.plan.map((d) => ({ day: d.day, note: d.note, lunch: get(d.lunch), dinner: get(d.dinner) })),
  };
}

module.exports = { NOTES, hash, shuffle, buildLocalPlan, hydrate };
