// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  MIDDLEWARE SEO — injecte title / description / canonical / og:*
//  directement dans le HTML servi, AVANT toute exécution JavaScript.
//
//  Pourquoi : la SPA React met déjà à jour ces balises en JS
//  (voir applyPageMeta() dans App.jsx), mais un canonical réécrit après
//  coup est un signal faible pour les moteurs — beaucoup de crawlers
//  (Bing, IA, etc.) ne l'exécutent jamais. Ce middleware fait la même
//  chose, mais dans le HTML brut renvoyé au tout premier chargement.
//
//  Les valeurs ci-dessous DOIVENT rester synchronisées avec PAGE_META
//  dans App.jsx (~ligne 7920). Si tu changes un titre/une description
//  à un endroit, change-le aussi dans l'autre.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const config = {
  matcher: [
    "/",
    "/blog",
    "/how-it-works",
    "/pricing",
    "/for-participants",
    "/faq",
    "/status",
    "/terms",
    "/privacy",
    "/legal",
  ],
};

const SITE_URL = "https://www.getstudyreach.com";

const DEFAULT_TITLE =
  "StudyReach — Trouvez des participants rémunérés pour vos études | France";
const DEFAULT_DESC =
  "StudyReach connecte chercheurs et participants rémunérés en France. Recrutez rapidement des profils ciblés pour vos études UX, entretiens IA, questionnaires. Paiement sécurisé, ciblage précis.";

// Doit rester identique à PAGE_META dans App.jsx.
const PAGE_META = {
  "/blog": {
    title:
      "Blog — Comment recruter des participants pour une étude en France | StudyReach",
    description:
      "Guide complet pour recruter des participants qualifiés à une étude : méthodes classiques, leurs limites, et alternatives — recherche académique, UX, consommation.",
  },
  "/faq": {
    title: "FAQ — StudyReach",
    description:
      "Questions fréquentes sur StudyReach : tarifs, recrutement de participants, paiement, sécurité.",
  },
  "/pricing": {
    title: "Tarifs — StudyReach",
    description:
      "Découvrez les tarifs StudyReach pour recruter des participants rémunérés à vos études.",
  },
  "/how-it-works": {
    title: "Comment ça marche — StudyReach",
    description:
      "Comment StudyReach connecte chercheurs et participants rémunérés pour vos études, étape par étape.",
  },
  "/for-participants": {
    title: "Devenir participant rémunéré — StudyReach",
    description:
      "Participez à des études rémunérées en France via StudyReach : inscription, critères, paiement.",
  },
  // "/status", "/terms", "/privacy", "/legal" utilisent le titre/desc par
  // défaut ci-dessus pour l'instant — ajoute des entrées ici si tu veux
  // les personnaliser aussi.
};

// Échappe les caractères spéciaux pour une insertion sûre dans du HTML/attribut.
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default async function middleware(request) {
  const url = new URL(request.url);
  const path = url.pathname === "/" ? "/" : url.pathname.replace(/\/+$/, "");

  const meta = PAGE_META[path];
  const title = escapeHtml(meta ? meta.title : DEFAULT_TITLE);
  const description = escapeHtml(meta ? meta.description : DEFAULT_DESC);
  const canonicalUrl = `${SITE_URL}${path === "/" ? "/" : path}`;

  // On récupère le vrai index.html statique (celui buildé par Vite),
  // sans repasser par ce middleware (le matcher ne cible pas /index.html).
  let html;
  try {
    const originRes = await fetch(new URL("/index.html", request.url));
    html = await originRes.text();
  } catch (e) {
    // En cas d'échec réseau improbable, on laisse passer la requête
    // normalement plutôt que de casser le site.
    return new Response(null, { status: 500 });
  }

  html = html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`)
    .replace(
      /<meta name="description" content="[\s\S]*?"\s*\/>/,
      `<meta name="description" content="${description}" />`
    )
    .replace(
      /<link rel="canonical" href="[\s\S]*?"\s*\/>/,
      `<link rel="canonical" href="${canonicalUrl}" />`
    )
    .replace(
      /<meta property="og:title" content="[\s\S]*?"\s*\/>/,
      `<meta property="og:title" content="${title}" />`
    )
    .replace(
      /<meta property="og:description" content="[\s\S]*?"\s*\/>/,
      `<meta property="og:description" content="${description}" />`
    )
    .replace(
      /<meta property="og:url" content="[\s\S]*?"\s*\/>/,
      `<meta property="og:url" content="${canonicalUrl}" />`
    )
    .replace(
      /<meta name="twitter:title" content="[\s\S]*?"\s*\/>/,
      `<meta name="twitter:title" content="${title}" />`
    )
    .replace(
      /<meta name="twitter:description" content="[\s\S]*?"\s*\/>/,
      `<meta name="twitter:description" content="${description}" />`
    );

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
    },
  });
}
