// api/payout.js
// Versement à un participant via Stripe Connect.
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
import crypto from "crypto";
import { requireUser, unauthorized } from "./_lib/auth.js";

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

  // 🔒 AUTH — seul l'utilisateur connecté peut déclencher SON PROPRE retrait.
  // L'identité vient du JWT vérifié, JAMAIS du body : un attaquant ne peut ni
  // déclencher le retrait d'autrui, ni se faire passer pour un autre participant.
  const user = await requireUser(req);
  if (!user) return unauthorized(res);

  const { studyId, participantEmail } = req.body || {};
  const participantId = user.id; // identité autoritative (token), body ignoré

  // 🔒 Seul le RETRAIT autoritatif serveur est accepté. L'ancien chemin "par étude"
  // (qui faisait confiance à un montant envoyé par le front) a été retiré : il n'était
  // plus appelé par l'app et constituait une surface d'attaque inutile. Toute requête
  // qui ne cible pas explicitement un retrait est désormais refusée.
  const isWithdrawal = String(studyId || "") === "withdrawal";
  if (!isWithdrawal) {
    return res.status(400).json({ error: "Requête invalide : seul le retrait est autorisé." });
  }

  // Montant À VERSER + participations à solder — recalculés DEPUIS la DB, jamais
  // depuis le front (un montant client ne peut pas influencer la somme versée).
  const owed = await getOwed(participantId);
  if (owed.amount <= 0 || owed.ids.length === 0) {
    return res.status(400).json({ error: "Aucun gain disponible au retrait." });
  }
  const participantAmount = owed.amount;
  const owedIds = owed.ids; // ids exacts à marquer paid_to_bank=true

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

    // 🛡️ ANTI-MULTICOMPTE (participants) — dédup par empreinte du compte bancaire.
    // L'empreinte d'un IBAN est IDENTIQUE d'un compte Connect à l'autre (donnée
    // KYC Stripe). Si le même IBAN est déjà lié à un AUTRE compte StudyReach, on
    // BLOQUE le retrait (l'argent reste crédité sur le solde, rien n'est volé) et
    // on FLAGUE les deux comptes (flagged_duplicate=true) pour review manuel.
    // Marche même avec des emails différents. Non bloquant si l'empreinte est
    // indisponible ou si l'appel Stripe échoue (on ne casse pas un retrait légitime
    // sur une erreur transitoire ; le doublon serait rattrapé au prochain essai).
    try {
      const ext = await stripe.accounts.listExternalAccounts(accountId, {
        object: "bank_account",
        limit: 1,
      });
      const fp = ext?.data?.[0]?.fingerprint || null;
      if (fp) {
        const dr = await fetch(
          `${SUPABASE_URL}/rest/v1/profiles?payout_fingerprint=eq.${encodeURIComponent(fp)}&id=neq.${participantId}&select=id`,
          { headers: svcHeaders }
        );
        const dups = await dr.json();
        if (Array.isArray(dups) && dups.length > 0) {
          const flagIds = [participantId, ...dups.map((d) => d.id)];
          await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=in.(${flagIds.join(",")})`, {
            method: "PATCH",
            headers: { ...svcHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
            body: JSON.stringify({ flagged_duplicate: true }),
          }).catch(() => {});
          console.error(
            `[payout] ANTI-FRAUDE: retrait bloqué — empreinte bancaire ${fp} déjà liée à ` +
              `${dups.map((d) => d.id).join(",")} (participant ${participantId})`
          );
          return res.status(409).json({
            error:
              "Ce moyen de paiement est déjà associé à un autre compte StudyReach. Par sécurité, le retrait est bloqué. Si vous pensez qu'il s'agit d'une erreur, contactez contact@getstudyreach.com.",
            duplicateAccount: true,
          });
        }
        // Première fois qu'on voit cette empreinte pour ce compte → on l'enregistre.
        await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${participantId}`, {
          method: "PATCH",
          headers: { ...svcHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ payout_fingerprint: fp }),
        }).catch(() => {});
      } else {
        console.warn(`[payout] anti-fraude: pas d'empreinte bancaire pour ${accountId} — dédup ignorée.`);
      }
    } catch (e) {
      console.warn("[payout] anti-fraude: vérif empreinte échouée (non bloquant):", e.message);
    }

    // Idempotence : empêche un double versement si retry RÉSEAU de la même
    // requête. La clé est dérivée de l'ENSEMBLE EXACT des participations soldées
    // (owedIds), PAS du montant : ainsi un re-essai du même retrait est dédupliqué,
    // mais deux retraits distincts du même montant (ex. 5€ puis encore 5€ dans les
    // 24h) ont des clés différentes et passent tous les deux.
    const idempotencyKey = `payout_wd_${participantId}_${crypto
      .createHash("sha256")
      .update(owedIds.slice().sort((a, b) => a - b).join(","))
      .digest("hex")
      .slice(0, 32)}`;

    const transfer = await stripe.transfers.create(
      {
        amount: Math.round(participantAmount * 100),
        currency: "eur",
        destination: accountId,
        description: `Retrait gains StudyReach`,
        metadata: {
          participantId: String(participantId),
          kind: "withdrawal",
        },
      },
      { idempotencyKey }
    );

    // 🔒 Marquage paid_to_bank=true APRÈS transfert — BLOQUANT + 1 retry.
    // En serverless, un fetch non attendu peut ne jamais s'exécuter (instance
    // gelée dès la réponse renvoyée) : on ATTEND donc le marquage avant de
    // répondre, et on vérifie res.ok (un PATCH refusé ne "throw" pas).
    // On solde EXACTEMENT les participations payées (par id).
    // Si le marquage échoue malgré le retry : log CRITIQUE + markOk:false. Le
    // transfert a bien eu lieu ; la clé d'idempotence (owedIds) empêche un
    // re-versement en cas de re-tentative sous 24h.
    let markOk = false;
    {
      const url = `${SUPABASE_URL}/rest/v1/participations?id=in.(${owedIds.join(",")})`;
      const doMark = () =>
        fetch(url, {
          method: "PATCH",
          headers: { ...svcHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ paid_to_bank: true }),
        });
      try {
        let r = await doMark();
        if (!r.ok) r = await doMark(); // 1 retry
        markOk = r.ok;
        if (!markOk) {
          console.error(
            `[payout] CRITIQUE: paid_to_bank non marqué après transfert ${transfer.id} ` +
              `(participant ${participantId}, ids ${owedIds}) — HTTP ${r.status}`
          );
        }
      } catch (e) {
        console.error(`[payout] CRITIQUE: paid_to_bank exception après transfert ${transfer.id}:`, e.message);
      }
    }

    await fetch(`${SUPABASE_URL}/rest/v1/transactions`, {
      method: "POST",
      headers: { ...svcHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        type: "payout",
        study_id: null,
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
      settledCount: owedIds.length,
      markOk,
    });
  } catch (err) {
    console.error("Stripe payout error:", err);
    return res.status(500).json({ error: "Erreur versement Stripe", details: err.message });
  }
}
