import { api } from '../api.js';
import { h, clear, toast } from '../ui.js';
import { icon, emptyState, loading, pageHead, artEl, dietBadges } from '../components.js';

export async function pantryView(root) {
  const chips = h('div', { class: 'suggestions', 'aria-live': 'polite' });
  const matches = h('div', { 'aria-live': 'polite' });
  const input = h('input', {
    class: 'input', maxlength: 60, placeholder: 'e.g. eggs, rice, kimchi', 'aria-label': 'Add a pantry ingredient',
  });
  let items = [];

  async function loadMatches() {
    clear(matches);
    if (items.length === 0) {
      matches.append(emptyState('sleepy', 'The pantry is empty', 'Add what you have at home and Mochi will suggest what to cook.'));
      return;
    }
    matches.append(loading('Mochi is peeking into your pantry'));
    try {
      const { recipes } = await api.get('/pantry/match');
      clear(matches);
      if (recipes.length === 0) {
        matches.append(emptyState('sad', 'Nothing matches yet', 'Add a few more ingredients, or loosen your dietary profile.'));
        return;
      }
      matches.append(h('h2', {}, 'You could cook'),
        h('div', { class: 'grid' }, recipes.map((r) => h('article', { class: 'card recipe-card' },
          h('span', { class: 'tape', 'aria-hidden': 'true' }),
          artEl(r),
          h('div', { class: 'body' },
            h('h3', {}, h('a', { href: `#/recipe/${r.id}` }, r.title)),
            h('div', { class: 'coverage' },
              h('div', { class: 'progress', role: 'progressbar', 'aria-valuenow': Math.round(r.coverage * 100), 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': 'Ingredients you already have' },
                h('span', { style: `width:${r.coverage * 100}%` })),
              h('strong', {}, `${Math.round(r.coverage * 100)}%`)),
            r.missing.length
              ? h('div', {}, h('p', { class: 'hint' }, 'You still need:'), h('div', { class: 'missing' }, r.missing.map((m) => h('span', { class: 'chip' }, m))))
              : h('p', { class: 'hand' }, 'You have everything!'),
            dietBadges(r))))));
    } catch (err) {
      clear(matches).append(emptyState('sad', 'Could not check the pantry', err.message));
    }
  }

  function drawChips() {
    clear(chips);
    items.forEach((it) => chips.append(h('button', {
      class: 'chip removable', type: 'button', 'aria-label': `Remove ${it.name}`,
      onClick: async () => {
        try { await api.del(`/pantry/${it.id}`); items = items.filter((x) => x.id !== it.id); drawChips(); loadMatches(); } catch (err) { toast(err.message, 'bad'); }
      },
    }, it.name, icon('close'))));
  }

  async function add() {
    const name = input.value.trim();
    if (name.length < 2) return;
    try {
      const { item } = await api.post('/pantry', { name });
      if (!items.some((x) => x.id === item.id)) items.push(item);
      items.sort((a, b) => a.name.localeCompare(b.name));
      input.value = '';
      drawChips();
      loadMatches();
    } catch (err) {
      toast(err.message, 'bad');
    }
  }

  root.append(h('section', { class: 'page' },
    pageHead('My pantry', 'Tell Mochi what is already in your kitchen. Salt, water and pepper are always assumed.', '冷蔵庫 · 냉장고'),
    h('div', { class: 'card' },
      h('form', { class: 'bubble-input', onSubmit: (e) => { e.preventDefault(); add(); } },
        input, h('button', { class: 'btn', type: 'submit' }, icon('plus'), 'Add')),
      chips),
    h('div', { style: 'margin-top:20px' }, matches)));

  try {
    ({ items } = await api.get('/pantry'));
  } catch (err) {
    toast(err.message, 'bad');
  }
  drawChips();
  loadMatches();
}
