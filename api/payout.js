// api/payout.js
// Versement à un participant via Stripe Connect (remplace PayPal Payouts).
// Le participant DOIT avoir fait son onboarding Connect (stripe_account_id présent
// + transfers actifs). Sinon on renvoie { error, needsOnboarding:true } et le front
// déclenche /api/create-connect-account.
//
// Modèle financier : le chercheur a déjà rechargé son wallet (argent sur le solde
// plateforme Stripe). On transfère le NET (90% de la base) au compte Connect du
// participant ; la commission (10% + supplément IA) reste sur le solde plateforme.
//
// ⚠️ RETRAIT AUTORITATIF SERVEUR (studyId="withdrawal") :
//   On NE fait PAS confiance au montant envoyé par le front. On recalcule la
//   somme due DEPUIS la DB (participations paid=true & paid_to_bank=false), on
//   transfère exactement ce montant, et on marque exactement CES participations
//   comme versées (par id). Ainsi un crédit qui arriverait entre le chargement
//   de la page et le clic "Retirer" n'est jamais perdu, et on ne peut pas
//   sous/sur-payer en se basant sur un montant client périmé.

import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-05-27.dahlia",
});

const SUPABASE_URL = process.env.SUPABASE_URL || "https://bwaoxwfkqqpqvtpynwzh.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AI_SURCHARGE = 10; // €, supplément IA — marge plateforme, jamais versé au participant

const svcHeaders = {
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
};

// Rémunération NETTE = 90% de la base (hors supplément IA). DOIT rester aligné
// sur participantNet() côté front (App.jsx) et la cron check-validation-deadlines.
function participantNet(costPerParticipant, isAi) {
  const base = Math.max(0, (Number(costPerParticipant) || 0) - (isAi ? AI_SURCHARGE : 0));
  return Math.round(base * 0.9 * 100) / 100;
}

async function getProfile(userId) {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=id,email,stripe_account_id`,
    { headers: svcHeaders }
  );
  const rows = await r.json();
  return Array.isArray(rows) ? rows[0] : null;
}

// Calcule le solde retirable DEPUIS la DB et renvoie les ids exacts à solder.
async function getOwed(participantId) {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/participations?participant_id=eq.${participantId}&paid=eq.true&paid_to_bank=eq.false&select=id,study_id`,
    { headers: svcHeaders }
  );
  const parts = await r.json();
  if (!Array.isArray(parts) || parts.length === 0) return { ids: [], amount: 0 };

  const studyIds = [...new Set(parts.map((p) => p.study_id).filter((x) => x != null))];
  let sMap = new Map();
  if (studyIds.length) {
    const sr = await fetch(
      `${SUPABASE_URL}/rest/v1/studies?id=in.(${studyIds.join(",")})&select=id,cost_per_participant,ai`,
      { headers: svcHeaders }
    );
    const studies = await sr.json();
    sMap = new Map((Array.isArray(studies) ? studies : []).map((s) => [String(s.id), s]));
  }

  let amount = 0;
  for (const p of parts) {
    const s = sMap.get(String(p.study_id));
    amount += participantNet(Number(s?.cost_per_participant || 0), !!s?.ai);
  }
  return { ids: parts.map((p) => p.id), amount: Math.round(amount * 100) / 100 };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { studyAmount, studyId, participantId, participantEmail } = req.body || {};
  if (!participantId) {
    return res.status(400).json({ error: "Données manquantes : participantId requis." });
  }

  const isWithdrawal = String(studyId || "") === "withdrawal";

  // Détermine le montant À VERSER et les participations à solder.
  let participantAmount;
  let owedIds = null; // ids exacts à marquer paid_to_bank=true (retrait uniquement)

  if (isWithdrawal) {
    // Autoritatif serveur : on ignore studyAmount du front.
    const owed = await getOwed(participantId);
    if (owed.amount < 1 || owed.ids.length === 0) {
      return res.status(400).json({ error: "Aucun gain disponible au retrait." });
    }
    participantAmount = owed.amount;
    owedIds = owed.ids;
  } else {
    // Chemin par étude (hérité ; plus appelé par le front en modèle "solde retirable").
    if (!studyAmount) {
      return res.status(400).json({ error: "Données manquantes : studyAmount requis." });
    }
    participantAmount = Math.round(parseFloat(studyAmount) * 100) / 100;
    if (participantAmount < 1) {
      return res.status(400).json({ error: "Montant trop faible (minimum 1€)." });
    }
  }

  const fee = 0;

  try {
    const profile = await getProfile(participantId);
    const accountId = profile?.stripe_account_id;

    if (!accountId) {
      return res.status(409).json({
        error: "Le participant n'a pas encore configuré son compte de paiement Stripe.",
        needsOnboarding: true,
      });
    }

    const account = await stripe.accounts.retrieve(accountId);
    if (!account.payouts_enabled || !account.capabilities?.transfers) {
      return res.status(409).json({
        error: "Onboarding Stripe incomplet.",
        needsOnboarding: true,
      });
    }

    const transfer = await stripe.transfers.create(
      {
        amount: Math.round(participantAmount * 100),
        currency: "eur",
        destination: accountId,
        description: isWithdrawal
          ? `Retrait gains StudyReach`
          : `Paiement étude StudyReach #${studyId || ""}`,
        metadata: {
          studyId: String(studyId || ""),
          participantId: String(participantId),
          kind: isWithdrawal ? "withdrawal" : "study_payout",
        },
      },
      // Idempotence : empêche un double versement si retry. Montant inclus →
      // un re-clic avec le même dû recalcule le même montant → même clé.
      { idempotencyKey: `payout_${participantId}_${isWithdrawal ? "wd" : studyId}_${participantAmount}` }
    );

    // 🔒 Verrou anti double-paiement : marquer paid_to_bank=true APRÈS transfert.
    //   - Retrait : on solde EXACTEMENT les participations qu'on vient de payer
    //     (par id) — pas un filtre large. Un crédit arrivé entre-temps n'est pas
    //     dans owedIds → reste dû → retirable au prochain coup.
    //   - Par étude (hérité) : on cible study_id + participant_id.
    {
      const filter = isWithdrawal
        ? `id=in.(${owedIds.join(",")})`
        : `study_id=eq.${studyId}&participant_id=eq.${participantId}`;
      await fetch(`${SUPABASE_URL}/rest/v1/participations?${filter}`, {
        method: "PATCH",
        headers: { ...svcHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ paid_to_bank: true }),
      }).catch((e) => console.warn("paid_to_bank update failed (non-blocking):", e.message));
    }

    await fetch(`${SUPABASE_URL}/rest/v1/transactions`, {
      method: "POST",
      headers: { ...svcHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        type: "payout",
        study_id: isWithdrawal ? null : (studyId || null),
        participant_id: participantId,
        participant_email: participantEmail || profile?.email || null,
        amount: participantAmount,
        fee,
        total: participantAmount,
        stripe_transfer_id: transfer.id,
        status: "processing",
        created_at: new Date().toISOString(),
      }),
    }).catch((e) => console.warn("Transaction log failed (non-blocking):", e.message));

    return res.status(200).json({
      success: true,
      participantAmount,
      fee,
      transferId: transfer.id,
      settledCount: isWithdrawal ? owedIds.length : 1,
    });
  } catch (err) {
    console.error("Stripe payout error:", err);
    return res.status(500).json({ error: "Erreur versement Stripe", details: err.message });
  }
}
