// Contrastes WCAG 2.x des couples texte/fond de l'interface (spec migration-ui, Q11).
//   node contrastes.mjs [chemin de index.css]     (défaut : src/index.css)
// Lit les tokens des blocs :root et :root[data-theme='dark'] de src/index.css. Seuils : 4,5:1
// pour le texte, 3:1 pour les contours d'éléments d'interface et les symboles (étoile…).
import fs from 'node:fs';

const css = fs.readFileSync(process.argv[2] ?? 'src/index.css', 'utf8');
const block = (re) => {
  const m = css.match(re);
  if (!m) throw new Error(`bloc introuvable : ${re}`);
  return Object.fromEntries([...m[1].matchAll(/--([\w-]+):\s*([^;]+);/g)].map((x) => [x[1], x[2].trim()]));
};
const light = block(/:root\s*\{([^}]*)\}/);
const dark = { ...light, ...block(/:root\[data-theme='dark'\]\s*\{([^}]*)\}/) };

function parse(c) {
  let m = c.match(/^#([0-9a-f]{6})$/i);
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)).concat(1);
  m = c.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return [p[0], p[1], p[2], p[3] ?? 1];
  }
  throw new Error(`couleur non gérée : ${c}`);
}
const over = (fg, bg) => fg.slice(0, 3).map((v, i) => v * fg[3] + bg[i] * (1 - fg[3])).concat(1);
const lum = ([r, g, b]) =>
  [r, g, b]
    .map((v) => v / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
function ratio(theme, fgName, bgName, baseName = 'card') {
  const base = parse(theme[baseName]);
  const bg = over(parse(theme[bgName]), base);
  const fg = over(parse(theme[fgName]), bg);
  const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

// [texte ou contour, fond, seuil, où (styles/legacy.css)]
const PAIRS = [
  ['foreground', 'background', 4.5, 'texte courant (vue Météo, Meilleur jour)'],
  ['foreground', 'card', 4.5, 'texte des panneaux'],
  ['foreground', 'accent', 4.5, 'ligne sélectionnée'],
  ['muted-foreground', 'background', 4.5, 'texte discret sur le fond (en-têtes Météo, compteur)'],
  ['muted-foreground', 'card', 4.5, 'texte discret des panneaux (libellés, unités)'],
  ['muted-foreground', 'accent', 4.5, 'texte discret sur la ligne sélectionnée'],
  ['faint', 'card', 4.5, 'jours peu fiables (Meilleur jour)'],
  ['faint', 'background', 4.5, 'jours peu fiables sur le fond'],
  ['primary', 'card', 4.5, 'liens, boutons texte, zone de dépôt'],
  ['primary', 'background', 4.5, 'liens sur le fond'],
  ['primary-foreground', 'primary', 4.5, 'bouton principal, onglet actif'],
  ['destructive', 'card', 4.5, 'erreurs, alertes'],
  ['foreground', 'destructive-muted', 4.5, 'alerte météo'],
  ['warning-foreground', 'warning', 4.5, 'bloc soleil, avertissements, badge « inversion »'],
  ['muted-foreground', 'muted', 4.5, 'compteur de tracés (badge)'],
  ['foreground', 'border', 4.5, 'bouton icône survolé (fond --border)'],
  ['warning-foreground', 'card', 4.5, 'inversion dans le tableau'],
  ['info-foreground', 'info', 4.5, 'alerte isotherme'],
  ['info-foreground', 'card', 4.5, 'valeurs en gras (tableau météo)'],
  ['night-foreground', 'night', 4.5, 'heures de nuit (tableau météo)'],
  ['night-accent', 'card', 4.5, 'heure de nuit (panneau météo)'],
  ['gold', 'card', 3, 'étoile du meilleur jour (symbole)'],
  ['input', 'card', 3, 'contour des champs de saisie et listes'],
  ['input', 'background', 3, 'contour des champs sur le fond'],
];

let fails = 0;
for (const [name, theme] of [['clair', light], ['sombre', dark]]) {
  console.log(`\n# Thème ${name}`);
  for (const [fg, bg, min, where] of PAIRS) {
    const r = ratio(theme, fg, bg);
    const ok = r >= min;
    if (!ok) fails++;
    console.log(`${ok ? '  ok ' : '  KO '} ${r.toFixed(2).padStart(5)}:1 (min ${min})  --${fg} sur --${bg}  ${where}`);
  }
}
console.log(`\n${fails} couple(s) sous le seuil`);
