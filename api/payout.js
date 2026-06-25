// api/payout.js
// Versement à un participant via Stripe Connect (remplace PayPal Payouts).
// Le participant DOIT avoir fait son onboarding Connect (stripe_account_id présent
// + transfers actifs). Sinon on renvoie { error, needsOnboarding:true } et le front
// déclenche /api/create-connect-account.
//
// Modèle financier : le chercheur a déjà rechargé son wallet (argent sur le solde
// plateforme Stripe). On transfère 90% au compte Connect du participant ; les 10%
// de commission restent simplement sur le solde plateforme. Pas de transfert "fee".

import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-05-27.dahlia",
});

// Plus de FEE_RATE ici : la commission est retenue en amont (budget bloqué),
// pas au moment du versement. payout.js transfère le NET tel que reçu du front.
const SUPABASE_URL = process.env.SUPABASE_URL || "https://bwaoxwfkqqpqvtpynwzh.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function getProfile(userId) {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=id,email,stripe_account_id`,
    { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } }
  );
  const rows = await r.json();
  return Array.isArray(rows) ? rows[0] : null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // participantId requis pour retrouver le compte Connect
  const { studyAmount, studyId, participantId, participantEmail } = req.body || {};

  if (!participantId || !studyAmount) {
    return res.status(400).json({ error: "Données manquantes : participantId et studyAmount requis." });
  }

  // ⚠️ Le front envoie DÉJÀ le montant NET dû au participant
  // (participantNet = 90% de la base, hors supplément IA). La commission
  // StudyReach (10% + supplément IA) a déjà été retenue en amont : le budget
  // bloqué à la publication couvre le studyCost plein, mais on ne transfère
  // que le net. On ne re-déduit donc RIEN ici, sinon double commission.
  const totalAmount = parseFloat(studyAmount);
  const participantAmount = Math.round(totalAmount * 100) / 100;
  const fee = 0;

  if (participantAmount < 1) {
    return res.status(400).json({ error: "Montant trop faible (minimum 1€)." });
  }

  try {
    const profile = await getProfile(participantId);
    const accountId = profile?.stripe_account_id;

    // Pas de compte Connect → onboarding requis
    if (!accountId) {
      return res.status(409).json({
        error: "Le participant n'a pas encore configuré son compte de paiement Stripe.",
        needsOnboarding: true,
      });
    }

    // Vérifie que le compte peut recevoir des transferts
    const account = await stripe.accounts.retrieve(accountId);
    if (!account.payouts_enabled || !account.capabilities?.transfers) {
      return res.status(409).json({
        error: "Onboarding Stripe incomplet.",
        needsOnboarding: true,
      });
    }

    // Transfert 90% vers le compte Connect du participant
    const transfer = await stripe.transfers.create(
      {
        amount: Math.round(participantAmount * 100),
        currency: "eur",
        destination: accountId,
        description: `Paiement étude StudyReach #${studyId || ""}`,
        metadata: {
          studyId: String(studyId || ""),
          participantId: String(participantId),
        },
      },
      // clé d'idempotence : empêche un double versement si retry
      { idempotencyKey: `payout_${participantId}_${studyId || "wd"}_${participantAmount}` }
    );

    // Log transaction (service role)
    await fetch(`${SUPABASE_URL}/rest/v1/transactions`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        type: "payout",
        study_id: studyId || null,
        participant_id: participantId,
        participant_email: participantEmail || profile?.email || null,
        amount: participantAmount,
        fee,
        total: totalAmount,
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
    });
  } catch (err) {
    console.error("Stripe payout error:", err);
    return res.status(500).json({ error: "Erreur versement Stripe", details: err.message });
  }
}
