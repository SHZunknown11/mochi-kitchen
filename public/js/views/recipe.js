import { api } from '../api.js';
import { h, clear } from '../ui.js';
import { state, togglePick } from '../state.js';
import { icon, artEl, dietBadges, heartButton, emptyState, loading } from '../components.js';
import { makeList, today } from '../actions.js';
import { mountReact } from '../react.js';
import { KitchenCookAlong, SteamParticles } from '../kitchenVibe.js';

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

  const javaStatusPill = h('span', { class: 'badge', style: 'background:rgba(0,0,0,0.06);font-size:0.75rem;' }, 'Analyzing...');
  const javaContent = h('div', { class: 'stack', style: 'gap:10px;' }, h('p', { class: 'muted' }, 'Consulting Java kitchen intelligence...'));
  const javaBox = h('div', { class: 'card butter' },
    h('div', { class: 'row', style: 'justify-content:space-between;align-items:center;margin-bottom:6px;' },
      h('h3', { style: 'margin:0;display:flex;align-items:center;gap:6px;' }, icon('sparkles'), 'Java Culinary Engine'),
      javaStatusPill),
    h('p', { class: 'muted', style: 'font-size:0.8rem;margin:0 0 10px 0;' }, 'Microservice powered by JDK 25 & OOP Strategy Pattern'),
    javaContent);

  Promise.allSettled([
    api.post('/java/nutrition', {
      title: recipe.title,
      servings: recipe.servings || 2,
      ingredients: recipe.ingredients || [],
    }),
    api.post('/java/workload', {
      steps: recipe.steps || [],
      ingredientCount: (recipe.ingredients || []).length,
    }),
    api.post('/java/insights', {
      title: recipe.title,
      area: recipe.area,
      category: recipe.category,
    }),
  ]).then(([nutRes, workRes, insRes]) => {
    const nut = nutRes.status === 'fulfilled' ? nutRes.value : null;
    const work = workRes.status === 'fulfilled' ? workRes.value : null;
    const ins = insRes.status === 'fulfilled' ? insRes.value : null;
    const isLive = Boolean(nut?.javaOnline || work?.javaOnline || ins?.javaOnline);

    javaStatusPill.textContent = isLive ? 'Java Engine Active (Port 8080)' : 'Java Offline Fallback';
    javaStatusPill.style.background = isLive ? '#d4edda' : '#fff3cd';
    javaStatusPill.style.color = isLive ? '#155724' : '#856404';

    const badges = [];
    if (nut?.calories) badges.push(h('span', { class: 'badge', title: 'Java NutritionStrategy' }, icon('flame'), `${nut.calories} kcal · ${nut.macroRating || 'Balanced'}`));
    if (work?.totalMinutes) badges.push(h('span', { class: 'badge', title: 'Java WorkloadStrategy' }, icon('clock'), `${work.totalMinutes} min (${work.difficultyLevel})`));
    if (nut?.healthScore) badges.push(h('span', { class: 'badge', style: 'background:var(--matcha);' }, `Health: ${nut.healthScore}/100`));

    clear(javaContent).append(
      h('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap;' }, badges),
      work?.equipmentRequired?.length ? h('div', { style: 'font-size:0.85rem;margin-top:6px;' },
        h('strong', {}, 'Equipment: '), h('span', { class: 'muted' }, work.equipmentRequired.join(', '))) : null,
      ins?.flavorHarmonies ? h('div', { style: 'font-size:0.85rem;' },
        h('strong', {}, 'Flavor Harmony: '), h('span', { class: 'muted' }, ins.flavorHarmonies)) : null,
      ins?.proTips?.length ? h('div', { style: 'font-size:0.85rem;' },
        h('strong', {}, 'Pro Tip: '), h('span', { class: 'muted' }, ins.proTips[0])) : null);
  }).catch(() => {
    javaStatusPill.textContent = 'Java Engine Standby';
  });

  const picked = state.selected.has(recipe.id);
  const artWrapper = h('div', { class: 'recipe-art-wrapper', style: 'position:relative;display:inline-block;' },
    artEl(recipe, { eager: true }));
  const steamHost = h('div', { class: 'recipe-steam-overlay', style: 'position:absolute;top:-10px;left:50%;transform:translateX(-50%);pointer-events:none;' });
  artWrapper.append(steamHost);
  mountReact(SteamParticles, steamHost, { intensity: 'med', active: true });

  const cookAlongHost = h('div', { class: 'recipe-cook-along-host' });
  mountReact(KitchenCookAlong, cookAlongHost, { steps: recipe.steps, recipeTitle: recipe.title });

  clear(root).append(h('section', { class: 'page' },
    h('a', { href: '#/', class: 'btn ghost small' }, icon('back'), 'Back'),
    h('div', { class: 'recipe-hero', style: 'margin-top:14px' },
      artWrapper,
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
        drinkBox,
        javaBox),
      h('div', { class: 'card' },
        h('h2', {}, 'Method'),
        h('ol', { class: 'steps' }, recipe.steps.map((s) => h('li', {}, s))),
        h('div', { class: 'row', style: 'justify-content:center;margin-top:8px' },
          h('span', { class: 'muted' }, 'Enjoy your meal.')))),
    cookAlongHost));
}
