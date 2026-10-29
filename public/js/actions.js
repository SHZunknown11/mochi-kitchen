import { api } from './api.js';
import { state, clearPicks } from './state.js';
import { toast } from './ui.js';

export function requireLogin(message = 'Please log in first.') {
  if (state.user) return true;
  toast(message, 'bad');
  location.hash = `#/login?next=${encodeURIComponent(location.hash.slice(1) || '/')}`;
  return false;
}

/** Flip a recipe's favourite flag. Returns the new value, or null if it did not change. */
export async function toggleFavourite(recipe) {
  if (!requireLogin('Log in to save favourites.')) return null;
  try {
    if (recipe.isFavourite) {
      await api.del(`/favourites/${recipe.id}`);
      recipe.isFavourite = false;
      toast('Removed from favourites');
    } else {
      await api.post('/favourites', { recipeId: recipe.id });
      recipe.isFavourite = true;
      toast('Saved to favourites');
    }
    return recipe.isFavourite;
  } catch (err) {
    toast(err.message, 'bad');
    return null;
  }
}

/** Make a shopping list from recipe ids and open it. */
export async function makeList(recipeIds, name) {
  if (!requireLogin('Log in to make a shopping list.')) return;
  try {
    const { list, stats } = await api.post('/grocery', { recipeIds, name });
    clearPicks();
    toast(`${stats.ingredientLines} ingredients became ${stats.shoppingItems} shopping items`);
    location.hash = `#/lists/${list.id}`;
  } catch (err) {
    toast(err.message, 'bad');
  }
}

export const today = () => new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
