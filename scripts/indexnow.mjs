// Notifie IndexNow (Bing, Yandex, etc.) de toutes les URLs du sitemap
// après chaque build. Lancé par "postbuild" dans package.json, APRÈS
// prerender.mjs (qui génère dist/sitemap.xml).
//
// - Ne s'exécute qu'en production Vercel (pas en preview ni en local).
// - Ne fait JAMAIS échouer le build : toute erreur est juste loguée.
// - Forcer un envoi en local : INDEXNOW_FORCE=1 node scripts/indexnow.mjs

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const KEY = "5bb231cebfffbe53ccc3b37dc9cf2526"; // doit correspondre à public/5bb231cebfffbe53ccc3b37dc9cf2526.txt
const HOST = "www.getstudyreach.com";
const SITE_URL = `https://${HOST}`;
const ENDPOINT = "https://api.indexnow.org/indexnow";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, "..", "dist");

async function main(){
  if (process.env.VERCEL_ENV !== "production" && !process.env.INDEXNOW_FORCE){
    console.log("IndexNow : ignoré (pas un build de production).");
    return;
  }

  const sitemapPath = path.join(DIST, "sitemap.xml");
  if (!existsSync(sitemapPath)){
    console.log("IndexNow : dist/sitemap.xml introuvable, abandon.");
    return;
  }
  if (!existsSync(path.join(DIST, `${KEY}.txt`))){
    console.log("IndexNow : fichier clé absent de dist/, abandon.");
    return;
  }

  const xml = readFileSync(sitemapPath, "utf-8");
  const urlList = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map(m => m[1].trim())
    .filter(u => u.startsWith(SITE_URL));

  if (!urlList.length){
    console.log("IndexNow : aucune URL trouvée dans le sitemap.");
    return;
  }

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: HOST,
      key: KEY,
      keyLocation: `${SITE_URL}/${KEY}.txt`,
      urlList,
    }),
  });

  // 200/202 = accepté. 403/422 = clé non vérifiée (normal au tout premier
  // déploiement, le fichier clé n'est pas encore en ligne pendant le build).
  console.log(`IndexNow : ${urlList.length} URLs envoyées, réponse HTTP ${res.status}`);
}

main().catch(err => console.log("IndexNow : erreur ignorée —", err.message));
