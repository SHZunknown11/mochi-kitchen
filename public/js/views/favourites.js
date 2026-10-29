import { api } from '../api.js';
import { h, clear } from '../ui.js';
import { icon, recipeCard, emptyState, loading, pageHead } from '../components.js';

export async function favouritesView(root) {
  const body = h('div', { 'aria-live': 'polite' }, loading('Mochi is fetching your favourites'));
  root.append(h('section', { class: 'page' }, pageHead('Your favourites', 'Recipes you saved with a heart.', 'お気に入り · 즐겨찾기'), body));

  let favourites;
  try {
    ({ favourites } = await api.get('/favourites'));
  } catch (err) {
    clear(body).append(emptyState('sad', 'Could not load favourites', err.message));
    return;
  }

  const draw = () => {
    clear(body);
    if (favourites.length === 0) {
      body.append(emptyState('sleepy', 'Nothing here yet', 'Tap the heart on a recipe and it will wait for you here.',
        h('a', { class: 'btn', href: '#/' }, icon('search'), 'Find recipes')));
      return;
    }
    const grid = h('div', { class: 'grid' }, favourites.map((r) => recipeCard(r)));
    // When a heart is switched off, drop that card from the page.
    grid.addEventListener('favourite-changed', (e) => {
      if (!e.detail.now) {
        favourites = favourites.filter((r) => r.id !== e.detail.recipe.id);
        draw();
      }
    });
    body.append(grid);
  };
  draw();
}
