// Compare deux séries de captures (même noms de fichiers) et produit une page HTML côte à côte.
//   node compare.mjs <dossier-avant> <dossier-après> <dossier-rapport>
// Seuil de couleur pixelmatch 0.1 (absorbe l'anticrénelage). Résultat : rapport.html, ouvert
// dans un navigateur, sans lire de code.
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const [before, after, out] = process.argv.slice(2);
if (!before || !after || !out) {
  console.error('usage : node compare.mjs <avant> <après> <rapport>');
  process.exit(2);
}
fs.mkdirSync(out, { recursive: true });
const names = fs.readdirSync(before).filter((f) => f.endsWith('.png')).sort();
const rows = [];
let changed = 0;

for (const name of names) {
  const a = PNG.sync.read(fs.readFileSync(path.join(before, name)));
  const bPath = path.join(after, name);
  if (!fs.existsSync(bPath)) {
    rows.push({ name, pct: null });
    changed++;
    continue;
  }
  const b = PNG.sync.read(fs.readFileSync(bPath));
  const w = Math.max(a.width, b.width);
  const h = Math.max(a.height, b.height);
  const pad = (img) => {
    if (img.width === w && img.height === h) return img;
    const p = new PNG({ width: w, height: h });
    PNG.bitblt(img, p, 0, 0, img.width, img.height, 0, 0);
    return p;
  };
  const diff = new PNG({ width: w, height: h });
  const n = pixelmatch(pad(a).data, pad(b).data, diff.data, w, h, { threshold: 0.1 });
  const pct = (100 * n) / (w * h);
  fs.writeFileSync(path.join(out, `diff-${name}`), PNG.sync.write(diff));
  fs.copyFileSync(path.join(before, name), path.join(out, `avant-${name}`));
  fs.copyFileSync(bPath, path.join(out, `apres-${name}`));
  if (n > 0) changed++;
  rows.push({ name, pct, n });
  console.log(`${n === 0 ? '=' : '≠'} ${name.padEnd(36)} ${n} px (${pct.toFixed(3)} %)`);
}

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Recette visuelle</title>
<style>body{font-family:system-ui,sans-serif;margin:16px;background:#f4f4f4}h2{font-size:15px;margin:24px 0 6px}
.ok{color:#2f6f4f}.ko{color:#b3261e}.row{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
figure{margin:0}figcaption{font-size:12px;color:#555}img{width:100%;border:1px solid #ccc;background:#fff}</style></head><body>
<h1>Recette visuelle : ${changed} capture(s) différente(s) sur ${names.length}</h1>
<p>Colonnes : avant, après, différences (en rouge). Les captures identiques sont repliées.</p>
${rows
  .map((r) =>
    r.pct === null
      ? `<h2 class="ko">${esc(r.name)} : absente après</h2>`
      : `<details ${r.n > 0 ? 'open' : ''}><summary><strong class="${r.n > 0 ? 'ko' : 'ok'}">${esc(r.name)}</strong> : ${
          r.n === 0 ? 'identique' : `${r.n} pixels différents (${r.pct.toFixed(3)} %)`
        }</summary><div class="row">
<figure><img src="avant-${r.name}"><figcaption>avant</figcaption></figure>
<figure><img src="apres-${r.name}"><figcaption>après</figcaption></figure>
<figure><img src="diff-${r.name}"><figcaption>différences</figcaption></figure></div></details>`,
  )
  .join('\n')}
</body></html>`;
fs.writeFileSync(path.join(out, 'rapport.html'), html);
console.log(`\n${changed} différente(s) sur ${names.length} → ${path.join(out, 'rapport.html')}`);
