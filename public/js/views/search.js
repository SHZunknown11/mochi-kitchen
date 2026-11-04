import { api } from '../api.js';
import { h, clear, toast, plural, staticSvg } from '../ui.js';
import { state } from '../state.js';
import { icon, recipeCard, emptyState, loading } from '../components.js';
import { mountReact } from '../react.js';
import { KitchenLiveBar } from '../kitchenVibe.js';

const SUGGESTIONS = [
  'cozy japanese dinner',
  'spicy vegan kimchi',
  'a rich chocolate dessert',
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
      if (!memo.text) { toast('Describe a dish or craving to get started.', 'bad'); textInput.focus(); return; }
      body.query = memo.text;
    }
    if (memo.mode === 'ingredients') {
      if (memo.ingredients.length === 0) { toast('Add at least one ingredient.', 'bad'); ingInput.focus(); return; }
      body.ingredients = memo.ingredients;
    }
    clear(results).append(loading(memo.provider === 'ai' ? 'Generating recipe ideas' : 'Searching the recipe collection'));
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
        ? 'AI suggestions are unavailable right now. Showing recipes from the free collection.'
        : 'The free recipe service is unavailable. Showing recipes already in the collection.';
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
      results.append(h('p', { class: 'understood' }, 'Matched: ',
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
        providerBtn('ai', 'AI suggestions', 'sparkles', !state.aiConfigured,
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

  const kitchenBarHost = h('div', { class: 'kitchen-live-bar-container' });
  mountReact(KitchenLiveBar, kitchenBarHost);

  root.append(h('section', { class: 'page' },
    h('div', { class: 'hero' },
      h('div', { class: 'hero-copy' },
        h('h1', {}, 'What’s hitting the pan tonight?'),
        h('p', { class: 'muted' }, 'Name the craving, empty the fridge, or set your macros. We’ll find the meal.')),
      staticSvg(`<svg class="skillet" viewBox="0 0 320 220" aria-hidden="true">
<g class="steam" fill="none" stroke="#EDE6DA" stroke-width="5" stroke-linecap="round" opacity=".55"><path d="M120 70c-14-14 14-22 0-38"/><path d="M160 64c-14-14 14-22 0-38"/><path d="M200 70c-14-14 14-22 0-38"/></g>
<ellipse cx="150" cy="176" rx="118" ry="16" fill="#000" opacity=".35"/>
<path d="M36 112h228l-14 52a30 30 0 0 1-29 22H79a30 30 0 0 1-29-22z" fill="#2A2522" stroke="#4A423C" stroke-width="3"/>
<ellipse cx="150" cy="112" rx="114" ry="20" fill="#14110F" stroke="#4A423C" stroke-width="3"/>
<path d="M262 112l54-8c6 0 6 14 0 16l-54 6z" fill="#2A2522" stroke="#4A423C" stroke-width="3"/>
<path d="M80 108c8-16 40-22 70-20s58 6 66 20c-8 10-40 16-70 16s-58-6-66-16z" fill="#7A2E1B"/>
<path d="M92 108c10-10 36-14 58-13s46 4 56 13" fill="none" stroke="#C4572B" stroke-width="4" stroke-linecap="round"/>
<path d="M104 112l22 4M132 110l22 5M160 110l22 4" stroke="#14110F" stroke-width="4" stroke-linecap="round"/>
<g class="flame"><path d="M70 186c-22-18-8-40 4-50 0 12 10 16 14 8 4 14 18 22 12 42-4 8-22 8-30 0z" fill="#E8531F"/><path d="M76 186c-10-10-2-22 6-28 0 8 6 10 9 5 2 8 9 12 5 22-3 5-15 5-20 1z" fill="#F4A62A"/></g>
<g class="flame f2"><path d="M232 190c-20-16-6-38 6-46 0 10 8 14 12 7 4 12 16 20 10 38-4 7-20 7-28 1z" fill="#E8531F"/><path d="M238 190c-9-9-1-20 6-25 0 7 5 9 8 4 2 7 8 11 4 20-3 4-14 4-18 1z" fill="#F4A62A"/></g>
</svg>`)),
    kitchenBarHost,
    h('div', { class: 'card searchbox' }, tabsEl, panels.text, panels.ingredients, panels.diet, filterBox),
    results));

  if (memo.results) showResults();
}
