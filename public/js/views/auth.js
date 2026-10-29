import { login, register, logout } from '../api.js';
import { api } from '../api.js';
import { h, clear, staticSvg, toast } from '../ui.js';
import { setUser, state } from '../state.js';
import { mochi } from '../art.js';
import { icon, pageHead } from '../components.js';

function safeNext(query) {
  const next = new URLSearchParams(query).get('next') || '/';
  return next.startsWith('/') && !next.startsWith('//') ? `#${next}` : '#/';
}

export function loginView(root, _params, query) {
  let mode = 'login';
  const form = h('form', { class: 'card', novalidate: true });
  const art = h('div', { class: 'auth-art' }, staticSvg(mochi('happy', 260)), h('p', { class: 'hand' }, 'おかえり! 어서 와요!'));

  function draw() {
    const error = h('p', { class: 'error-text', role: 'alert' });
    const field = (id, label, type, extra = {}) => h('div', { class: 'field' },
      h('label', { for: id }, label), h('input', { class: 'input', id, name: id, type, required: true, ...extra }));
    clear(form).append(
      h('h2', {}, mode === 'login' ? 'Welcome back' : 'Join Mochi Kitchen'),
      mode === 'register' ? field('username', 'Username', 'text', { autocomplete: 'username', minlength: 3, maxlength: 30 }) : null,
      mode === 'register'
        ? field('email', 'Email', 'email', { autocomplete: 'email' })
        : field('identifier', 'Email or username', 'text', { autocomplete: 'username' }),
      field('password', 'Password', 'password', { autocomplete: mode === 'login' ? 'current-password' : 'new-password', minlength: mode === 'register' ? 8 : 1 }),
      mode === 'register' ? h('p', { class: 'hint' }, 'At least 8 characters, with a letter and a number.') : null,
      error,
      h('div', { class: 'row' },
        h('button', { class: 'btn', type: 'submit' }, mode === 'login' ? 'Log in' : 'Create account'),
        h('button', {
          class: 'btn ghost', type: 'button',
          onClick: () => { mode = mode === 'login' ? 'register' : 'login'; draw(); },
        }, mode === 'login' ? 'I need an account' : 'I already have one')));

    form.onsubmit = async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      error.textContent = '';
      try {
        const user = mode === 'login'
          ? await login(data.identifier, data.password)
          : await register(data.username, data.email, data.password);
        setUser(user);
        toast(`Welcome, ${user.username}!`);
        location.hash = safeNext(query);
      } catch (err) {
        error.textContent = err.message;
      }
    };
  }
  draw();
  root.append(h('section', { class: 'page' }, h('div', { class: 'auth-grid' }, art, form)));
}

export function profileView(root) {
  const prefs = { ...state.user.dietPrefs };
  const msg = h('p', { class: 'hint', role: 'status' });
  const options = h('div', { class: 'filters' });
  const kcalLabel = h('span', {});

  function draw() {
    clear(options);
    const pick = (label, value) => h('button', {
      class: 'chip', type: 'button', 'aria-pressed': String(prefs.diet === value), onClick: () => { prefs.diet = value; draw(); },
    }, label);
    kcalLabel.textContent = prefs.maxCalories ? `Up to ${prefs.maxCalories} kcal per serving` : 'No calorie limit';
    options.append(
      pick('No preference', 'none'), pick('Vegetarian', 'vegetarian'), pick('Vegan', 'vegan'),
      h('button', {
        class: 'chip', type: 'button', 'aria-pressed': String(prefs.glutenFree),
        onClick: () => { prefs.glutenFree = !prefs.glutenFree; draw(); },
      }, icon('wheat'), 'Gluten-free'));
  }
  draw();

  const slider = h('input', {
    type: 'range', min: 200, max: 1000, step: 50, value: prefs.maxCalories || 1000, 'aria-label': 'Maximum calories per serving',
    onInput: (e) => { const v = Number(e.target.value); prefs.maxCalories = v >= 1000 ? null : v; draw(); },
  });

  root.append(h('section', { class: 'page' },
    pageHead(`Hello, ${state.user.username}`, 'Your dietary profile pre-filters every search and meal plan.', 'プロフィール · 프로필'),
    h('div', { class: 'card stack' },
      h('h2', {}, 'Dietary profile'), options,
      h('label', { class: 'field' }, kcalLabel, slider),
      h('div', { class: 'row' },
        h('button', {
          class: 'btn', type: 'button',
          onClick: async () => {
            try {
              const { user } = await api.patch('/auth/me', { dietPrefs: prefs });
              setUser(user);
              msg.textContent = 'Saved. Mochi will remember.';
              toast('Profile saved');
            } catch (err) { msg.textContent = err.message; }
          },
        }, icon('check'), 'Save profile'),
        h('button', {
          class: 'btn ghost', type: 'button',
          onClick: async () => { await logout(); setUser(null); toast('See you soon!'); location.hash = '#/'; },
        }, 'Log out')),
      msg)));
}
