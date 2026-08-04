// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  PRÉ-RENDU STATIQUE DES PAGES PUBLIQUES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Pourquoi : ce site est une "SPA" — le HTML de base est quasi vide
// (<div id="root"></div>), tout le contenu est injecté par JavaScript une
// fois dans le navigateur. Or la plupart des robots IA (GPTBot, ClaudeBot,
// PerplexityBot...) n'exécutent PAS JavaScript : ils ne voient donc jamais
// ce contenu, seulement une page vide.
//
// Ce script s'exécute automatiquement après `npm run build` (voir le
// script "postbuild" dans package.json). Pour chaque page publique, il
// génère un dossier contenant un index.html "en dur" : le vrai texte de la
// page (titre, sous-titre, sections) est déjà présent dans le HTML, en plus
// du <div id="root"> et du script de l'app React.
//
// Résultat pour un visiteur humain (JS activé) : aucun changement visible —
// React prend le relais et affiche la version interactive normale dès que
// la page a chargé.
// Résultat pour un robot qui ne charge pas le JS : il voit directement le
// texte réel de la page, avec le bon <title> et la bonne meta description.
//
// Pour ajouter une page publique à pré-rendre : ajouter son "type" dans la
// liste PAGES_TO_PRERENDER plus bas — le contenu est lu depuis content.js
// (INFO_PAGES / LEGAL_PAGES), donc rien d'autre à dupliquer.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PAGE_META, INFO_PAGES, LEGAL_PAGES } from "../content.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const SITE_URL = "https://www.getstudyreach.com";

const template = readFileSync(path.join(DIST, "index.html"), "utf-8");

function escapeHtml(str){
  return String(str)
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#39;");
}

// Construit le bloc HTML du contenu (titre + sections) pour une page de
// type "INFO_PAGES" (how-it-works, pricing, for-participants, blog, faq, status)
function renderInfoContent(page){
  const sectionsHtml = page.sections.map(s => `
    <section>
      <h2>${escapeHtml(s.title)}</h2>
      <p>${escapeHtml(s.body)}</p>
    </section>`).join("\n");
  return `
    <main>
      <h1>${escapeHtml(page.title)}</h1>
      <p>${escapeHtml(page.subtitle)}</p>
      ${sectionsHtml}
    </main>`;
}

// Idem pour une page légale (terms, privacy, legal) — structure légèrement différente
function renderLegalContent(page){
  const sectionsHtml = page.sections.map(s => `
    <section>
      <h2>${escapeHtml(s.t)}</h2>
      <p>${escapeHtml(s.c)}</p>
    </section>`).join("\n");
  return `
    <main>
      <h1>${escapeHtml(page.title)}</h1>
      ${sectionsHtml}
    </main>`;
}

// Injecte titre/description/canonical/OG spécifiques à la page + le contenu
// pré-rendu dans une copie du template HTML de base.
function buildPageHtml({ routePath, title, description, contentHtml }){
  const url = `${SITE_URL}${routePath}`;
  let html = template;
  html = html.replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(title)}</title>`);
  html = html.replace(/(<meta name="description" content=")[^"]*(")/, `$1${escapeHtml(description)}$2`);
  html = html.replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${escapeHtml(url)}$2`);
  html = html.replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${escapeHtml(url)}$2`);
  html = html.replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${escapeHtml(title)}$2`);
  html = html.replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${escapeHtml(description)}$2`);
  html = html.replace('<div id="root"></div>', `<div id="root">${contentHtml}</div>`);
  return html;
}

function writePage(routePath, html){
  const dir = path.join(DIST, routePath);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "index.html"), html, "utf-8");
  console.log(`  ✓ ${routePath}/index.html`);
}

console.log("Pré-rendu des pages publiques…");

// Pages issues de INFO_PAGES (content.js)
for (const [key, page] of Object.entries(INFO_PAGES)){
  const meta = PAGE_META[key] || { title: page.title, description: page.subtitle };
  const html = buildPageHtml({
    routePath: `/${key}`,
    title: meta.title,
    description: meta.description,
    contentHtml: renderInfoContent(page),
  });
  writePage(key, html);
}

// Pages légales (terms, privacy, legal)
for (const [key, page] of Object.entries(LEGAL_PAGES)){
  const html = buildPageHtml({
    routePath: `/${key}`,
    title: `${page.title} — StudyReach`,
    description: page.sections[0]?.c?.slice(0, 155) || page.title,
    contentHtml: renderLegalContent(page),
  });
  writePage(key, html);
}

console.log("Pré-rendu terminé.");
