// api/charge-ai-fee.js
// Log informatif du budget "frais IA" réservé au moment de la publication d'une
// étude IA (10€ × nombre de participants visés = ce qui est bloqué sur le wallet
// du chercheur au titre du supplément IA — voir studyCost dans App.jsx).
// Aucun mouvement d'argent ici : le budget est déjà bloqué via la RPC
// block_study_budget, et le revenu RÉEL de la plateforme (marge + frais IA sur
// les participations effectivement validées) est recalculé indépendamment,
// à l'euro près, par api/margin-payout.js à partir des tables participations/
// studies — CE endpoint n'alimente PAS ce calcul et n'est PAS une source de
// vérité financière. Il sert uniquement de repère lisible dans l'historique
// des transactions ("combien de frais IA potentiels sur cette étude").
//
// ⚠️ Le montant loggé ici est un MAXIMUM théorique (si tous les participants
// visés vont au bout) et peut être supérieur au frais IA réellement gagné si
// l'étude n'est pas remplie à 100% — c'est normal, ce n'est pas un encaissement.

import Stripe from "stripe";
import { requireUser, unauthorized } from "./_lib/auth.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-05-27.dahlia",
});

const SUPABASE_URL = process.env.SUPABASE_URL || "https://bwaoxwfkqqpqvtpynwzh.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AI_FEE = 10; // 10€ fixes pour chaque étude IA publiée

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // 🔒 AUTH — empêche l'injection de fausses transactions comptables par
  // un appel anonyme. Le researcherId vient du JWT, pas du body.
  const user = await requireUser(req);
  if (!user) return unauthorized(res);

  const { studyId, researcherEmail, maxParticipants } = req.body || {};
  const researcherId = user.id; // identité autoritative (token), body ignoré

  if (!studyId) {
    return res.status(400).json({ error: "studyId requis." });
  }

  // Montant informatif = 10€ × participants visés (plafond théorique du frais IA
  // pour cette étude). Si maxParticipants n'est pas fourni ou invalide, on retombe
  // sur 10€ (comportement historique) plutôt que d'échouer — ce log est non-bloquant
  // et purement indicatif, jamais utilisé comme source de vérité financière.
  const n = Number(maxParticipants);
  const aiFeeAmount = Number.isFinite(n) && n > 0 ? AI_FEE * n : AI_FEE;

  try {
    // Log informatif dans Supabase (voir explication en tête de fichier) — aucun
    // mouvement d'argent ici, le budget est déjà bloqué via block_study_budget.
    await fetch(`${SUPABASE_URL}/rest/v1/transactions`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        type: "ai_fee",
        study_id: studyId,
        user_id: researcherId,
        participant_email: researcherEmail || null,
        amount: aiFeeAmount,
        fee: 0,
        total: aiFeeAmount,
        status: "completed",
        description: `Frais IA réservés (max. théorique, ${maxParticipants || 1} participant(s)) — étude #${studyId}`,
        created_at: new Date().toISOString(),
      }),
    });

    return res.status(200).json({ success: true, aiFee: aiFeeAmount });
  } catch (err) {
    console.error("AI fee log error:", err);
    // Non-bloquant : si le log échoue, l'étude est quand même publiée
    return res.status(200).json({ success: true, aiFee: aiFeeAmount, warning: "Log partiel" });
  }
}
