import { api } from '../api.js';
import { h, clear, toast } from '../ui.js';
import { state } from '../state.js';
import { icon, emptyState, loading, pageHead, mealThumb } from '../components.js';
import { makeList } from '../actions.js';

export async function plannerView(root) {
  const out = h('div', { 'aria-live': 'polite' });
  const opts = { days: 7, provider: 'free', usePantry: false };

  function draw(plan) {
    clear(out);
    if (!plan) {
      out.append(emptyState('sleepy', 'No plan yet', 'Choose how many days and press the button. Your dietary profile is used automatically.'));
      return;
    }
    const ids = [...new Set(plan.plan.flatMap((d) => [d.lunch && d.lunch.id, d.dinner && d.dinner.id]).filter(Boolean))];
    out.append(
      h('div', { class: 'row' },
        h('span', { class: plan.generatedBy === 'ai' ? 'badge ai' : 'badge' }, icon(plan.generatedBy === 'ai' ? 'sparkles' : 'calendar'),
          plan.generatedBy === 'ai' ? 'Planned by Mochi AI' : 'Planned from the free recipe box'),
        h('button', { class: 'btn green', type: 'button', onClick: () => makeList(ids, `Meal plan shopping (${plan.days} days)`) },
          icon('list'), 'Make a shopping list for this plan')),
      h('div', { class: 'week' }, plan.plan.map((d) => h('article', { class: `card day-card ${d.day % 2 ? 'tinted' : 'lav'}` },
        h('h3', {}, `Day ${d.day}`),
        d.note ? h('p', { class: 'note' }, d.note) : null,
        ...[['Lunch', d.lunch], ['Dinner', d.dinner]].map(([label, r]) => (r
          ? h('a', { class: 'meal', href: `#/recipe/${r.id}` }, mealThumb(r),
            h('span', {}, h('small', {}, label), r.title, r.calories ? h('small', {}, `${r.calories} kcal approx.`) : null))
          : null))))));
  }

  async function generate(button) {
    button.disabled = true;
    clear(out).append(loading(opts.provider === 'ai' ? 'Mochi is planning your week with AI' : 'Mochi is planning your week'));
    try {
      draw(await api.post('/mealplan', opts));
    } catch (err) {
      clear(out).append(emptyState('sad', 'Could not plan', err.message));
      toast(err.message, 'bad');
    } finally {
      button.disabled = false;
    }
  }

  const btn = h('button', { class: 'btn', type: 'button' }, icon('calendar'), 'Plan my meals');
  btn.addEventListener('click', () => generate(btn));

  const prefs = state.user.dietPrefs;
  const prefText = [prefs.diet !== 'none' ? prefs.diet : null, prefs.glutenFree ? 'gluten-free' : null,
    prefs.maxCalories ? `under ${prefs.maxCalories} kcal` : null].filter(Boolean).join(', ') || 'no restrictions';

  root.append(h('section', { class: 'page' },
    pageHead('Meal planner', `Lunch and dinner for your week. Your profile: ${prefText}.`, '献立 · 식단'),
    h('div', { class: 'card' }, h('div', { class: 'row' },
      h('label', { class: 'field grow', style: 'margin:0' }, 'Days',
        h('select', { class: 'input', onChange: (e) => { opts.days = Number(e.target.value); } },
          [3, 4, 5, 6, 7].map((n) => h('option', { value: n, selected: n === opts.days }, `${n} days`)))),
      h('div', { class: 'provider', role: 'group', 'aria-label': 'Planner source' },
        h('button', { type: 'button', 'aria-pressed': 'true', id: 'pf', onClick: (e) => { opts.provider = 'free'; e.currentTarget.setAttribute('aria-pressed', 'true'); root.querySelector('#pa').setAttribute('aria-pressed', 'false'); } }, icon('calendar'), 'Free'),
        h('button', {
          type: 'button', 'aria-pressed': 'false', id: 'pa', disabled: !state.aiConfigured,
          title: state.aiConfigured ? '' : 'AI mode is not switched on (no Gemini key set)',
          onClick: (e) => { opts.provider = 'ai'; e.currentTarget.setAttribute('aria-pressed', 'true'); root.querySelector('#pf').setAttribute('aria-pressed', 'false'); },
        }, icon('sparkles'), 'Mochi AI')),
      h('label', { class: 'pick' }, h('input', { type: 'checkbox', onChange: (e) => { opts.usePantry = e.target.checked; } }), 'Prefer my pantry'),
      btn)),
    h('div', { style: 'margin-top:18px' }, out)));

  try {
    const { plan } = await api.get('/mealplan');
    draw(plan);
  } catch {
    draw(null);
  }
}
