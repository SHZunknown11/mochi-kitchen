import { api } from '../api.js';
import { h, clear, staticSvg, toast, plural } from '../ui.js';
import { state } from '../state.js';
import { mochi } from '../art.js';
import { icon, recipeCard, emptyState, loading } from '../components.js';

const SUGGESTIONS = [
  'cozy japanese dinner',
  'spicy vegan kimchi',
  'something sweet and cute',
  'chicken and rice under 600 calories',
  'gluten free noodles',
  'quick egg breakfast',
];

// Remembered while the visitor moves around the app.
const memo = { mode: 'text', provider: 'free', text: '', ingredients: [], diet: null, results: null };

export function searchView(root) {
  if (!memo.diet) memo.diet = { ...(state.user ? state.user.dietPrefs : { diet: 'none', glutenFree: false, maxCalories: null }) };

  const results = h('div', { 'aria-live': 'polite' });
  const textInput = h('input', {
    class: 'input', id: 'q', type: 'search', maxlength: 200, value: memo.text, autocomplete: 'off',
    placeholder: 'e.g. something spicy with tofu and kimchi, vegan', 'aria-label': 'Describe what you want to eat',
  });
  const ingInput = h('input', {
    class: 'input', type: 'text', maxlength: 40, placeholder: 'Type an ingredient and press Enter', 'aria-label': 'Add an ingredient',
  });
  const chipBox = h('div', { class: 'suggestions' });
  const filterBox = h('div', { class: 'filters' });
  const panels = {};

  async function run() {
    const body = { mode: memo.mode, provider: memo.provider, diet: memo.diet };
    if (memo.mode === 'text') {
      memo.text = textInput.value.trim();
      if (!memo.text) { toast('Tell Mochi what you feel like eating first.', 'bad'); textInput.focus(); return; }
      body.query = memo.text;
    }
    if (memo.mode === 'ingredients') {
      if (memo.ingredients.length === 0) { toast('Add at least one ingredient.', 'bad'); ingInput.focus(); return; }
      body.ingredients = memo.ingredients;
    }
    clear(results).append(loading(memo.provider === 'ai' ? 'Mochi is asking the AI chef' : 'Mochi is rummaging through the recipe box'));
    try {
      memo.results = await api.post('/search', body);
      showResults();
    } catch (err) {
      clear(results).append(emptyState('sad', 'Oh no, that did not work', err.message));
    }
  }

  function showResults() {
    clear(results);
    const data = memo.results;
    if (!data) return;

    for (const code of data.notices) {
      const text = code === 'ai-unavailable'
        ? 'The AI chef is napping right now, so these are from the free recipe books.'
        : 'The free recipe service is not answering, so only recipes we already have are shown.';
      results.append(h('div', { class: 'notice', role: 'status' }, icon('sparkles'), text));
    }

    const p = data.parsed;
    const heard = [...p.ingredients, ...p.cuisines, ...p.mealTypes, ...p.flavours].slice(0, 8);
    const prefsText = [
      data.prefs.diet !== 'none' ? data.prefs.diet : null,
      data.prefs.glutenFree ? 'gluten-free' : null,
      data.prefs.maxCalories ? `under ${data.prefs.maxCalories} kcal` : null,
    ].filter(Boolean);
    if (heard.length || prefsText.length) {
      results.append(h('p', { class: 'understood' }, 'Mochi understood: ',
        ...[...heard, ...prefsText].flatMap((w, i) => [i ? ', ' : '', h('b', {}, w)])));
    }

    if (data.results.length === 0) {
      results.append(emptyState('sad', 'No recipes found', 'Try fewer words, a different ingredient, or loosen a filter.'));
      return;
    }
    results.append(h('p', { class: 'hand' }, `${plural(data.results.length, 'recipe')} for you`));
    results.append(h('div', { class: 'grid' }, data.results.map((r) => recipeCard(r))));
  }

  // ---- filters ----------------------------------------------------------
  function drawFilters() {
    clear(filterBox);
    const toggle = (label, ico, active, onClick) => h('button', {
      class: 'chip', type: 'button', 'aria-pressed': String(active), onClick,
    }, icon(ico), label);

    const kcalLabel = h('span', {}, memo.diet.maxCalories ? `Up to ${memo.diet.maxCalories} kcal` : 'Any calories');
    const slider = h('input', {
      type: 'range', min: 200, max: 1000, step: 50, value: memo.diet.maxCalories || 1000, 'aria-label': 'Maximum calories per serving',
      onInput: (e) => {
        const v = Number(e.target.value);
        memo.diet.maxCalories = v >= 1000 ? null : v;
        kcalLabel.textContent = memo.diet.maxCalories ? `Up to ${v} kcal` : 'Any calories';
      },
    });

    const providerBtn = (value, label, ico, disabled = false, title = '') => h('button', {
      type: 'button', 'aria-pressed': String(memo.provider === value), disabled, title,
      onClick: () => { memo.provider = value; drawFilters(); },
    }, icon(ico), label);

    filterBox.append(
      toggle('Vegetarian', 'leaf', memo.diet.diet === 'vegetarian', () => { memo.diet.diet = memo.diet.diet === 'vegetarian' ? 'none' : 'vegetarian'; drawFilters(); }),
      toggle('Vegan', 'leaf', memo.diet.diet === 'vegan', () => { memo.diet.diet = memo.diet.diet === 'vegan' ? 'none' : 'vegan'; drawFilters(); }),
      toggle('Gluten-free', 'wheat', memo.diet.glutenFree, () => { memo.diet.glutenFree = !memo.diet.glutenFree; drawFilters(); }),
      h('label', { class: 'kcal' }, icon('flame'), slider, kcalLabel),
      h('div', { class: 'provider', role: 'group', 'aria-label': 'Recipe source' },
        providerBtn('free', 'Free recipes', 'search'),
        providerBtn('ai', 'Mochi AI', 'sparkles', !state.aiConfigured,
          state.aiConfigured ? 'Ask the Gemini AI chef for ideas' : 'AI mode is not switched on (no Gemini key set)')),
    );
  }

  function drawIngredients() {
    clear(chipBox);
    memo.ingredients.forEach((name, i) => chipBox.append(h('button', {
      class: 'chip removable', type: 'button', 'aria-label': `Remove ${name}`,
      onClick: () => { memo.ingredients.splice(i, 1); drawIngredients(); },
    }, name, icon('close'))));
  }

  function addIngredient() {
    const v = ingInput.value.trim().toLowerCase();
    if (v.length < 2) return;
    if (!memo.ingredients.includes(v) && memo.ingredients.length < 10) memo.ingredients.push(v);
    ingInput.value = '';
    drawIngredients();
  }

  // ---- tabs -------------------------------------------------------------
  const tabsEl = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'How do you want to search?' });
  const TABS = [['text', 'Describe it'], ['ingredients', 'I have these'], ['diet', 'Just browse']];
  function drawTabs() {
    clear(tabsEl);
    TABS.forEach(([id, label]) => tabsEl.append(h('button', {
      class: 'tab', role: 'tab', type: 'button', 'aria-selected': String(memo.mode === id),
      onClick: () => { memo.mode = id; drawTabs(); drawPanels(); },
    }, label)));
  }
  function drawPanels() {
    for (const [id, el] of Object.entries(panels)) el.hidden = id !== memo.mode;
  }

  panels.text = h('div', {},
    h('form', { class: 'bubble-input', onSubmit: (e) => { e.preventDefault(); run(); } },
      textInput, h('button', { class: 'btn', type: 'submit' }, icon('search'), 'Find recipes')),
    h('div', { class: 'suggestions' }, h('span', { class: 'hand' }, 'Try:'),
      SUGGESTIONS.map((s) => h('button', {
        class: 'chip', type: 'button', onClick: () => { textInput.value = s; run(); },
      }, s))));

  panels.ingredients = h('div', {},
    h('form', { class: 'bubble-input', onSubmit: (e) => { e.preventDefault(); if (ingInput.value.trim()) addIngredient(); else run(); } },
      ingInput, h('button', { class: 'btn ghost', type: 'button', onClick: addIngredient }, icon('plus'), 'Add'),
      h('button', { class: 'btn', type: 'button', onClick: run }, icon('search'), 'Find recipes')),
    chipBox);

  panels.diet = h('div', {},
    h('p', { class: 'hand' }, 'Pick your filters below, then browse everything that fits.'),
    h('button', { class: 'btn', type: 'button', onClick: run }, icon('search'), 'Show recipes'));

  drawTabs(); drawPanels(); drawFilters(); drawIngredients();

  root.append(h('section', { class: 'page' },
    h('div', { class: 'hero' },
      h('div', {},
        h('h1', {}, h('span', { class: 'jp' }, '오늘 뭐 먹지? · 今日は何を食べる？'), 'What shall we cook today?'),
        h('p', { class: 'muted' }, 'Describe a craving, list what is in your fridge, or just set your diet. Mochi finds matching recipes.')),
      staticSvg(mochi('smile', 190))),
    h('div', { class: 'card searchbox' }, tabsEl, panels.text, panels.ingredients, panels.diet, filterBox),
    results));

  if (memo.results) showResults();
}
