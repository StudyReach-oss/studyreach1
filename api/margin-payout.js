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
//     solde Stripe disponible − dettes internes − coussin (20 € par défaut)
//   où dettes internes = wallets chercheurs + gains participants non retirés
//                        + budgets bloqués restants des études ouvertes.
//   → l'argent des participants/chercheurs reste TOUJOURS couvert sur Stripe.
//   → si le disponible ne couvre pas tout le dû (paiement carte en cours de
//     libération ~3j), le reliquat part automatiquement le vendredi suivant.
//
// SÉCURITÉ DES LECTURES :
//   • Toutes les lectures Supabase sont PAGINÉES (PostgREST plafonne à 1000
//     lignes par requête) et STRICTES : une lecture en erreur interrompt le
//     cron au lieu d'être traitée comme « 0 ligne » (ce qui sous-estimerait
//     les dettes et augmenterait la marge virée).
//
// IDEMPOTENCE : 1 virement max par semaine ISO (clé `margin-AAAA-SS` côté
// Stripe + garde en base). Log inséré AVANT le virement (pending), confirmé
// après (completed), supprimé si le virement échoue.
//   • Une ligne restée « pending » (crash entre le virement et la confirmation)
//     est RÉCONCILIÉE au début de chaque exécution en interrogeant Stripe :
//     virement retrouvé → passée en completed ; introuvable → supprimée.
//     Tant qu'une ligne pending ne peut pas être tranchée, on ne vire rien.
//
// ACCÈS : CRON_SECRET est OBLIGATOIRE (échec fermé s'il est absent).
// ─────────────────────────────────────────────────────────────────────────────

import Stripe from "stripe";
import crypto from "crypto";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-05-27.dahlia",
});

const SUPABASE_URL = process.env.SUPABASE_URL || "https://bwaoxwfkqqpqvtpynwzh.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const AI_SURCHARGE = 10;   // € — aligné sur App.jsx et check-validation-deadlines
const CUSHION = Number(process.env.MARGIN_CUSHION || 20); // € — coussin anti-imprévus (litige, remboursement, frais Stripe). Modifiable via MARGIN_CUSHION.
const MIN_PAYOUT = 1;      // € — en dessous, on attend la semaine suivante
const PAGE_SIZE = 1000;    // taille de page demandée à PostgREST
const PENDING_GRACE_MS = 15 * 60 * 1000; // une ligne pending plus récente = exécution peut-être en cours

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

// Lecture COMPLÈTE d'une table/requête PostgREST, page par page.
// - tri par id : pagination stable ;
// - on avance de « nombre de lignes reçues » (et non de PAGE_SIZE) : reste
//   correct même si max_rows côté Supabase est inférieur à PAGE_SIZE ;
// - toute réponse non-OK lève une erreur : jamais de « liste vide » silencieuse.
async function sbAll(pathAndQuery) {
  const sep = pathAndQuery.includes("?") ? "&" : "?";
  const rows = [];
  let offset = 0;
  for (;;) {
    const r = await sb(`${pathAndQuery}${sep}order=id.asc&limit=${PAGE_SIZE}&offset=${offset}`);
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      throw new Error(`Lecture ${pathAndQuery.split("?")[0]} échouée (HTTP ${r.status}) ${t}`.trim());
    }
    const page = await r.json();
    if (!Array.isArray(page)) throw new Error(`Lecture ${pathAndQuery.split("?")[0]} : réponse inattendue`);
    if (page.length === 0) break;
    rows.push(...page);
    offset += page.length;
  }
  return rows;
}

// Comparaison du secret en temps constant.
function secretMatches(provided, expected) {
  const a = crypto.createHash("sha256").update(String(provided)).digest();
  const b = crypto.createHash("sha256").update(String(expected)).digest();
  return crypto.timingSafeEqual(a, b);
}

// PATCH avec vérification de la réponse + 1 retry (un PATCH refusé ne "throw" pas).
async function patchWithRetry(path, body) {
  let r = await sb(path, "PATCH", body, { Prefer: "return=minimal" });
  if (!r.ok) r = await sb(path, "PATCH", body, { Prefer: "return=minimal" });
  return r.ok;
}

// Réconcilie les lignes « pending » héritées d'une exécution interrompue.
// Retourne { blocking: true } si au moins une ligne ne peut pas être tranchée.
async function reconcilePending() {
  const pending = await sbAll(
    `transactions?type=eq.platform_margin_payout&status=eq.pending&select=id,amount,description,created_at`
  );
  if (pending.length === 0) return { blocking: false };

  // Virements Stripe récents, indexés par description (= label de la semaine).
  const payouts = [];
  for await (const p of stripe.payouts.list({ limit: 100 })) {
    payouts.push(p);
    if (payouts.length >= 300) break;
  }

  let blocking = false;
  for (const row of pending) {
    const weekMatch = /semaine (\d{4}-\d{2})/.exec(row.description || "");
    const rowLabel = weekMatch ? `Marge StudyReach — semaine ${weekMatch[1]}` : null;
    const found = rowLabel
      ? payouts.find(
          (p) =>
            p.description === rowLabel &&
            p.status !== "failed" &&
            p.status !== "canceled" &&
            Math.round(Number(row.amount) * 100) === p.amount
        )
      : null;

    if (found) {
      const ok = await patchWithRetry(`transactions?id=eq.${row.id}`, {
        status: "completed",
        stripe_transfer_id: found.id,
      });
      if (!ok) blocking = true; // on ne sait pas confirmer : on ne vire rien cette semaine
      else console.log(`[margin-payout] Ligne pending ${row.id} réconciliée → completed (${found.id}).`);
      continue;
    }

    // Aucun virement correspondant chez Stripe.
    const age = Date.now() - new Date(row.created_at).getTime();
    if (age < PENDING_GRACE_MS) {
      blocking = true; // exécution probablement encore en cours
      continue;
    }
    const del = await sb(`transactions?id=eq.${row.id}`, "DELETE");
    if (!del.ok) blocking = true;
    else console.warn(`[margin-payout] Ligne pending ${row.id} sans virement Stripe → supprimée.`);
  }
  return { blocking };
}

export default async function handler(req, res) {
  // ── Garde d'accès : CRON_SECRET OBLIGATOIRE. Sans lui, l'endpoint est fermé
  // (échec fermé) : n'importe qui pourrait sinon le déclencher.
  // Vercel envoie automatiquement `Authorization: Bearer $CRON_SECRET` au cron.
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[margin-payout] CRON_SECRET absent — endpoint désactivé.");
    return res.status(503).json({ error: "CRON_SECRET non configuré — endpoint désactivé." });
  }
  if (!secretMatches(req.headers["authorization"] || "", `Bearer ${cronSecret}`)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const weekKey = isoWeekKey();
  const label = `Marge StudyReach — semaine ${weekKey}`;

  try {
    // ── 0a) Lignes pending d'une exécution précédente : on tranche d'abord.
    const rec = await reconcilePending();
    if (rec.blocking) {
      return res.status(200).json({
        ok: true,
        skipped: "Une ligne 'pending' ne peut pas encore être réconciliée avec Stripe — aucun virement cette fois.",
      });
    }

    // ── 0b) Déjà viré cette semaine ? (garde locale, en plus de l'idempotence Stripe)
    const dupRes = await sb(
      `transactions?type=eq.platform_margin_payout&description=ilike.*${weekKey}*&select=id,status&limit=1`
    );
    if (!dupRes.ok) throw new Error(`Lecture garde hebdomadaire échouée (HTTP ${dupRes.status})`);
    const dup = await dupRes.json();
    if (Array.isArray(dup) && dup.length > 0) {
      return res.status(200).json({ ok: true, skipped: `Déjà traité pour la semaine ${weekKey}.` });
    }

    // ── 1) Lectures complètes et paginées
    const parts = await sbAll(`participations?select=id,study_id,paid,paid_to_bank,status`);
    const studies = await sbAll(`studies?select=id,cost_per_participant,ai,max_participants,budget_blocked,status`);
    const studyMap = new Map(studies.map((s) => [String(s.id), s]));

    // Marge gagnée (participations validées) + gains participants non retirés
    let earned = 0; // marge totale gagnée (10% + frais IA)
    let owed = 0;   // gains participants validés mais pas encore retirés
    for (const p of parts) {
      if (p.paid !== true) continue;
      const s = studyMap.get(String(p.study_id));
      if (!s) continue;
      const cost = Number(s.cost_per_participant) || 0;
      const net = participantNet(cost, !!s.ai);
      earned += cost - net;
      if (p.paid_to_bank !== true) owed += net;
    }
    earned = r2(earned);
    owed = r2(owed);

    // ── 2) Marge déjà virée
    const paidRows = await sbAll(
      `transactions?type=eq.platform_margin_payout&status=eq.completed&select=id,amount`
    );
    const alreadyPaid = r2(paidRows.reduce((a, t) => a + (Number(t.amount) || 0), 0));

    const due = r2(earned - alreadyPaid);
    if (due < MIN_PAYOUT) {
      return res.status(200).json({ ok: true, skipped: `Marge due ${due}€ < ${MIN_PAYOUT}€ — rien à virer.`, earned, alreadyPaid });
    }

    // ── 3) Dettes internes restantes (l'argent qui N'EST PAS à toi)
    //  a) wallets (crédits chercheurs, remboursements compris)
    const wRows = await sbAll(`profiles?select=id,wallet`);
    const wallets = r2(wRows.reduce((a, r) => a + (Number(r.wallet) || 0), 0));

    //  b) budgets bloqués restants des études ouvertes :
    //     coût × (places − validées − remboursées[rejetées/abandonnées])
    const partsByStudy = new Map();
    for (const p of parts) {
      const k = String(p.study_id);
      if (!partsByStudy.has(k)) partsByStudy.set(k, { validated: 0, refunded: 0 });
      const agg = partsByStudy.get(k);
      if (p.paid === true) agg.validated += 1;
      if (p.status === "rejected" || p.status === "abandoned") agg.refunded += 1;
    }
    let blockedRemaining = 0;
    for (const s of studies) {
      if (s.budget_blocked !== true || s.status === "closed") continue;
      const agg = partsByStudy.get(String(s.id)) || { validated: 0, refunded: 0 };
      const remainingSlots = Math.max(0, (Number(s.max_participants) || 0) - agg.validated - agg.refunded);
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
      // Échec DÉFINITIF (réponse d'erreur de Stripe) → rollback du log, le
      // prochain vendredi retentera. Échec d'ISSUE INCONNUE (réseau/timeout) :
      // le virement a peut-être eu lieu → on garde la ligne pending, la
      // réconciliation de la prochaine exécution tranchera auprès de Stripe.
      const unknownOutcome = e?.type === "StripeConnectionError" || e?.type === "StripeAPIError";
      if (!unknownOutcome) {
        await sb(`transactions?id=eq.${insRow.id}`, "DELETE").catch(() => {});
      } else {
        console.error(`[margin-payout] Issue du virement INCONNUE — ligne ${insRow.id} laissée en pending pour réconciliation.`);
      }
      console.error(`[margin-payout] Virement Stripe échoué: ${e.message}`);
      return res.status(500).json({ error: `Virement Stripe échoué: ${e.message}` });
    }

    // Confirmation BLOQUANTE (+1 retry). Si elle échoue malgré tout, la ligne
    // reste pending : la réconciliation la passera en completed la semaine
    // suivante (au lieu de repayer la même marge).
    const confirmed = await patchWithRetry(`transactions?id=eq.${insRow.id}`, {
      status: "completed",
      stripe_transfer_id: payout.id,
    });
    if (!confirmed) {
      console.error(
        `[margin-payout] CRITIQUE: virement ${payout.id} effectué mais ligne ${insRow.id} non confirmée — ` +
          `elle sera réconciliée au prochain passage.`
      );
    }

    console.log(`[margin-payout] ✅ ${amount}€ virés (payout ${payout.id}) — semaine ${weekKey}.`);
    return res.status(200).json({
      ok: true, paid: amount, payout_id: payout.id, confirmed,
      details: { earned, alreadyPaid, due, available: availEur, liabilities },
    });
  } catch (e) {
    console.error("[margin-payout] Erreur:", e);
    return res.status(500).json({ error: e.message });
  }
}
