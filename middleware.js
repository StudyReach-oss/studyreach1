// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  DÉTECTION DES PASSAGES DE ROBOTS IA (observabilité)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Pourquoi ce fichier existe : la home et toutes les pages publiques
// (/, /pricing, /faq, /blog/...) sont servies en statique depuis dist/
// via des "rewrites" (voir vercel.json) — jamais par une fonction. Les
// "Runtime Logs" de Vercel ne capturent QUE les exécutions de fonctions,
// donc un passage de GPTBot/ChatGPT-User/ClaudeBot/PerplexityBot sur ces
// pages était jusqu'ici invisible : ni erreur, ni trace, juste un angle
// mort de mesure.
//
// Ce "Routing Middleware" (fonctionnalité Vercel indépendante du
// framework, voir https://vercel.com/docs/routing-middleware) s'exécute
// AVANT la résolution des rewrites, sur (quasi) toutes les requêtes — y
// compris celles qui vont finir servies en statique. Quand le User-Agent
// correspond à un robot IA connu (même liste que public/robots.txt), on
// écrit une ligne de log structurée, PUIS on laisse la requête continuer
// normalement via next() : aucun changement de contenu, de timing perçu
// ni de comportement pour qui que ce soit — humain ou robot.
//
// Chaque passage est ENREGISTRÉ dans Supabase (table public.ai_bot_visits,
// voir supabase/migrations/20260928081213_ai_bot_visits.sql) : historique illimité,
// alors que les Runtime Logs Vercel n'ont qu'une rétention courte (Hobby 1h,
// Pro 1 jour). Le console.log est conservé en plus (utile pour un diagnostic
// immédiat dans Project → Logs).
//
// Moteurs de recherche classiques : Googlebot et Bingbot sont suivis aussi,
// dans la même table (colonne "bot"), pour pouvoir COMPARER. OpenAI indique
// que la recherche ChatGPT s'appuie en partie sur des moteurs tiers : une page
// que Bingbot ne lit jamais a donc moins de chances d'être vue. Le User-Agent
// de Bing est en minuscules ("bingbot/2.0") → la détection ignore la casse.
//
// Variables d'environnement (Vercel → Settings → Environment Variables) :
//   SUPABASE_URL               (sinon l'URL du projet par défaut ci-dessous)
//   SUPABASE_SERVICE_ROLE_KEY  (déjà utilisée par les routes /api)
// Sans clé, le middleware continue de fonctionner (log console seulement).
//
// L'écriture se fait en arrière-plan via waitUntil() : elle ne retarde jamais
// la réponse au robot, et une erreur Supabase ne casse jamais la requête.
//
// ⚠ Limite : le pare-feu Vercel s'exécute AVANT ce middleware. Un bot bloqué
// ou "challengé" par le pare-feu n'apparaîtra donc PAS dans la table — voir
// Vercel → Firewall → Traffic pour vérifier qu'OAI-SearchBot et ChatGPT-User
// ne sont ni challengés ni refusés.

import { next, waitUntil } from '@vercel/functions';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bwaoxwfkqqpqvtpynwzh.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Même liste que public/robots.txt — un seul endroit à tenir à jour si un
// nouveau crawler IA apparaît (ex. un futur bot d'un autre fournisseur).
const AI_BOTS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-SearchBot',
  'Claude-User',
  'PerplexityBot',
  'Perplexity-User',
  // ⚠ Google-Extended n'existe pas comme User-Agent : c'est un jeton robots.txt
  // uniquement (l'exploration se fait avec les User-Agents Google habituels,
  // donc via Googlebot). Cette entrée ne matchera jamais ; gardée pour mémoire.
  'Google-Extended',
];

// Moteurs de recherche classiques, suivis pour comparaison avec les robots IA.
const SEARCH_BOTS = [
  'Googlebot',
  'Bingbot',
];

const TRACKED_BOTS = [...AI_BOTS, ...SEARCH_BOTS];

export const config = {
  // Runtime Node.js (le runtime « edge » est déprécié par Vercel). Rien d'autre
  // à changer : fetch, AbortSignal.timeout, waitUntil() et next() fonctionnent
  // à l'identique, et l'en-tête x-vercel-ip-country reste disponible.
  runtime: 'nodejs',
  // On exclut /api/* (déjà couvert par les Runtime Logs classiques) et
  // /assets/* (bundle JS/CSS généré par Vite — sans intérêt ici, un
  // robot qui ne charge pas le JS ne les demande de toute façon jamais).
  matcher: ['/((?!api/|assets/).*)'],
};

export default function middleware(request) {
  const userAgent = request.headers.get('user-agent') || '';
  // Comparaison insensible à la casse (Bing envoie "bingbot", pas "Bingbot").
  // Le nom enregistré en base reste celui de la liste (ex. "Bingbot").
  const userAgentLower = userAgent.toLowerCase();
  const matchedBot = TRACKED_BOTS.find((name) => userAgentLower.includes(name.toLowerCase()));

  if (matchedBot) {
    const { pathname } = new URL(request.url);
    const timestamp = new Date().toISOString();
    // Une seule ligne JSON par passage : facile à filtrer/grep dans les
    // Function Logs Vercel (recherche "ai_bot_visit" ou le nom du bot).
    console.log(JSON.stringify({
      event: 'ai_bot_visit',
      bot: matchedBot,
      path: pathname,
      userAgent,
      timestamp,
    }));

    if (SUPABASE_SERVICE_KEY) {
      waitUntil(
        fetch(`${SUPABASE_URL}/rest/v1/ai_bot_visits`, {
          method: 'POST',
          headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({
            visited_at: timestamp,
            bot: matchedBot,
            path: pathname,
            user_agent: userAgent.slice(0, 500),
            country: request.headers.get('x-vercel-ip-country'),
          }),
          signal: AbortSignal.timeout(5000),
        }).catch((err) => {
          console.error(JSON.stringify({ event: 'ai_bot_visit_store_failed', error: String(err && err.message || err) }));
        })
      );
    }
  }

  return next();
}
