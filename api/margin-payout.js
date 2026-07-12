// api/margin-payout.js
// ─────────────────────────────────────────────────────────────────────────────
// VIREMENT AUTOMATIQUE DE LA MARGE STUDYREACH → COMPTE BANCAIRE DE SAM
// Déclenché par le cron Vercel chaque vendredi (voir vercel.json → "crons").
//
// PRINCIPE ("moins ou rien, jamais trop") :
//   marge_gagnée   = Σ (coût_étude − net_participant) sur les participations
//                    validées (paid=true). C'est le compteur cumulé, à l'euro
//                    près, jamais remis à zéro.
//   marge_déjà_virée = Σ transactions type='platform_margin_payout' complétées.
//   dû = marge_gagnée − marge_déjà_virée.
//
//   PLAFOND DE SÉCURITÉ : on ne vire jamais plus que
//     solde Stripe disponible − dettes internes − coussin 5 €
//   où dettes internes = wallets chercheurs + gains participants non retirés
//                        + budgets bloqués restants des études ouvertes.
//   → l'argent des participants/chercheurs reste TOUJOURS couvert sur Stripe.
//   → si le disponible ne couvre pas tout le dû (paiement carte en cours de
//     libération ~3j), le reliquat part automatiquement le vendredi suivant.
//
// IDEMPOTENCE : 1 virement max par semaine ISO (clé `margin-AAAA-SS` côté
// Stripe + garde en base). Log inséré AVANT le virement (pending), confirmé
// après (completed), supprimé si le virement échoue — même schéma éprouvé que
// le webhook de recharge.
// ─────────────────────────────────────────────────────────────────────────────

import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-05-27.dahlia",
});

const SUPABASE_URL = process.env.SUPABASE_URL || "https://bwaoxwfkqqpqvtpynwzh.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const AI_SURCHARGE = 10;   // € — aligné sur App.jsx et check-validation-deadlines
const CUSHION = 5;         // € — coussin anti-imprévus (litige, remboursement)
const MIN_PAYOUT = 1;      // € — en dessous, on attend la semaine suivante

// Net participant = 90% de (coût − supplément IA). STRICTEMENT identique au
// front (App.jsx) et au cron J30 (check-validation-deadlines).
function participantNet(cost, isAi) {
  const base = Math.max(0, (Number(cost) || 0) - (isAi ? AI_SURCHARGE : 0));
  return Math.round(base * 0.9 * 100) / 100;
}

const r2 = (n) => Math.round(n * 100) / 100;

// Semaine ISO courante, ex. "2026-28" — sert de clé d'idempotence hebdo.
function isoWeekKey(d = new Date()) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-${String(week).padStart(2, "0")}`;
}

async function sb(pathAndQuery, method = "GET", body = null, extraHeaders = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    method,
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

export default async function handler(req, res) {
  // ── Garde d'accès : si CRON_SECRET est défini dans Vercel, seul le cron
  // (qui l'envoie automatiquement en Authorization) peut déclencher.
  // Sans secret : endpoint sans danger par construction (il ne peut virer que
  // la marge due, une fois par semaine, vers TON compte bancaire déjà
  // enregistré — un appel étranger ne ferait que te payer à l'heure).
  if (process.env.CRON_SECRET) {
    if ((req.headers["authorization"] || "") !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  const weekKey = isoWeekKey();
  const label = `Marge StudyReach — semaine ${weekKey}`;

  try {
    // ── 0) Déjà viré cette semaine ? (garde locale, en plus de l'idempotence Stripe)
    const dupRes = await sb(
      `transactions?type=eq.platform_margin_payout&description=ilike.*${weekKey}*&select=id,status&limit=1`
    );
    const dup = await dupRes.json();
    if (Array.isArray(dup) && dup.length > 0) {
      return res.status(200).json({ ok: true, skipped: `Déjà traité pour la semaine ${weekKey}.` });
    }

    // ── 1) Marge gagnée (participations validées) ─ compteur cumulatif
    const partsRes = await sb(
      `participations?paid=eq.true&select=id,study_id,paid_to_bank`
    );
    const parts = await partsRes.json();
    if (!Array.isArray(parts)) throw new Error("Lecture participations échouée");

    const studyIds = [...new Set(parts.map((p) => p.study_id))];
    let studies = [];
    if (studyIds.length > 0) {
      const stRes = await sb(
        `studies?id=in.(${studyIds.join(",")})&select=id,cost_per_participant,ai`
      );
      studies = await stRes.json();
      if (!Array.isArray(studies)) throw new Error("Lecture études échouée");
    }
    const studyMap = new Map(studies.map((s) => [s.id, s]));

    let earned = 0; // marge totale gagnée (10% + frais IA)
    let owed = 0;   // gains participants validés mais pas encore retirés
    for (const p of parts) {
      const s = studyMap.get(p.study_id);
      if (!s) continue;
      const cost = Number(s.cost_per_participant) || 0;
      const net = participantNet(cost, !!s.ai);
      earned += cost - net;
      if (p.paid_to_bank !== true) owed += net;
    }
    earned = r2(earned);
    owed = r2(owed);

    // ── 2) Marge déjà virée
    const paidRes = await sb(
      `transactions?type=eq.platform_margin_payout&status=eq.completed&select=amount`
    );
    const paidRows = await paidRes.json();
    const alreadyPaid = r2(
      (Array.isArray(paidRows) ? paidRows : []).reduce((a, t) => a + (Number(t.amount) || 0), 0)
    );

    const due = r2(earned - alreadyPaid);
    if (due < MIN_PAYOUT) {
      return res.status(200).json({ ok: true, skipped: `Marge due ${due}€ < ${MIN_PAYOUT}€ — rien à virer.`, earned, alreadyPaid });
    }

    // ── 3) Dettes internes restantes (l'argent qui N'EST PAS à toi)
    //  a) wallets (crédits chercheurs, remboursements compris)
    const wRes = await sb(`profiles?select=wallet`);
    const wRows = await wRes.json();
    const wallets = r2(
      (Array.isArray(wRows) ? wRows : []).reduce((a, r) => a + (Number(r.wallet) || 0), 0)
    );

    //  b) budgets bloqués restants des études ouvertes :
    //     coût × (places − validées − remboursées[rejetées/abandonnées])
    const bRes = await sb(
      `studies?budget_blocked=eq.true&status=neq.closed&select=id,cost_per_participant,max_participants`
    );
    const bStudies = await bRes.json();
    let blockedRemaining = 0;
    for (const s of Array.isArray(bStudies) ? bStudies : []) {
      const cRes = await sb(
        `participations?study_id=eq.${s.id}&select=paid,status`
      );
      const cParts = await cRes.json();
      const validated = (Array.isArray(cParts) ? cParts : []).filter((p) => p.paid === true).length;
      const refunded = (Array.isArray(cParts) ? cParts : []).filter(
        (p) => p.status === "rejected" || p.status === "abandoned"
      ).length;
      const remainingSlots = Math.max(0, (Number(s.max_participants) || 0) - validated - refunded);
      blockedRemaining += remainingSlots * (Number(s.cost_per_participant) || 0);
    }
    blockedRemaining = r2(blockedRemaining);

    const liabilities = r2(wallets + owed + blockedRemaining);

    // ── 4) Solde Stripe réellement disponible
    const balance = await stripe.balance.retrieve();
    const availEur = (balance.available || [])
      .filter((b) => b.currency === "eur")
      .reduce((a, b) => a + b.amount, 0) / 100;

    const safeMax = r2(availEur - liabilities - CUSHION);
    const amount = r2(Math.min(due, safeMax));

    if (amount < MIN_PAYOUT) {
      return res.status(200).json({
        ok: true,
        skipped: `Disponible insuffisant cette semaine — reliquat viré vendredi prochain.`,
        due, available: availEur, liabilities, cushion: CUSHION,
      });
    }

    // ── 5) Log AVANT le virement (pending), puis virement, puis confirmation.
    const insRes = await sb("transactions", "POST", {
      type: "platform_margin_payout",
      amount,
      total: amount,
      status: "pending",
      description: `${label} (dû: ${due}€, gagné cumulé: ${earned}€)`,
      created_at: new Date().toISOString(),
    }, { Prefer: "return=representation" });
    if (!insRes.ok) throw new Error(`Insert log échoué (HTTP ${insRes.status})`);
    const [insRow] = await insRes.json();

    let payout;
    try {
      payout = await stripe.payouts.create(
        {
          amount: Math.round(amount * 100),
          currency: "eur",
          description: label,
        },
        { idempotencyKey: `margin-${weekKey}` }
      );
    } catch (e) {
      // Rollback du log : le prochain vendredi retentera proprement.
      await sb(`transactions?id=eq.${insRow.id}`, "DELETE").catch(() => {});
      console.error(`[margin-payout] Virement Stripe échoué: ${e.message}`);
      return res.status(500).json({ error: `Virement Stripe échoué: ${e.message}` });
    }

    await sb(`transactions?id=eq.${insRow.id}`, "PATCH", {
      status: "completed",
      stripe_transfer_id: payout.id,
    });

    console.log(`[margin-payout] ✅ ${amount}€ virés (payout ${payout.id}) — semaine ${weekKey}.`);
    return res.status(200).json({
      ok: true, paid: amount, payout_id: payout.id,
      details: { earned, alreadyPaid, due, available: availEur, liabilities },
    });
  } catch (e) {
    console.error("[margin-payout] Erreur:", e);
    return res.status(500).json({ error: e.message });
  }
}
