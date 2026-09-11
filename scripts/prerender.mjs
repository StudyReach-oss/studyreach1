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
import { PAGE_META, INFO_PAGES, LEGAL_PAGES, PRICING_OFFERS, AI_INTERVIEW_SURCHARGE, HOME_META, HOME_PAGE } from "../content.js";

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

// Construit le bloc HTML du contenu pour la page d'accueil ("/"), à partir
// de HOME_PAGE (content.js). Reprend les mêmes sections que Landing() dans
// App.jsx (hero, chercheurs, participants, CTA, FAQ), en HTML sémantique
// simple — c'est ce que verra un robot qui n'exécute pas JavaScript.
function renderHomeContent(page){
  const { hero, researchers, participants, cta, faq } = page;
  const statsHtml = hero.stats.map(([v,l]) => `<li><strong>${escapeHtml(v)}</strong> ${escapeHtml(l)}</li>`).join("\n");
  const researcherFeaturesHtml = researchers.features.map(f => `
      <li>
        <h3>${escapeHtml(f.icon)} ${escapeHtml(f.title)}</h3>
        <p>${escapeHtml(f.body)}</p>
      </li>`).join("\n");
  const participantBulletsHtml = participants.bullets.map(b => `<li>${escapeHtml(b)}</li>`).join("\n");
  const faqHtml = faq.map(f => `
      <div>
        <h3>${escapeHtml(f.q)}</h3>
        <p>${escapeHtml(f.a)}</p>
      </div>`).join("\n");

  return `
    <main>
      <section>
        <p>${escapeHtml(hero.eyebrow)}</p>
        <h1>${escapeHtml(hero.title)}</h1>
        <p>${escapeHtml(hero.subtitle)}</p>
        <ul>
${statsHtml}
        </ul>
      </section>
      <section>
        <h2>${escapeHtml(researchers.title)}</h2>
        <p>${escapeHtml(researchers.subtitle)}</p>
        <ul>
${researcherFeaturesHtml}
        </ul>
      </section>
      <section>
        <h2>${escapeHtml(participants.title)}</h2>
        <p>${escapeHtml(participants.subtitle)}</p>
        <ul>
${participantBulletsHtml}
        </ul>
      </section>
      <section>
        <h2>${escapeHtml(cta.title)}</h2>
        <p>${escapeHtml(cta.subtitle)}</p>
      </section>
      <section>
        <h2>Questions fréquentes</h2>
${faqHtml}
      </section>
    </main>`;
}

// Schema.org pour la page d'accueil : WebPage générique + FAQPage (les
// questions/réponses de la home), pour permettre aux moteurs et aux IA
// génératives d'extraire directement les Q/R dans leurs résultats.
function buildHomeSchema(meta, url, faq){
  const webPage = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": meta.title,
    "description": meta.description,
    "url": url,
    "inLanguage": "fr",
    "isPartOf": {
      "@type": "WebSite",
      "name": "StudyReach",
      "url": SITE_URL + "/",
    },
  };
  const faqPage = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faq.map(f => ({
      "@type": "Question",
      "name": f.q,
      "acceptedAnswer": { "@type": "Answer", "text": f.a },
    })),
  };
  return [webPage, faqPage];
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

// Génère le balisage schema.org (JSON-LD) pour une page.
// - "faq" : FAQPage, avec chaque section (question/réponse) en mainEntity.
//   C'est ce qui permet à Google et aux IA génératives d'extraire directement
//   question + réponse, potentiellement affichées telles quelles dans les
//   résultats de recherche / réponses IA.
// - "pricing" : Service + un Offer par durée, en plus du WebPage générique —
//   donne aux IA génératives un prix exact et structuré par formule plutôt
//   qu'une phrase en texte libre à interpréter ("10€ à 50€ / participant").
// - autres pages info (how-it-works, for-participants, blog, status) :
//   WebPage générique, qui rattache la page à l'organisation StudyReach et
//   désambiguïse son sujet pour les moteurs.
// Retourne toujours un tableau de schémas (un seul élément dans la plupart
// des cas) pour permettre d'empiler plusieurs @type sur une même page.
function buildSchema(key, page, meta, url){
  const webPage = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": meta.title,
    "description": meta.description,
    "url": url,
    "inLanguage": "fr",
    "isPartOf": {
      "@type": "WebSite",
      "name": "StudyReach",
      "url": SITE_URL + "/",
    },
  };

  if (key === "faq"){
    return [{
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": page.sections.map(s => ({
        "@type": "Question",
        "name": s.title,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": s.body,
        },
      })),
    }];
  }

  if (key === "pricing"){
    const service = {
      "@context": "https://schema.org",
      "@type": "Service",
      "name": "Recrutement de participants rémunérés pour études",
      "provider": { "@type": "Organization", "name": "StudyReach", "url": SITE_URL + "/" },
      "areaServed": "FR",
      "description": "Tarif par participant recruté, selon la durée de l'entretien. Le participant reçoit 90% du montant ; StudyReach prélève 10% de frais de service.",
      "offers": PRICING_OFFERS.map(o => ({
        "@type": "Offer",
        "name": `Entretien ${o.duration}`,
        "price": String(o.price),
        "priceCurrency": "EUR",
        "url": url,
        "eligibleDuration": { "@type": "QuantitativeValue", "value": o.minutes, "unitCode": "MIN" },
      })),
      "additionalProperty": {
        "@type": "PropertyValue",
        "name": "Option Entretiens IA",
        "description": `Surcoût de ${AI_INTERVIEW_SURCHARGE}€ par participant pour un entretien mené automatiquement par IA.`,
      },
    };
    return [webPage, service];
  }

  return [webPage];
}

function renderSchemaScript(schemas){
  // JSON.stringify échappe déjà les guillemets ; on échappe en plus "</"
  // pour ne jamais risquer de fermer prématurément la balise <script>.
  return schemas
    .map(s => `<script type="application/ld+json">${JSON.stringify(s).replace(/<\//g, "<\\/")}</script>`)
    .join("\n  ");
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
function buildPageHtml({ routePath, title, description, contentHtml, schemaHtml }){
  const url = `${SITE_URL}${routePath}`;
  let html = template;
  html = html.replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(title)}</title>`);
  html = html.replace(/(<meta name="description" content=")[^"]*(")/, `$1${escapeHtml(description)}$2`);
  html = html.replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${escapeHtml(url)}$2`);
  html = html.replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${escapeHtml(url)}$2`);
  html = html.replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${escapeHtml(title)}$2`);
  html = html.replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${escapeHtml(description)}$2`);
  html = html.replace('<div id="root"></div>', `<div id="root">${contentHtml}</div>`);
  if (schemaHtml) {
    // Ajouté juste avant </head>, à la suite du schema Organization/WebSite
    // déjà présent dans le template — on ne les remplace pas, on les complète.
    html = html.replace("</head>", `  ${schemaHtml}\n  </head>`);
  }
  return html;
}

function writePage(routePath, html){
  const dir = path.join(DIST, routePath);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "index.html"), html, "utf-8");
  console.log(`  ✓ ${routePath}/index.html`);
}

// Génère le sitemap.xml avec une date de dernière modification (<lastmod>)
// à chaque build, plutôt qu'un fichier statique sans date dans public/.
// Le <lastmod> aide les moteurs (et les IA génératives) à évaluer la
// fraîcheur du contenu. Comme on n'a pas de date réelle par page, on utilise
// la date du build : c'est une approximation raisonnable tant que le
// contenu de content.js n'a pas de date de mise à jour propre par page.
function generateSitemap(){
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const urls = [
    { loc: "/", changefreq: "weekly", priority: "1.0" },
    ...Object.keys(INFO_PAGES).map(key => ({
      loc: `/${key}`,
      changefreq: key === "status" ? "monthly" : "weekly",
      priority: key === "blog" || key === "how-it-works" || key === "pricing" ? "0.8" : "0.6",
    })),
    ...Object.keys(LEGAL_PAGES).map(key => ({
      loc: `/${key}`,
      changefreq: "yearly",
      priority: "0.2",
    })),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${SITE_URL}${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join("\n")}
</urlset>
`;

  writeFileSync(path.join(DIST, "sitemap.xml"), xml, "utf-8");
  console.log("  ✓ sitemap.xml (avec lastmod)");
}

console.log("Pré-rendu des pages publiques…");

// Page d'accueil ("/") — la plus importante à pré-rendre, c'est celle que
// Google et la plupart des robots explorent en premier. Avant ce correctif,
// elle n'était pas dans PAGES_TO_PRERENDER et restait un <div id="root">
// vide pour tout robot n'exécutant pas JavaScript.
{
  const url = `${SITE_URL}/`;
  const html = buildPageHtml({
    routePath: "",
    title: HOME_META.title,
    description: HOME_META.description,
    contentHtml: renderHomeContent(HOME_PAGE),
    schemaHtml: renderSchemaScript(buildHomeSchema(HOME_META, url, HOME_PAGE.faq)),
  });
  writePage("", html);
}

// Pages issues de INFO_PAGES (content.js)
for (const [key, page] of Object.entries(INFO_PAGES)){
  const meta = PAGE_META[key] || { title: page.title, description: page.subtitle };
  const url = `${SITE_URL}/${key}`;
  const html = buildPageHtml({
    routePath: `/${key}`,
    title: meta.title,
    description: meta.description,
    contentHtml: renderInfoContent(page),
    schemaHtml: renderSchemaScript(buildSchema(key, page, meta, url)),
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

// Sitemap avec dates, généré après les pages
generateSitemap();

console.log("Pré-rendu terminé.");
