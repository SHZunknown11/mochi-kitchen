import { h, staticSvg } from './ui.js';
import { dishArt, mochi, palette, ICONS, doodles } from './art.js';
import { state, togglePick } from './state.js';
import { toggleFavourite } from './actions.js';

export const icon = (name) => staticSvg(ICONS[name]);

/** Recipe picture: the API photo when there is one (with an illustrated fallback), else our own art. */
export function artEl(recipe, { eager = false } = {}) {
  const pal = palette(recipe.id);
  const box = h('div', { class: 'art', style: `background:${pal.bg}` });
  box.append(staticSvg(dishArt(recipe)));
  if (recipe.thumb) {
    const img = h('img', {
      src: recipe.thumb, alt: recipe.title, loading: eager ? 'eager' : 'lazy', decoding: 'async',
    });
    img.addEventListener('error', () => img.remove());
    box.append(img);
  }
  return box;
}

export function dietBadges(recipe) {
  const out = [];
  if (recipe.diet.vegan) out.push(h('span', { class: 'badge vegan' }, icon('leaf'), 'Vegan'));
  else if (recipe.diet.vegetarian) out.push(h('span', { class: 'badge veg' }, icon('leaf'), 'Vegetarian'));
  if (recipe.diet.glutenFree) out.push(h('span', { class: 'badge gf' }, icon('wheat'), 'Gluten-free'));
  if (recipe.calories) {
    out.push(h('span', { class: 'badge kcal', title: recipe.caloriesNote === 'AI estimate' ? 'Estimated by AI' : 'Rough estimate from the ingredient list' },
      icon('flame'), `${recipe.calories} kcal ${recipe.caloriesNote === 'AI estimate' ? '(AI est.)' : '(approx.)'}`));
  }
  if (recipe.source === 'gemini') out.push(h('span', { class: 'badge ai' }, icon('sparkles'), 'AI idea'));
  return h('div', { class: 'badge-row' }, out);
}

export function heartButton(recipe) {
  const btn = h('button', {
    class: 'heart', type: 'button', 'aria-pressed': String(Boolean(recipe.isFavourite)),
    'aria-label': `Favourite ${recipe.title}`,
  }, icon(recipe.isFavourite ? 'heartFill' : 'heart'));
  btn.addEventListener('click', async () => {
    const now = await toggleFavourite(recipe);
    if (now === null) return;
    btn.setAttribute('aria-pressed', String(now));
    btn.replaceChildren(icon(now ? 'heartFill' : 'heart'));
    btn.dispatchEvent(new CustomEvent('favourite-changed', { bubbles: true, detail: { recipe, now } }));
  });
  return btn;
}

export function recipeCard(recipe, { selectable = true } = {}) {
  const pick = selectable ? h('label', { class: 'pick' },
    h('input', {
      type: 'checkbox', checked: state.selected.has(recipe.id),
      onChange: (e) => togglePick(recipe, e.target.checked),
    }), 'Add to list') : null;

  return h('article', { class: 'card recipe-card' },
    h('span', { class: 'tape', 'aria-hidden': 'true' }),
    artEl(recipe),
    h('div', { class: 'body' },
      h('h3', {}, h('a', { href: `#/recipe/${recipe.id}` }, recipe.title)),
      h('div', { class: 'meta' }, [recipe.area, recipe.category].filter(Boolean).join(' · ')),
      recipe.summary ? h('p', { class: 'meta' }, recipe.summary) : null,
      dietBadges(recipe),
      h('div', { class: 'actions' }, pick, heartButton(recipe))));
}

export function emptyState(mood, title, text, ...actions) {
  return h('div', { class: 'card empty' },
    staticSvg(mochi(mood, 130)), h('h3', {}, title), text ? h('p', { class: 'muted' }, text) : null,
    actions.length ? h('div', { class: 'row', style: 'justify-content:center' }, actions) : null);
}

export function loading(text = 'Mochi is looking') {
  return h('div', { class: 'loading', role: 'status' },
    staticSvg(mochi('wow', 110)), h('p', { class: 'hand' }, text, h('span', { class: 'dots' })));
}

export function pageHead(title, subtitle, jp) {
  return h('header', { class: 'page-head' },
    staticSvg(doodles()),
    h('h1', {}, title, jp ? h('span', { class: 'hand', style: 'display:block;font-size:.5em' }, jp) : null),
    subtitle ? h('p', {}, subtitle) : null);
}

export function mealThumb(recipe) {
  const pal = palette(recipe.id);
  const box = h('div', { class: 'thumb', style: `background:${pal.bg}` }, staticSvg(dishArt(recipe)));
  if (recipe.thumb) {
    const img = h('img', { src: recipe.thumb, alt: '', loading: 'lazy' });
    img.addEventListener('error', () => img.remove());
    box.append(img);
  }
  return box;
}
