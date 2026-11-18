// Captures de recette de l'interface (spec docs/specs/migration-ui.md, §6).
//
// Tourne dans un conteneur JETABLE (rien n'est installé dans le projet), contre le build servi
// par `npm run preview`. Voir docs/recette/README.md pour la commande complète.
//
//   node capture.mjs record <url> <dossier>   enregistre les réponses Open-Meteo (fixtures)
//   node capture.mjs replay <url> <dossier>   rejoue les réponses enregistrées (captures comparables)
//
// Déterminisme : réponses Open-Meteo rejouées, horloge du navigateur figée à l'instant de
// l'enregistrement, fuseau Europe/Paris, tuiles de carte remplacées par une image grise unie,
// transitions et animations coupées.
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const [mode, url, outDir] = process.argv.slice(2);
if (!['record', 'replay'].includes(mode) || !url || !outDir) {
  console.error('usage : node capture.mjs record|replay <url> <dossier>');
  process.exit(2);
}
// Le script est copié dans le conteneur : les fixtures vivent dans le dossier monté /recette.
const FIXTURE = process.env.FIXTURE ?? '/recette/fixtures/open-meteo.json';
const SAMPLES = process.env.SAMPLES ?? '/samples';
fs.mkdirSync(outDir, { recursive: true });

const fixture = mode === 'replay' ? JSON.parse(fs.readFileSync(FIXTURE, 'utf8')) : { t0: Date.now(), responses: {} };

// PNG 1×1 gris (#d8d8d8) : remplace toutes les tuiles IGN / OpenTopoMap.
const GREY_TILE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR42mN48eIFAAWwAteK3IMFAAAAAElFTkSuQmCC',
  'base64',
);

const VIEWPORTS = {
  bureau: { width: 1400, height: 850, deviceScaleFactor: 1 },
  mobile: { width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
};
const THEMES = ['light', 'dark'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function setupPage(context, viewport, theme) {
  const page = await context.newPage();
  await page.setViewport(viewport);
  await page.emulateTimezone('Europe/Paris');
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }]);
  // Horloge figée (avance normalement à partir de t0) et animations coupées, avant tout script.
  await page.evaluateOnNewDocument((t0) => {
    const RealDate = Date;
    const start = RealDate.now();
    const now = () => t0 + (RealDate.now() - start);
    class FixedDate extends RealDate {
      constructor(...args) {
        if (args.length === 0) super(now());
        else super(...args);
      }
      static now() {
        return now();
      }
    }
    window.Date = FixedDate;
    document.addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('style');
      s.textContent = '*,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent!important}';
      document.head.append(s);
    });
  }, fixture.t0);

  const pending = new Set();
  page.pendingApi = pending;
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const u = req.url();
    if (/data\.geopf\.fr|tile\.opentopomap\.org/.test(u)) {
      return req.respond({ status: 200, contentType: 'image/png', body: GREY_TILE });
    }
    if (u.includes('api.open-meteo.com')) {
      if (mode === 'replay') {
        const body = fixture.responses[u];
        if (body === undefined) {
          console.warn(`  ! réponse absente des fixtures : ${u.slice(0, 120)}…`);
          return req.respond({ status: 503, contentType: 'application/json', body: '{"error":true}' });
        }
        return req.respond({ status: 200, contentType: 'application/json', body, headers: { 'access-control-allow-origin': '*' } });
      }
      pending.add(u);
    }
    return req.continue();
  });
  if (mode === 'record') {
    page.on('response', async (res) => {
      const u = res.url();
      if (!u.includes('api.open-meteo.com') || res.request().method() !== 'GET') return;
      try {
        if (res.ok()) fixture.responses[u] = await res.text();
      } finally {
        pending.delete(u);
      }
    });
  }
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.errors = errors;
  return page;
}

/** Attend que les requêtes Open-Meteo soient terminées et que l'interface soit stable. */
async function settle(page, ms = 800) {
  for (let i = 0; i < 150 && page.pendingApi.size > 0; i++) await sleep(100);
  await sleep(ms);
}

async function shot(page, name) {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file });
  console.log(`  ${name}.png`);
}

const isMobile = (vp) => Boolean(vp.isMobile);

async function openDrawer(page, vp) {
  if (!isMobile(vp)) return;
  if (await page.$('.sidebar.open')) return;
  await page.click('.panel-toggle');
  await sleep(300);
}

async function closeDrawer(page, vp) {
  if (!isMobile(vp)) return;
  if (!(await page.$('.sidebar.open'))) return;
  // Le tiroir couvre le centre de l'écran : cliquer sur la bande grisée visible à droite.
  await page.mouse.click(vp.width - 12, Math.round(vp.height / 2));
  await sleep(300);
}

async function scenario(browser, vpName, theme) {
  const vp = VIEWPORTS[vpName];
  const context = await browser.createBrowserContext(); // IndexedDB vierge
  const page = await setupPage(context, vp, theme);
  const tag = `${vpName}-${theme === 'light' ? 'clair' : 'sombre'}`;
  console.log(tag);

  await page.goto(url, { waitUntil: 'networkidle2' });
  const input = await page.$('input[type="file"]');
  await input.uploadFile(path.join(SAMPLES, 'lac-exemple.gpx'), path.join(SAMPLES, 'route-sans-altitude.gpx'));
  await page.waitForFunction(() => document.querySelectorAll('.track-list .track-item').length === 2, { timeout: 15000 });
  await settle(page, 1500); // altitudes du tracé sans altitude

  // Sélection du tracé « lac » (au doigt sur mobile : ouvrir le tiroir d'abord).
  await openDrawer(page, vp);
  const items = await page.$$('.track-list .track-item .track-name');
  for (const it of items) {
    const txt = await it.evaluate((e) => e.textContent);
    if (/lac/i.test(txt)) {
      await it.click();
      break;
    }
  }
  await settle(page, 1200);
  await closeDrawer(page, vp);

  // Coloration du tracé par la température.
  await page.evaluate(() => {
    const sel = [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.value === 'temperature'));
    if (sel) {
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
      setter.call(sel, 'temperature');
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  await settle(page, 1200);
  await shot(page, `${tag}-1-carte`);

  // Panneau du tracé, onglet Météo (bureau) / tiroir ouvert (mobile).
  await openDrawer(page, vp);
  await page.click('button[aria-label="Météo du tracé"]');
  await settle(page, 600);
  await shot(page, `${tag}-2-${isMobile(vp) ? 'tiroir' : 'panneau-meteo'}`);
  await page.click('button[aria-label="Stats du tracé"]');
  await sleep(200);
  await closeDrawer(page, vp);

  // Onglet Météo par altitude.
  await page.click('.view-tabs button[aria-label="Météo"]');
  await page.waitForSelector('.wtable', { timeout: 15000 });
  await settle(page, 800);
  await shot(page, `${tag}-3-meteo`);

  // Onglet Meilleur jour.
  await page.click('.view-tabs button[aria-label="Meilleur jour"]');
  await page.waitForSelector('.stable', { timeout: 15000 });
  await settle(page, 1500);
  await shot(page, `${tag}-4-meilleur-jour`);

  // Paramètres (depuis la carte).
  await page.click('.view-tabs button[aria-label="Carte"]');
  await sleep(300);
  await openDrawer(page, vp);
  await page.click('button[aria-label="Paramètres"]');
  await page.waitForSelector('.modal', { timeout: 5000 });
  await sleep(400);
  await shot(page, `${tag}-5-parametres`);

  if (page.errors.length) console.warn(`  ! erreurs JS : ${page.errors.join(' | ')}`);
  await context.close();
}

const browser = await puppeteer.launch({
  executablePath: process.env.CHROMIUM ?? '/usr/bin/chromium-browser',
  args: ['--no-sandbox', '--disable-gpu', '--font-render-hinting=none'],
});
try {
  for (const vp of Object.keys(VIEWPORTS)) for (const theme of THEMES) await scenario(browser, vp, theme);
} finally {
  await browser.close();
}

if (mode === 'record') {
  fs.mkdirSync(path.dirname(FIXTURE), { recursive: true });
  fs.writeFileSync(FIXTURE, JSON.stringify(fixture));
  console.log(`fixtures : ${Object.keys(fixture.responses).length} réponses, t0 = ${new Date(fixture.t0).toISOString()}`);
}
