import { api } from '../api.js';
import { h, clear, staticSvg } from '../ui.js';
import { state, togglePick } from '../state.js';
import { mochi } from '../art.js';
import { icon, artEl, dietBadges, heartButton, emptyState, loading } from '../components.js';
import { makeList, today } from '../actions.js';

export async function recipeView(root, { id }) {
  root.append(loading('Mochi is opening the recipe book'));
  let recipe;
  try {
    recipe = await api.get(`/recipes/${encodeURIComponent(id)}`);
  } catch (err) {
    clear(root).append(emptyState('sad', 'Recipe not found', err.message,
      h('a', { class: 'btn', href: '#/' }, icon('back'), 'Back to search')));
    return;
  }

  const drinkBox = h('div', { class: 'card lav' }, h('h3', {}, 'Drink pairing'), h('p', { class: 'muted' }, 'Looking for a tasty drink...'));
  api.get(`/recipes/${recipe.id}/pairing`).then(({ drink }) => {
    clear(drinkBox).append(h('h3', {}, 'Drink pairing'));
    if (!drink) { drinkBox.append(h('p', { class: 'muted' }, 'No drink suggestion right now.')); return; }
    drinkBox.append(h('div', { class: 'drink' },
      drink.thumb ? h('img', { src: drink.thumb, alt: drink.name, loading: 'lazy' }) : null,
      h('div', {},
        h('strong', {}, drink.name),
        h('p', { class: 'muted' }, drink.ingredients.map((i) => i.name).slice(0, 5).join(', ')),
        h('span', { class: 'badge' }, icon('cup'), 'Non-alcoholic'))));
  }).catch(() => clear(drinkBox).append(h('h3', {}, 'Drink pairing'), h('p', { class: 'muted' }, 'No drink suggestion right now.')));

  const picked = state.selected.has(recipe.id);
  clear(root).append(h('section', { class: 'page' },
    h('a', { href: '#/', class: 'btn ghost small' }, icon('back'), 'Back'),
    h('div', { class: 'recipe-hero', style: 'margin-top:14px' },
      artEl(recipe, { eager: true }),
      h('div', { class: 'stack' },
        h('h1', {}, recipe.title),
        h('p', { class: 'hand' }, [recipe.area, recipe.category].filter(Boolean).join(' · ')),
        recipe.summary ? h('p', {}, recipe.summary) : null,
        dietBadges(recipe),
        h('p', { class: 'hint' }, 'Diet tags come from the ingredient names, so check labels for hidden ingredients. Calories are only an estimate.'),
        h('div', { class: 'row' },
          heartButton(recipe),
          h('button', { class: 'btn green', type: 'button', onClick: () => makeList([recipe.id], `${recipe.title} (${today()})`) },
            icon('list'), 'Shopping list for this'),
          h('label', { class: 'pick' }, h('input', {
            type: 'checkbox', checked: picked, onChange: (e) => togglePick(recipe, e.target.checked),
          }), 'Add to a bigger list'),
          recipe.youtube ? h('a', { class: 'btn ghost small', href: recipe.youtube, target: '_blank', rel: 'noopener noreferrer' }, 'Watch video') : null))),
    h('div', { class: 'two-col' },
      h('div', { class: 'stack' },
        h('div', { class: 'card matcha' },
          h('h2', {}, 'Ingredients'),
          h('ul', { class: 'ingredients' }, recipe.ingredients.map((i) => h('li', {},
            h('span', {}, i.name), h('span', { class: 'qty' }, i.measure || ''))))),
        drinkBox),
      h('div', { class: 'card' },
        h('h2', {}, 'Method'),
        h('ol', { class: 'steps' }, recipe.steps.map((s) => h('li', {}, s))),
        h('div', { class: 'row', style: 'justify-content:center;margin-top:8px' },
          staticSvg(mochi('happy', 90)), h('span', { class: 'hand' }, 'いただきます! 맛있게 드세요!'))))));
}
