// Hand-drawn (in code) kawaii illustrations. Every string here is static markup written by us,
// never built from user text, so it is safe to insert with innerHTML.

const INK = '#4A3B47';
const S = `stroke="${INK}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"`;
const THIN = `stroke="${INK}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"`;

const PALETTES = [
  { bg: '#FFE3EB', deep: '#FF9EB5' }, // sakura
  { bg: '#E3F3D8', deep: '#8CC084' }, // matcha
  { bg: '#ECE4FF', deep: '#A895E0' }, // lavender
  { bg: '#FFE9D2', deep: '#FFB27A' }, // peach
  { bg: '#DDF0FF', deep: '#7FC1EE' }, // sky
  { bg: '#FFF6CC', deep: '#F2CE55' }, // butter
];
export const palette = (n) => PALETTES[Math.abs(Number(n) || 0) % PALETTES.length];

// ---------------------------------------------------------------- faces
function eyes(mood) {
  switch (mood) {
    case 'happy':
      return `<path d="M-17 0 q5 -7 10 0" fill="none" ${THIN}/><path d="M7 0 q5 -7 10 0" fill="none" ${THIN}/>`;
    case 'sad':
      return `<path d="M-17 -2 q5 6 10 0" fill="none" ${THIN}/><path d="M7 -2 q5 6 10 0" fill="none" ${THIN}/>
        <path d="M-15 6 q-2 5 0 8" fill="#BFE3FF" ${THIN}/>`;
    case 'sleepy':
      return `<path d="M-17 0 h10" ${THIN}/><path d="M7 0 h10" ${THIN}/>`;
    case 'wow':
      return `<circle cx="-12" cy="0" r="5" fill="#fff" ${THIN}/><circle cx="12" cy="0" r="5" fill="#fff" ${THIN}/>
        <circle cx="-12" cy="0" r="2" fill="${INK}"/><circle cx="12" cy="0" r="2" fill="${INK}"/>`;
    default: // smile
      return `<ellipse cx="-12" cy="0" rx="3.4" ry="4.4" fill="${INK}"/><ellipse cx="12" cy="0" rx="3.4" ry="4.4" fill="${INK}"/>
        <circle cx="-13.2" cy="-1.6" r="1.2" fill="#fff"/><circle cx="10.8" cy="-1.6" r="1.2" fill="#fff"/>`;
  }
}

function mouth(mood) {
  if (mood === 'sad') return `<path d="M-4 12 q4 -4 8 0" fill="none" ${THIN}/>`;
  if (mood === 'wow') return `<ellipse cx="0" cy="12" rx="3" ry="4" fill="#FF8FA8" ${THIN}/>`;
  if (mood === 'sleepy') return `<path d="M-3 11 q3 3 6 0" fill="none" ${THIN}/>`;
  return `<path d="M-6 9 q3 5 6 0 q3 5 6 0" fill="none" ${THIN}/>`;
}

/** A little face centred on (x, y). */
function face(x, y, scale = 1, mood = 'smile') {
  return `<g transform="translate(${x} ${y}) scale(${scale})">${eyes(mood)}
    <ellipse cx="-21" cy="8" rx="6" ry="4" fill="#FF9EB5" opacity=".75"/><ellipse cx="21" cy="8" rx="6" ry="4" fill="#FF9EB5" opacity=".75"/>
    ${mouth(mood)}</g>`;
}

const sparkle = (x, y, r = 7, fill = '#FFE066') =>
  `<path d="M${x} ${y - r} Q${x + 1.5} ${y - 1.5} ${x + r} ${y} Q${x + 1.5} ${y + 1.5} ${x} ${y + r} Q${x - 1.5} ${y + 1.5} ${x - r} ${y} Q${x - 1.5} ${y - 1.5} ${x} ${y - r}Z" fill="${fill}" ${THIN}/>`;

const steam = (x, y) =>
  `<path d="M${x} ${y} q-5 -8 0 -14 q5 -6 0 -14" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" opacity=".95"/>
   <path d="M${x} ${y} q-5 -8 0 -14 q5 -6 0 -14" fill="none" ${THIN} opacity=".35"/>`;

// ---------------------------------------------------------------- mascot
/** Mochi, a rice-ball cat. mood: smile | happy | sad | sleepy | wow */
export function mochi(mood = 'smile', size = 140) {
  return `<svg class="mochi" width="${size}" height="${size}" viewBox="0 0 160 160" role="img" aria-label="Mochi the rice-ball cat">
    <ellipse cx="80" cy="146" rx="46" ry="7" fill="${INK}" opacity=".12"/>
    <path d="M38 56 L34 18 L62 40Z" fill="#fff" ${S}/><path d="M122 56 L126 18 L98 40Z" fill="#fff" ${S}/>
    <path d="M41 46 L39 28 L53 39Z" fill="#FFC2D1"/><path d="M119 46 L121 28 L107 39Z" fill="#FFC2D1"/>
    <path d="M80 28 C112 28 138 62 138 100 C138 130 116 144 80 144 C44 144 22 130 22 100 C22 62 48 28 80 28Z" fill="#fff" ${S}/>
    <path d="M30 118 Q80 134 130 118 L128 132 Q80 150 32 132Z" fill="#3E5A47" ${S}/>
    <path d="M38 30 q6 -6 12 0" fill="none" stroke="#fff" stroke-width="0"/>
    ${face(80, 88, 1.35, mood)}
    <path d="M34 92 h-14 M34 99 l-13 4 M126 92 h14 M126 99 l13 4" ${THIN}/>
    ${mood === 'happy' || mood === 'smile' ? sparkle(132, 40, 7) + sparkle(24, 52, 5, '#FFB3C6') : ''}
    ${mood === 'sleepy' ? `<text x="118" y="38" font-family="Jua, sans-serif" font-size="20" fill="${INK}">z</text><text x="130" y="26" font-family="Jua, sans-serif" font-size="14" fill="${INK}">z</text>` : ''}
  </svg>`;
}

// ---------------------------------------------------------------- dishes
const wrap = (inner, label) =>
  `<svg class="dish" viewBox="0 0 200 160" role="img" aria-label="${label}">${inner}</svg>`;

const shadow = '<ellipse cx="100" cy="146" rx="62" ry="7" fill="#4A3B47" opacity=".12"/>';

const DISHES = {
  bowl: () => wrap(`${shadow}
    <path d="M34 78 Q34 140 100 140 Q166 140 166 78Z" fill="#FFB3C6" ${S}/>
    <path d="M44 78 Q52 36 100 34 Q148 36 156 78Z" fill="#fff" ${S}/>
    <ellipse cx="100" cy="78" rx="66" ry="9" fill="#FFD9E2" ${S}/>
    <circle cx="86" cy="52" r="13" fill="#FFF3C4" ${S}/><circle cx="86" cy="52" r="6.5" fill="#FFB347"/>
    <path d="M112 44 q8 -6 16 2 M118 56 q8 -4 14 4" fill="none" stroke="#7DBB6F" stroke-width="5" stroke-linecap="round"/>
    <path d="M62 56 l16 4 M64 66 l18 2" fill="none" stroke="#FF9A4D" stroke-width="5" stroke-linecap="round"/>
    ${face(100, 108, 1.15)}
    <path d="M150 30 L176 8 M158 36 L184 16" ${S} fill="none"/>${sparkle(176, 38, 6)}`, 'A cute rice bowl'),

  noodles: () => wrap(`${shadow}${steam(78, 38)}${steam(122, 38)}
    <path d="M30 70 Q30 140 100 140 Q170 140 170 70Z" fill="#CBB8FF" ${S}/>
    <ellipse cx="100" cy="70" rx="70" ry="13" fill="#FFE89C" ${S}/>
    <path d="M52 68 q8 -9 16 0 t16 0 t16 0 t16 0 t16 0" fill="none" ${THIN}/>
    <ellipse cx="72" cy="62" rx="15" ry="9" fill="#fff" ${S}/><circle cx="72" cy="62" r="5" fill="#FFB347"/>
    <rect x="112" y="52" width="22" height="16" rx="3" fill="#3E5A47" ${THIN}/>
    <circle cx="96" cy="58" r="4" fill="#FF8FA8" ${THIN}/>
    ${face(100, 108, 1.15)}`, 'A cute bowl of noodles'),

  soup: () => wrap(`${shadow}${steam(84, 40)}${steam(116, 40)}
    <path d="M24 74 h-10 a8 8 0 0 0 0 16 h10 M176 74 h10 a8 8 0 0 1 0 16 h-10" fill="none" ${S}/>
    <path d="M26 66 Q26 140 100 140 Q174 140 174 66Z" fill="#FFD1A6" ${S}/>
    <ellipse cx="100" cy="66" rx="74" ry="13" fill="#FF8F6B" ${S}/>
    <rect x="62" y="56" width="16" height="12" rx="3" fill="#fff" ${THIN}/><rect x="120" y="58" width="16" height="12" rx="3" fill="#fff" ${THIN}/>
    <circle cx="98" cy="62" r="3.5" fill="#FFE066" ${THIN}/><circle cx="150" cy="64" r="3" fill="#8CC084" ${THIN}/>
    ${face(100, 106, 1.2)}`, 'A cute pot of soup'),

  onigiri: () => wrap(`${shadow}
    <path d="M100 22 Q112 22 132 66 Q156 118 144 130 Q136 142 100 142 Q64 142 56 130 Q44 118 68 66 Q88 22 100 22Z" fill="#fff" ${S}/>
    <path d="M70 108 Q100 120 130 108 L138 130 Q136 142 100 142 Q64 142 62 130Z" fill="#3E5A47" ${S}/>
    ${face(100, 82, 1.25, 'happy')}
    <path d="M86 44 q14 -10 22 2" fill="none" stroke="#E8E1DE" stroke-width="4" stroke-linecap="round"/>
    ${sparkle(42, 40, 7)}${sparkle(160, 56, 5, '#FFB3C6')}${sparkle(150, 22, 4)}`, 'A cute onigiri rice ball'),

  roll: () => wrap(`${shadow}
    <rect x="22" y="112" width="156" height="26" rx="6" fill="#F4D9A0" ${S}/>
    <path d="M40 112 v26 M70 112 v26 M100 112 v26 M130 112 v26 M160 112 v26" ${THIN} opacity=".5"/>
    ${[[56, 70], [100, 70], [144, 70]].map(([x, y], i) => `
      <circle cx="${x}" cy="${y}" r="26" fill="#3E5A47" ${S}/><circle cx="${x}" cy="${y}" r="20" fill="#fff" ${THIN}/>
      <circle cx="${x - 7}" cy="${y - 6}" r="4" fill="#FF9A4D"/><circle cx="${x + 7}" cy="${y - 6}" r="4" fill="#7DBB6F"/>
      <rect x="${x - 6}" y="${y + 2}" width="12" height="6" rx="2" fill="#FFE066"/>`).join('')}
    ${face(100, 82, 0.7, 'happy')}${sparkle(176, 36, 6)}${sparkle(24, 40, 5, '#FFB3C6')}`, 'Cute kimbap rolls'),

  pancake: () => wrap(`${shadow}
    <ellipse cx="100" cy="124" rx="62" ry="14" fill="#fff" ${S}/>
    <path d="M44 112 Q44 98 100 98 Q156 98 156 112 Q156 126 100 126 Q44 126 44 112Z" fill="#F7C873" ${S}/>
    <path d="M48 92 Q48 78 100 78 Q152 78 152 92 Q152 106 100 106 Q48 106 48 92Z" fill="#FBD98F" ${S}/>
    <path d="M52 72 Q52 56 100 56 Q148 56 148 72 Q148 88 100 88 Q52 88 52 72Z" fill="#FFE2A6" ${S}/>
    <path d="M62 72 q4 22 10 6 q6 20 12 2 q6 16 12 0 q6 14 14 -2 q8 14 14 0 q8 10 12 -4" fill="#FFB3C6" ${THIN}/>
    <circle cx="116" cy="44" r="11" fill="#FF7E8F" ${S}/><path d="M112 34 l4 -6 l4 6" fill="#7DBB6F" ${THIN}/>
    ${face(84, 100, 0.95, 'happy')}${sparkle(168, 44, 6)}`, 'A cute stack of pancakes'),

  sweet: () => wrap(`${shadow}
    <path d="M30 124 L170 44" ${S} fill="none"/>
    <circle cx="62" cy="106" r="22" fill="#FFB3C6" ${S}/><circle cx="100" cy="84" r="22" fill="#fff" ${S}/><circle cx="138" cy="62" r="22" fill="#B9E3A5" ${S}/>
    ${face(100, 86, 0.62, 'happy')}${face(62, 108, 0.5)}${face(138, 64, 0.5)}
    ${sparkle(36, 60, 7)}${sparkle(172, 110, 6, '#FFB3C6')}${sparkle(150, 22, 5)}`, 'Cute dango sweets'),

  salad: () => wrap(`${shadow}
    <path d="M32 76 Q32 138 100 138 Q168 138 168 76Z" fill="#C9E8F7" ${S}/>
    <circle cx="60" cy="66" r="20" fill="#A8DB8F" ${S}/><circle cx="92" cy="54" r="22" fill="#8CC084" ${S}/>
    <circle cx="128" cy="60" r="22" fill="#A8DB8F" ${S}/><circle cx="148" cy="74" r="14" fill="#8CC084" ${S}/>
    <circle cx="80" cy="46" r="8" fill="#FF7E8F" ${THIN}/><circle cx="116" cy="44" r="7" fill="#FF7E8F" ${THIN}/>
    <circle cx="104" cy="70" r="8" fill="#FFF3C4" ${THIN}/><circle cx="104" cy="70" r="3" fill="#8CC084"/>
    <ellipse cx="100" cy="78" rx="68" ry="8" fill="#DFF3FB" ${S}/>
    ${face(100, 110, 1.15)}`, 'A cute fresh salad'),

  plate: () => wrap(`${shadow}
    <ellipse cx="100" cy="100" rx="78" ry="38" fill="#fff" ${S}/><ellipse cx="100" cy="100" rx="58" ry="26" fill="#F4F0FF" ${THIN}/>
    <path d="M70 100 Q64 66 100 64 Q138 64 130 100 Q124 122 100 122 Q76 122 70 100Z" fill="#E8A96B" ${S}/>
    <path d="M82 76 q12 -8 24 0" fill="none" stroke="#F6CD97" stroke-width="5" stroke-linecap="round"/>
    <circle cx="48" cy="88" r="10" fill="#8CC084" ${S}/><circle cx="58" cy="82" r="9" fill="#A8DB8F" ${S}/>
    <circle cx="150" cy="100" r="9" fill="#FF9A4D" ${S}/><circle cx="142" cy="112" r="7" fill="#FFB27A" ${S}/>
    ${face(100, 96, 1.0)}${sparkle(168, 52, 6)}${sparkle(30, 60, 5, '#FFB3C6')}`, 'A cute plated dish'),

  egg: () => wrap(`${shadow}
    <path d="M40 86 Q30 52 70 42 Q104 30 140 46 Q176 60 162 98 Q150 128 106 128 Q52 134 40 86Z" fill="#fff" ${S}/>
    <circle cx="100" cy="84" r="30" fill="#FFC94D" ${S}/>
    <circle cx="88" cy="70" r="6" fill="#FFE9A8"/>
    ${face(100, 88, 0.95, 'happy')}${sparkle(170, 40, 6)}${sparkle(30, 44, 5, '#FFB3C6')}`, 'A cute fried egg'),
};

/** Choose an illustration for a recipe from its title and category. */
export function dishKind(recipe) {
  const t = `${recipe.title || ''} ${recipe.category || ''}`.toLowerCase();
  if (/\bonigiri\b/.test(t)) return 'onigiri';
  if (/\b(kimbap|sushi|maki)\b/.test(t)) return 'roll';
  if (/\b(oyakodon|katsudon|gyudon|donburi|bibimbap|bowl)\b/.test(t)) return 'bowl';
  if (/\b(omelette|eggs?|tamago|gyeran|sando)\b/.test(t)) return 'egg';
  if (/\b(dango|mochi|bingsu|patbingsu|parfait|dessert|oats)\b/.test(t)) return 'sweet';
  if (/\b(pancakes?|pajeon|okonomiyaki|hotteok|breakfast|toast)\b/.test(t)) return 'pancake';
  if (/\b(ramen|udon|noodles?|soba|japchae|yakisoba|spaghetti|pasta)\b/.test(t)) return 'noodles';
  if (/\b(soup|stew|jjigae|curry|congee|tteokbokki)\b/.test(t)) return 'soup';
  if (/\b(salad|sunomono|sprout|sprouts)\b/.test(t)) return 'salad';
  if (/\brice\b/.test(t)) return 'bowl';
  return 'plate';
}

export function dishArt(recipe) {
  return DISHES[dishKind(recipe)]();
}
export const dishByName = (name) => (DISHES[name] || DISHES.plate)();

// ---------------------------------------------------------------- icons (24px, used in nav and buttons)
const ICON_ATTRS = `width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"`;
export const ICONS = {
  search: `<svg ${ICON_ATTRS}><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 L21 21"/></svg>`,
  heart: `<svg ${ICON_ATTRS}><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>`,
  heartFill: `<svg ${ICON_ATTRS} fill="currentColor"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>`,
  list: `<svg ${ICON_ATTRS}><rect x="5" y="4" width="14" height="17" rx="3"/><path d="M9 4v-1h6v1M9 11h6M9 15h4"/></svg>`,
  pantry: `<svg ${ICON_ATTRS}><path d="M6 9h12l-1 11H7L6 9z"/><path d="M8 9V6a4 4 0 0 1 8 0v3"/></svg>`,
  calendar: `<svg ${ICON_ATTRS}><rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 11h16"/></svg>`,
  user: `<svg ${ICON_ATTRS}><circle cx="12" cy="8" r="4"/><path d="M4 21c1-5 15-5 16 0"/></svg>`,
  leaf: `<svg ${ICON_ATTRS}><path d="M5 19C5 10 10 5 20 4c0 10-4 15-13 15"/><path d="M5 19c3-5 6-8 10-10"/></svg>`,
  wheat: `<svg ${ICON_ATTRS}><path d="M12 21V8M12 8c-3 0-4-2-4-4 3 0 4 2 4 4zM12 8c3 0 4-2 4-4-3 0-4 2-4 4zM12 14c-3 0-4-2-4-4 3 0 4 2 4 4zM12 14c3 0 4-2 4-4-3 0-4 2-4 4z"/><path d="M4 4l16 16"/></svg>`,
  flame: `<svg ${ICON_ATTRS}><path d="M12 3c.5 3.5 5 5.5 5 11a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5.2 1.8 1 2.6 2 2.6C11 8.5 10.5 6 12 3z"/></svg>`,
  plus: `<svg ${ICON_ATTRS}><path d="M12 5v14M5 12h14"/></svg>`,
  check: `<svg ${ICON_ATTRS}><path d="M5 12.5l4.5 4.5L19 7"/></svg>`,
  close: `<svg ${ICON_ATTRS}><path d="M6 6l12 12M18 6L6 18"/></svg>`,
  sparkles: `<svg ${ICON_ATTRS}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/></svg>`,
  back: `<svg ${ICON_ATTRS}><path d="M15 5l-7 7 7 7"/></svg>`,
  trash: `<svg ${ICON_ATTRS}><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/></svg>`,
  cup: `<svg ${ICON_ATTRS}><path d="M5 8h12v6a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5V8z"/><path d="M17 10h2a2 2 0 0 1 0 5h-2"/></svg>`,
};

/** A scatter of decorative doodles used behind page headers. */
export function doodles() {
  return `<svg class="doodles" viewBox="0 0 400 120" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
    ${sparkle(36, 30, 9)}${sparkle(330, 24, 7, '#FFB3C6')}${sparkle(372, 78, 5)}${sparkle(90, 92, 5, '#C9B8FF')}
    <circle cx="150" cy="22" r="4" fill="#FFB3C6" ${THIN}/><circle cx="262" cy="96" r="5" fill="#B9E3A5" ${THIN}/>
    <path d="M200 20 q6 -10 12 0 t12 0" fill="none" ${THIN} opacity=".5"/>
  </svg>`;
}

/** A sakura petal used by the falling-petals background. */
export const petal = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 1 C14 3 17 8 10 19 C3 8 6 3 10 1Z" fill="#FFC2D1" stroke="#FF9EB5" stroke-width="1"/></svg>';
