// api/charge-ai-fee.js
// Prélève les 10€ de frais IA StudyReach au moment de la publication d'une étude IA.
// L'argent vient du solde plateforme Stripe (déjà chargé via wallet du chercheur).
// On crée un PaymentIntent en prélevant 1000 cts directement sur le solde Stripe
// de la plateforme — pas de transfert externe, juste un log comptable.
//
// Concrètement : le chercheur a rechargé son wallet → l'argent est sur le solde
// Stripe plateforme. On "isole" 10€ comme revenus IA via un transfer vers
// STRIPE_PLATFORM_ACCOUNT (ton propre compte Connect ou un compte séparé),
// ou plus simplement on le logue sans bouger d'argent (l'argent est DÉJÀ là).
//
// Choix retenu : on logue la transaction Supabase (frais IA = revenus plateforme)
// sans créer de transfert Stripe supplémentaire, car l'argent est déjà sur le
// solde plateforme. Stripe le versera avec le reste chaque vendredi via payout auto.

import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-05-27.dahlia",
});

const SUPABASE_URL = process.env.SUPABASE_URL || "https://bwaoxwfkqqpqvtpynwzh.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AI_FEE = 10; // 10€ fixes pour chaque étude IA publiée

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { studyId, researcherId, researcherEmail } = req.body || {};

  if (!studyId || !researcherId) {
    return res.status(400).json({ error: "studyId et researcherId requis." });
  }

  try {
    // Log comptable dans Supabase — les 10€ sont déjà sur le solde plateforme Stripe
    // (le chercheur a rechargé son wallet, cet argent est arrivé en checkout.session.completed).
    // Pas besoin de mouvement Stripe supplémentaire : Stripe les versera automatiquement
    // sur ton IBAN chaque vendredi via le payout automatique plateforme.
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
        amount: AI_FEE,
        fee: 0,
        total: AI_FEE,
        status: "completed",
        description: `Frais étude IA StudyReach — étude #${studyId}`,
        created_at: new Date().toISOString(),
      }),
    });

    return res.status(200).json({ success: true, aiFee: AI_FEE });
  } catch (err) {
    console.error("AI fee log error:", err);
    // Non-bloquant : si le log échoue, l'étude est quand même publiée
    return res.status(200).json({ success: true, aiFee: AI_FEE, warning: "Log partiel" });
  }
}
