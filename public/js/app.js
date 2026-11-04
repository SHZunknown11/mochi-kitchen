import { api, hasSession, session } from './api.js';
import { h, clear } from './ui.js';
import { state, setUser, subscribe, clearPicks } from './state.js';
import { icon, emptyState } from './components.js';
import { makeList, today } from './actions.js';
import { mountReact } from './react.js';
import { FloatingKitchenAmbiance } from './kitchenVibe.js';
import { searchView } from './views/search.js';
import { recipeView } from './views/recipe.js';
import { favouritesView } from './views/favourites.js';
import { listsView, listDetailView } from './views/lists.js';
import { pantryView } from './views/pantry.js';
import { plannerView } from './views/planner.js';
import { loginView, profileView } from './views/auth.js';

const routes = [
  { re: /^\/$/, view: searchView, title: 'Find recipes', nav: '/' },
  { re: /^\/recipe\/(\d+)$/, keys: ['id'], view: recipeView, title: 'Recipe', nav: '/' },
  { re: /^\/favourites$/, view: favouritesView, auth: true, title: 'Favourites', nav: '/favourites' },
  { re: /^\/pantry$/, view: pantryView, auth: true, title: 'Pantry', nav: '/pantry' },
  { re: /^\/planner$/, view: plannerView, auth: true, title: 'Meal planner', nav: '/planner' },
  { re: /^\/lists$/, view: listsView, auth: true, title: 'Shopping lists', nav: '/lists' },
  { re: /^\/lists\/(\d+)$/, keys: ['id'], view: listDetailView, auth: true, title: 'Shopping list', nav: '/lists' },
  { re: /^\/login$/, view: loginView, title: 'Log in', nav: null },
  { re: /^\/profile$/, view: profileView, auth: true, title: 'Profile', nav: null },
];

const NAV = [
  ['/', 'search', 'Search'], ['/favourites', 'heart', 'Favourites'], ['/pantry', 'pantry', 'Pantry'],
  ['/planner', 'calendar', 'Planner'], ['/lists', 'list', 'Lists'],
];

const main = h('main', { id: 'main', tabindex: '-1' });
const mainNav = h('nav', { class: 'nav main', 'aria-label': 'Main' });
const userNav = h('nav', { class: 'nav', 'aria-label': 'Account' });
const cartBar = h('div', { 'aria-live': 'polite' });

function drawNav(active) {
  clear(mainNav).append(...NAV.map(([path, ico, label]) => h('a', {
    href: `#${path}`, 'aria-current': active === path ? 'page' : null,
  }, icon(ico), label)));
}

function drawUser() {
  clear(userNav);
  if (state.user) {
    userNav.append(h('a', { href: '#/profile', title: 'Your profile' }, icon('user'), state.user.username));
  } else {
    userNav.append(h('a', { href: '#/login' }, icon('user'), 'Log in'));
  }
}

function drawCart() {
  clear(cartBar);
  if (state.selected.size === 0) return;
  const ids = [...state.selected.keys()];
  cartBar.append(h('div', { class: 'cart-bar' },
    h('span', {}, h('strong', {}, `${ids.length} ${ids.length === 1 ? 'recipe' : 'recipes'}`), ' picked'),
    h('button', { class: 'btn small', type: 'button', onClick: () => makeList(ids, `Shopping list ${today()}`) }, icon('list'), 'Make shopping list'),
    h('button', { class: 'btn ghost small', type: 'button', 'aria-label': 'Clear picks', onClick: () => { clearPicks(); render(); } }, icon('close'))));
}

function parseHash() {
  const raw = location.hash.slice(1) || '/';
  const [path, query = ''] = raw.split('?');
  return { path: path.replace(/\/+$/, '') || '/', query };
}

async function render() {
  const { path, query } = parseHash();
  const route = routes.find((r) => r.re.test(path));
  clear(main);

  if (!route) {
    main.append(emptyState('sad', 'That page is lost', 'Mochi looked everywhere but could not find it.',
      h('a', { class: 'btn', href: '#/' }, icon('back'), 'Back home')));
    drawNav(null);
    return;
  }
  if (route.auth && !state.user) {
    location.hash = `#/login?next=${encodeURIComponent(path)}`;
    return;
  }

  const match = path.match(route.re);
  const params = Object.fromEntries((route.keys || []).map((k, i) => [k, match[i + 1]]));
  document.title = `${route.title} · Mochi Kitchen`;
  drawNav(route.nav);
  await route.view(main, params, query);
  main.focus({ preventScroll: true });
  window.scrollTo({ top: 0 });
}

function buildShell() {
  const app = document.getElementById('app');
  const ambianceHost = h('div', { id: 'floating-ambiance-host' });
  app.append(
    h('a', { class: 'skip-link', href: '#main' }, 'Skip to content'),
    ambianceHost,
    h('div', { class: 'shell' },
      h('header', { class: 'topbar' },
        h('a', { class: 'brand', href: '#/', 'aria-label': 'Mochi Kitchen home' },
          h('span', { class: 'brand-mark', 'aria-hidden': 'true' }, 'MK'),
          h('span', {}, h('span', { class: 'brand-name' }, 'Mochi Kitchen'), h('span', { class: 'brand-jp' }, 'Recipe studio'))),
        userNav, mainNav),
      main,
      h('footer', { class: 'foot' }, 'Thoughtful cooking. Better meals.')),
    cartBar);
  mountReact(FloatingKitchenAmbiance, ambianceHost);
}

async function start() {
  buildShell();
  subscribe(() => { drawUser(); drawCart(); });
  window.addEventListener('hashchange', render);
  window.addEventListener('mochi:logout', () => { setUser(null); location.hash = '#/login'; });

  try {
    state.aiConfigured = (await api.get('/ai/status')).configured;
  } catch { /* server down: views show their own errors */ }

  if (hasSession()) {
    try {
      setUser((await api.get('/auth/me')).user);
    } catch (err) {
      // Only a rejected login ends the session; a network blip must not log people out.
      if (err.status === 401) session.clear();
    }
  }
  drawUser();
  drawCart();
  await render();
}

start();
