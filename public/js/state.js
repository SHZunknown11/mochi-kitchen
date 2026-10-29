// Small shared state: who is logged in, whether the AI is configured, and which recipes
// the visitor has ticked for a shopping list.

export const state = {
  user: null,
  aiConfigured: false,
  selected: new Map(), // recipe id -> title
};

const listeners = new Set();
export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const notify = () => listeners.forEach((fn) => fn());

export function setUser(user) {
  state.user = user;
  notify();
}

export function togglePick(recipe, on) {
  if (on) state.selected.set(recipe.id, recipe.title);
  else state.selected.delete(recipe.id);
  notify();
}

export function clearPicks() {
  state.selected.clear();
  notify();
}
