// Vérifie que les URLs `sameAs` de l'Organization (index.html) répondent.
// Lancé par "postbuild" (voir package.json), APRÈS prerender.mjs.
//
// - N'échoue JAMAIS le build : uniquement des avertissements dans les logs.
// - 404 / 410 / erreur réseau  → ⚠ lien probablement mort : à corriger ou retirer.
// - 401 / 403 / 429 / 999      → « non concluant » : G2, Product Hunt, LinkedIn
//   etc. bloquent souvent les requêtes automatisées. À vérifier à la main.
// - 2xx / 3xx                  → OK.
// - Ne tourne qu'en production Vercel (ou CHECK_SAMEAS_FORCE=1 en local).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INDEX = path.join(__dirname, "..", "index.html");
const UA = "Mozilla/5.0 (compatible; StudyReachLinkCheck/1.0; +https://www.getstudyreach.com)";

function extractSameAs(html){
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  const urls = [];
  for (const [, raw] of blocks) {
    try {
      const json = JSON.parse(raw);
      if (json["@type"] === "Organization" && Array.isArray(json.sameAs)) urls.push(...json.sameAs);
    } catch { /* bloc JSON-LD invalide : ignoré ici */ }
  }
  return urls;
}

async function probe(url){
  for (const method of ["HEAD", "GET"]) {
    try {
      const res = await fetch(url, { method, redirect: "follow", headers: { "user-agent": UA }, signal: AbortSignal.timeout(10000) });
      if (method === "HEAD" && (res.status === 405 || res.status === 501)) continue; // HEAD refusé → on retente en GET
      return res.status;
    } catch (err) {
      if (method === "GET") return `erreur réseau (${err.cause?.code || err.name})`;
    }
  }
  return "inconnu";
}

async function main(){
  if (process.env.VERCEL_ENV !== "production" && !process.env.CHECK_SAMEAS_FORCE) {
    console.log("sameAs : vérification ignorée (pas un build de production).");
    return;
  }
  const urls = extractSameAs(readFileSync(INDEX, "utf-8"));
  if (urls.length === 0) { console.log("sameAs : aucune URL trouvée dans index.html."); return; }
  console.log(`Vérification de ${urls.length} URLs sameAs…`);
  for (const url of urls) {
    const status = await probe(url);
    if (typeof status === "number" && status >= 200 && status < 400) console.log(`  ✓ ${status} ${url}`);
    else if ([401, 403, 429, 999].includes(status)) console.log(`  ? ${status} ${url} — non concluant (anti-bot), à vérifier à la main`);
    else console.warn(`  ⚠ ${status} ${url} — lien probablement mort : corriger ou retirer de index.html`);
  }
}

main().catch(err => console.warn(`sameAs : vérification interrompue (${err.message}) — build non affecté.`));
