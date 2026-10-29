const { NounInflector } = require('../utils/natural');
const { AISLES } = require('../data/ingredients');
const { DENSITY_G_PER_ML } = require('../data/kcal');

const inflector = new NounInflector();

// unit alias -> [canonical unit, family, factor to base (g for mass, ml for volume)]
const UNITS = {};
function addUnits(canonical, family, factor, aliases) {
  [canonical, ...aliases].forEach((a) => { UNITS[a] = [canonical, family, factor]; });
}
addUnits('g', 'mass', 1, ['gram', 'grams', 'gr', 'gm']);
addUnits('kg', 'mass', 1000, ['kilogram', 'kilograms', 'kilo']);
addUnits('oz', 'mass', 28.35, ['ounce', 'ounces']);
addUnits('lb', 'mass', 453.6, ['lbs', 'pound', 'pounds']);
addUnits('ml', 'volume', 1, ['milliliter', 'milliliters', 'millilitre', 'millilitres']);
addUnits('l', 'volume', 1000, ['liter', 'liters', 'litre', 'litres']);
addUnits('tsp', 'volume', 5, ['teaspoon', 'teaspoons', 'tsps']);
addUnits('tbsp', 'volume', 15, ['tablespoon', 'tablespoons', 'tbs', 'tbsps', 'tblsp']);
addUnits('cup', 'volume', 240, ['cups']);
['clove', 'slice', 'can', 'bunch', 'stalk', 'sprig', 'pinch', 'dash', 'handful', 'sheet', 'piece', 'head', 'pack']
  .forEach((u) => addUnits(u, 'count', 1, [`${u}s`, ...(u === 'bunch' ? ['bunches'] : [])]));
['large', 'medium', 'small', 'whole'].forEach((u) => addUnits('piece', 'count', 1, [u]));

const UNICODE_FRACTIONS = { '½': ' 1/2', '¼': ' 1/4', '¾': ' 3/4', '⅓': ' 1/3', '⅔': ' 2/3', '⅛': ' 1/8' };

const DESCRIPTORS = new Set([
  'fresh', 'freshly', 'finely', 'roughly', 'coarsely', 'thinly', 'chopped', 'minced', 'sliced', 'diced',
  'grated', 'crushed', 'peeled', 'boiled', 'cooked', 'uncooked', 'optional', 'extra', 'virgin', 'large',
  'small', 'medium', 'ripe', 'dried', 'frozen', 'good', 'quality', 'softened', 'melted', 'beaten', 'whole',
  'halved', 'cubed', 'shredded', 'toasted', 'roasted', 'plain', 'raw', 'lean', 'boneless', 'skinless',
]);

/** Parse a free-text measure ("1 1/2 cups", "400g/14oz", "to taste") into a number and a unit. */
function parseMeasure(text) {
  const empty = { quantity: null, unit: null, family: null, base: null };
  if (!text || typeof text !== 'string') return empty;

  let s = text.toLowerCase().trim();
  for (const [glyph, plain] of Object.entries(UNICODE_FRACTIONS)) s = s.split(glyph).join(plain);
  s = s.replace(/\s+/g, ' ').trim();

  const m = s.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)(?:\s*-\s*\d+(?:\.\d+)?)?/);
  let quantity = null;
  let rest = s;
  if (m) {
    const token = m[1];
    if (token.includes('/')) {
      const [whole, frac] = token.includes(' ') ? token.split(' ') : ['0', token];
      const [a, b] = frac.split('/').map(Number);
      quantity = b ? Number(whole) + a / b : null;
    } else {
      quantity = Number(token);
    }
    rest = s.slice(m[0].length).trim();
  }

  // The unit is the first word after the number ("200g", "2 tbsp"); "pinch"/"dash" can stand alone.
  const word = (rest.match(/^[a-z]+/) || [''])[0];
  const entry = UNITS[word];
  if (!entry) {
    if (quantity === null) return empty;
    return { quantity, unit: null, family: 'count', base: null };
  }
  if (quantity === null) {
    if (entry[1] !== 'count') return empty;
    quantity = 1; // a bare "pinch" or "handful"
  }
  const [unit, family, factor] = entry;
  return {
    quantity,
    unit: unit === 'piece' ? null : unit,
    family,
    base: family === 'count' ? null : quantity * factor,
  };
}

/** Clean an ingredient name for display and build a dedupe key from it. */
function normalizeName(raw) {
  let s = String(raw || '').toLowerCase();
  s = s.replace(/\([^)]*\)/g, ' ').split(',')[0];
  const words = s.replace(/[^a-z\s'-]/g, ' ').split(/\s+/).filter((w) => w && !DESCRIPTORS.has(w));
  // "garlic cloves" and "garlic" are the same shopping item ("cloves" alone is the spice).
  if (words.length > 1 && /^cloves?$/.test(words[words.length - 1])) words.pop();
  if (words.length === 0) return { display: '', key: '' };

  const display = words.join(' ');
  const last = words[words.length - 1];
  const singularLast = /(ss|us)$/.test(last) ? last : inflector.singularize(last);
  const key = [...words.slice(0, -1), singularLast].join(' ');
  return { display, key };
}

const aisleRe = new Map();
function aisleFor(key) {
  // Stocks, sauces and pastes live in the pantry aisle even when named after a protein ("chicken stock").
  if (/\b(broth|stock|sauce|dashi|paste|powder)\b/.test(key)) return 'pantry';
  for (const [aisle, terms] of AISLES) {
    if (terms.some((t) => {
      let re = aisleRe.get(t);
      if (!re) { re = new RegExp(`\\b${t}\\b`); aisleRe.set(t, re); }
      return re.test(key);
    })) return aisle;
  }
  return 'pantry';
}

function round(n) {
  return Math.round(n * 100) / 100;
}

const PLURAL_UNITS = { clove: 'cloves', slice: 'slices', can: 'cans', bunch: 'bunches', stalk: 'stalks',
  sprig: 'sprigs', handful: 'handfuls', sheet: 'sheets', head: 'heads', pack: 'packs', pinch: 'pinches',
  dash: 'dashes' };

function formatAmount(quantity, unit) {
  if (quantity === null || quantity === undefined) return '';
  if (!unit) return `${round(quantity)}`;
  const label = quantity !== 1 && PLURAL_UNITS[unit] ? PLURAL_UNITS[unit] : unit;
  return `${round(quantity)} ${label}`;
}

/**
 * Merge ingredient lines from several recipes into one de-duplicated shopping list.
 * Each input line: { name, measure } or { name, quantity, unit }.
 * Mass and volume are summed in base units (g / ml) so "200 g" + "0.3 kg" becomes "500 g".
 */
function aggregate(lines) {
  const buckets = new Map();

  for (const line of lines) {
    const { display, key } = normalizeName(line.name);
    if (!key) continue;

    const parsed = line.measure !== undefined
      ? parseMeasure(line.measure)
      : parseMeasure(`${line.quantity ?? ''} ${line.unit ?? ''}`.trim());

    // A cup of flour is weight you buy, not millilitres: known dry/solid foods are converted to
    // grams so "1 cup flour" and "200 g flour" land on the same shopping line.
    const density = DENSITY_G_PER_ML[key];
    if (parsed.family === 'volume' && density && parsed.base !== null) {
      parsed.family = 'mass';
      parsed.base *= density;
    }

    const group = parsed.family === 'count' ? `count:${parsed.unit || ''}` : parsed.family || 'none';
    const id = `${key}|${group}`;
    const bucket = buckets.get(id) || { display, key, group, family: parsed.family, unit: parsed.unit, total: 0, lines: 0, hasQty: false };
    bucket.lines += 1;
    if (parsed.quantity !== null) {
      bucket.hasQty = true;
      bucket.total += parsed.family === 'count' ? parsed.quantity : parsed.base;
    }
    buckets.set(id, bucket);
  }

  // Lines with no quantity ("to taste") fold into an existing row of the same ingredient.
  const rows = [...buckets.values()];
  const withQty = new Map(rows.filter((r) => r.hasQty).map((r) => [r.key, r]));
  const result = [];
  for (const r of rows) {
    if (!r.hasQty && withQty.has(r.key)) {
      withQty.get(r.key).lines += r.lines;
      continue;
    }
    result.push(r);
  }

  return result
    .map((r) => {
      let quantity = null;
      let unit = r.unit;
      if (r.hasQty) {
        quantity = r.total;
        if (r.family === 'mass') {
          [quantity, unit] = r.total >= 1000 ? [r.total / 1000, 'kg'] : [Math.round(r.total / 5) * 5 || r.total, 'g'];
        }
        if (r.family === 'volume') {
          if (r.total >= 1000) [quantity, unit] = [r.total / 1000, 'l'];
          else if (r.total < 15) [quantity, unit] = [Math.round((r.total / 5) * 4) / 4, 'tsp']; // quarters read like a recipe
          else if (r.total < 60) [quantity, unit] = [Math.round((r.total / 15) * 4) / 4, 'tbsp'];
          else [quantity, unit] = [Math.round(r.total), 'ml'];
        }
        quantity = round(quantity);
      }
      return {
        name: r.display,
        quantity,
        unit: unit || null,
        amount: formatAmount(quantity, unit),
        aisle: aisleFor(r.key),
        lines: r.lines,
      };
    })
    .sort((a, b) => a.aisle.localeCompare(b.aisle) || a.name.localeCompare(b.name));
}

module.exports = { parseMeasure, normalizeName, aggregate, aisleFor, formatAmount };
