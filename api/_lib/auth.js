// api/_lib/auth.js
// 🔒 Vérification d'identité pour TOUS les endpoints /api/* (sauf webhook,
// qui est déjà protégé par la signature Stripe).
//
// Principe : le front envoie le JWT Supabase de l'utilisateur connecté dans
// le header "Authorization: Bearer <token>". On le valide auprès de Supabase
// (/auth/v1/user) et on renvoie l'utilisateur. Chaque endpoint utilise ensuite
// user.id comme SEULE source d'identité — les userId/participantId/researcherId
// envoyés par le front ne sont JAMAIS utilisés pour décider "qui" est payé/débité.
//
// ⚠️ Le préfixe "_" (dossier _lib) empêche Vercel de déployer ce fichier
// comme endpoint public — c'est un simple module partagé.

const SUPABASE_URL = process.env.SUPABASE_URL || "https://bwaoxwfkqqpqvtpynwzh.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Extrait et valide le JWT Supabase de la requête.
 * @returns {Promise<{id: string, email: string}|null>} l'utilisateur, ou null si invalide/absent.
 */
export async function requireUser(req) {
  try {
    const auth = req.headers["authorization"] || req.headers["Authorization"] || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
    if (!token) return null;

    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!r.ok) return null;

    const user = await r.json();
    return user && user.id ? user : null;
  } catch (e) {
    console.error("[auth] Vérification token échouée:", e.message);
    return null;
  }
}

/** Réponse 401 standardisée. */
export function unauthorized(res) {
  return res.status(401).json({
    error: "Non autorisé. Veuillez vous reconnecter.",
    needsAuth: true,
  });
}
