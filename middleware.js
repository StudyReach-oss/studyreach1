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
// Les logs sont visibles dans le dashboard Vercel : Project → Logs.
// (Rétention limitée selon le plan — Hobby 1h, Pro 1 jour — donc pour un
// historique plus long il faudra un Log Drain vers un stockage externe,
// pas seulement ce middleware.)

import { next } from '@vercel/functions';

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
  'Google-Extended',
];

export const config = {
  // On exclut /api/* (déjà couvert par les Runtime Logs classiques) et
  // /assets/* (bundle JS/CSS généré par Vite — sans intérêt ici, un
  // robot qui ne charge pas le JS ne les demande de toute façon jamais).
  matcher: ['/((?!api/|assets/).*)'],
};

export default function middleware(request) {
  const userAgent = request.headers.get('user-agent') || '';
  const matchedBot = AI_BOTS.find((name) => userAgent.includes(name));

  if (matchedBot) {
    const { pathname } = new URL(request.url);
    // Une seule ligne JSON par passage : facile à filtrer/grep dans les
    // Function Logs Vercel (recherche "ai_bot_visit" ou le nom du bot).
    console.log(JSON.stringify({
      event: 'ai_bot_visit',
      bot: matchedBot,
      path: pathname,
      userAgent,
      timestamp: new Date().toISOString(),
    }));
  }

  return next();
}
