# Recette visuelle et sondes

Outil de captures avant/après (né de la migration UI, `docs/specs/migration-ui.md`). **Rien n'est
installé dans le projet** : Chromium, puppeteer-core, pixelmatch et pngjs vivent dans un
conteneur `node:26-alpine` jetable, avec les polices Noto (symboles et emojis).

## Utilisation (depuis la racine du projet)

```sh
sh docs/recette/run.sh capture avant          # sur le code de référence
sh docs/recette/run.sh capture apres          # après les changements
sh docs/recette/run.sh compare avant apres    # → docs/recette/captures/rapport-avant-apres/rapport.html
```

Le **rapport** s'ouvre dans un navigateur. Il montre, pour chaque capture, l'image avant,
l'image après et les différences en rouge. Les captures identiques sont repliées.

`capture` construit l'app (`npm run build`) et la sert avec `npm run preview` dans un conteneur
sur le réseau `cairn_default`. Les captures sont donc faites **sur le build**, pas sur le
serveur dev.

Référence actuelle : `captures/lot9-apres` (fin de la migration UI). Les captures sont
ignorées par Git ; supprimer les séries devenues inutiles.

## Sondes (vérification ponctuelle d'un comportement)

```sh
sh docs/recette/run.sh sonde <chemin/vers/script.mjs>
```

Construit l'app, la sert en preview, puis lance `node script.mjs <url>` dans le conteneur
jetable. Le script (puppeteer-core) peut être n'importe où sur le disque ; il trouve Chromium
en `/usr/bin/chromium-browser` et les GPX de test dans `/samples`. Squelette :

```js
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.goto(process.argv[2], { waitUntil: 'networkidle0' });
await (await page.$('input[type="file"]')).uploadFile('/samples/lac-exemple.gpx');
// … actions, puis console.log des mesures ; écouter 'pageerror' pour les erreurs
await browser.close();
```

Contrairement aux captures, la météo n'est pas rejouée (vraies requêtes Open-Meteo).

## Ce qui est capturé

6 vues × 2 thèmes (clair, sombre) × 2 largeurs (bureau 1 400 × 850, mobile 390 × 844), soit
24 images :

1. **Carte** : deux GPX de `samples/` importés, le tracé « lac » sélectionné et coloré par la
   température, profil affiché.
2. **Panneau Météo** du tracé (bureau) ou **tiroir** ouvert (mobile).
3. **Onglet Météo** par altitude, puis le même au **3e jour** (jours, alertes, nuit).
4. **Onglet Meilleur jour**.
5. **Fenêtre Paramètres**.

## Captures reproductibles

Deux captures successives du même code sont identiques au pixel près.
- **Météo** : les réponses d'Open-Meteo (prévisions et altitudes) sont **rejouées** depuis
  `fixtures/open-meteo.json`, enregistré une fois avec `sh docs/recette/run.sh record`. À
  refaire seulement si les requêtes de l'app changent ; la sonde signale toute réponse
  manquante.
- **Horloge** : le navigateur est figé au **jeudi 19/11/2026 à 10 h** (champ `t0` des fixtures),
  fuseau Europe/Paris.
- **Tuiles de carte** : remplacées par une image grise unie. Les tracés, contrôles et
  infobulles restent réels.
- **Animations** : transitions et animations sont coupées.

## Contrastes

```sh
MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd -W):/p:ro" -w /p node:26-alpine node docs/recette/contrastes.mjs
```

Ce script mesure le contraste WCAG des couples texte/fond (4,5:1 minimum) et contour/fond
(3:1) à partir des tokens de `src/index.css`, dans les deux thèmes. Tout nouveau couple ajouté
par un composant doit y être ajouté.
