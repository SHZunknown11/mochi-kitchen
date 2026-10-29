import { api } from '../api.js';
import { h, clear, toast, plural } from '../ui.js';
import { icon, emptyState, loading, pageHead } from '../components.js';

export async function listsView(root) {
  const body = h('div', {}, loading('Mochi is counting the groceries'));
  root.append(h('section', { class: 'page' }, pageHead('Shopping lists', 'Pick recipes on the search page, tick "Add to list", and Mochi merges the ingredients.', '買い物リスト · 장보기'), body));

  let lists;
  try {
    ({ lists } = await api.get('/grocery'));
  } catch (err) {
    clear(body).append(emptyState('sad', 'Could not load your lists', err.message));
    return;
  }

  clear(body);
  if (lists.length === 0) {
    body.append(emptyState('sleepy', 'No lists yet', 'Select a few recipes and make your first shopping list.',
      h('a', { class: 'btn', href: '#/' }, icon('search'), 'Find recipes')));
    return;
  }
  body.append(...lists.map((l) => h('div', { class: 'card list-row' },
    h('div', { class: 'grow' },
      h('h3', { style: 'margin:0' }, h('a', { href: `#/lists/${l.id}` }, l.name)),
      h('span', { class: 'muted' }, `${l.done} of ${plural(l.total, 'item')} ticked`)),
    h('a', { class: 'btn small', href: `#/lists/${l.id}` }, 'Open'))));
}

export async function listDetailView(root, { id }) {
  const body = h('div', {}, loading('Mochi is unfolding the list'));
  root.append(h('section', { class: 'page' }, body));

  let list;
  try {
    ({ list } = await api.get(`/grocery/${encodeURIComponent(id)}`));
  } catch (err) {
    clear(body).append(emptyState('sad', 'List not found', err.message, h('a', { class: 'btn', href: '#/lists' }, 'All lists')));
    return;
  }

  const bar = h('span', { style: 'width:0%' });
  const label = h('p', { class: 'hand' });
  const refreshProgress = () => {
    const done = list.items.filter((i) => i.checked).length;
    bar.style.width = `${list.items.length ? (done / list.items.length) * 100 : 0}%`;
    label.textContent = done === list.items.length && done > 0
      ? 'All done! ごちそうさま!'
      : `${done} of ${plural(list.items.length, 'item')} in the basket`;
  };

  const aisles = [...new Set(list.items.map((i) => i.aisle))];
  const groups = aisles.map((aisle) => h('div', {},
    h('h2', { class: 'aisle' }, aisle),
    list.items.filter((i) => i.aisle === aisle).map((item) => h('label', { class: 'check' },
      h('input', {
        type: 'checkbox', checked: item.checked,
        onChange: async (e) => {
          const checked = e.target.checked;
          item.checked = checked;
          refreshProgress();
          try {
            await api.patch(`/grocery/${list.id}/items/${item.id}`, { checked });
          } catch (err) {
            item.checked = !checked; e.target.checked = !checked; refreshProgress(); toast(err.message, 'bad');
          }
        },
      }),
      h('span', { class: 'what' }, item.name),
      h('span', { class: 'amount' }, item.amount || '')))));

  clear(body).append(
    h('a', { href: '#/lists', class: 'btn ghost small' }, icon('back'), 'All lists'),
    pageHead(list.name, null, '買い物リスト'),
    h('div', { class: 'card' }, label, h('div', { class: 'progress', role: 'progressbar', 'aria-label': 'Shopping progress' }, bar), ...groups),
    h('div', { class: 'row', style: 'margin-top:16px' },
      h('button', {
        class: 'btn ghost', type: 'button',
        onClick: async () => {
          try { await api.del(`/grocery/${list.id}`); toast('List deleted'); location.hash = '#/lists'; } catch (err) { toast(err.message, 'bad'); }
        },
      }, icon('trash'), 'Delete list')));
  refreshProgress();
}
