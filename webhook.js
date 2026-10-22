// api/webhook.js
// Webhook Stripe — SOURCE DE VÉRITÉ des paiements.
// - checkout.session.completed (carte, payée) → crédite profiles.wallet (RPC increment_wallet) + log transaction
//   Le montant crédité est TOUJOURS le montant encaissé par Stripe (session.amount_total, ou
//   amount_received du PaymentIntent) — jamais metadata.amount, qui n'est qu'une déclaration.
// - VIREMENT bancaire (customer_balance) : completed = "instructions affichées" → on attend ;
//   checkout.session.async_payment_succeeded = virement reçu → même crédit + publication de l'étude liée
//   checkout.session.async_payment_failed / expired, payment_intent.partially_funded → suivi + alertes admin
//   (l'interface ne crée plus que des recharges de portefeuille ; la publication automatique d'étude ci-dessous
//   ne sert que pour d'éventuelles commandes anciennes encore ouvertes)
// - transfer.created / payout.* → log transaction payout (optionnel)
//
// IMPORTANT : le webhook a besoin du RAW body pour vérifier la signature.
// On désactive donc le bodyParser de Vercel (config ci-dessous).

import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-05-27.dahlia",
});

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL || "https://bwaoxwfkqqpqvtpynwzh.supabase.co";
// Service role OBLIGATOIRE ici : le webhook écrit dans profiles/transactions
// hors contexte utilisateur, l'anon key serait bloquée par la RLS.
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Pays de l'IBAN des virements (doit correspondre à api/create-bank-transfer.js)
const IBAN_COUNTRY = process.env.BANK_TRANSFER_COUNTRY || "FR";

// Les deux types de recharge par virement : le virement demandé, et l'EXCÉDENT reçu en plus
// (converti en recharge du portefeuille, voir finalizeTransferOrder).
const isBankKind = (k) => k === "wallet_recharge_transfer" || k === "wallet_recharge_excess";

export const config = { api: { bodyParser: false } };

// Lit le corps brut de la requête (nécessaire pour la signature Stripe)
function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(Buffer.from(data)));
    req.on("error", reject);
  });
}

async function sb(path, method, body) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: body ? JSON.stringify(body) : null,
  });
}


// ─────────────────────────────────────────────────────────────────────────
// VIREMENT BANCAIRE — helpers
// ─────────────────────────────────────────────────────────────────────────
const sbJson = (path, init = {}) =>
  fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

async function getOrderBySession(sessionId) {
  const r = await sbJson(`bank_transfer_orders?stripe_session_id=eq.${encodeURIComponent(sessionId)}&select=*`);
  const rows = r.ok ? await r.json() : [];
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function getOrderByPaymentIntent(piId) {
  if (!piId) return null;
  const r = await sbJson(`bank_transfer_orders?stripe_payment_intent_id=eq.${encodeURIComponent(piId)}&select=*`);
  const rows = r.ok ? await r.json() : [];
  return Array.isArray(rows) ? rows[0] || null : null;
}

// Alerte visible dans l'onglet "Virements" de l'admin. Best-effort : ne doit jamais faire échouer le webhook.
async function alertAdmin(kind, { researcherId = null, orderId = null, message, details = {} }) {
  try {
    const r = await sbJson("bank_transfer_alerts", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ kind, researcher_id: researcherId, order_id: orderId, message, details }),
    });
    if (!r.ok) console.warn("[webhook] alertAdmin HTTP", r.status, await r.text().catch(() => ""));
  } catch (e) {
    console.warn("[webhook] alertAdmin failed:", e.message);
  }
}

// Étude liée à une commande de virement : abandonnée si le virement n'arrivera jamais.
async function abandonOrderStudy(order) {
  if (!order?.study_id) return;
  await sbJson(`studies?id=eq.${order.study_id}&status=eq.pending_payment`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ status: "abandoned" }),
  }).catch((e) => console.warn("[webhook] abandonOrderStudy failed:", e.message));
}

// Appelée APRÈS le crédit du portefeuille. Idempotente (peut être rejouée sans danger).
// Retourne { ok:false } uniquement si Stripe doit réessayer (erreur technique).
async function finalizeTransferOrder(session) {
  try {
    if (session.metadata?.kind !== "wallet_recharge_transfer") return { ok: true };
    // Commande retrouvée par session, sinon par PaymentIntent (cas du filet payment_intent.succeeded).
    const order = (await getOrderBySession(session.id)) || (await getOrderByPaymentIntent(session.payment_intent));
    if (!order) {
      await alertAdmin("unmatched", {
        researcherId: session.metadata?.userId || null,
        message: `Virement reçu (${Number.isInteger(session.amount_total) ? (session.amount_total / 100).toFixed(2) : session.metadata?.amount}€) mais aucune commande trouvée pour la session ${session.id}. Le portefeuille a bien été crédité.`,
        details: { session_id: session.id },
      });
      return { ok: true };
    }

    if (order.status !== "paid") {
      const r = await sbJson(`bank_transfer_orders?id=eq.${order.id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          status: "paid",
          paid_at: new Date().toISOString(),
          stripe_payment_intent_id: session.payment_intent || order.stripe_payment_intent_id || null,
        }),
      });
      if (!r.ok) {
        console.error("[webhook] maj commande paid échouée:", r.status, await r.text().catch(() => ""));
        return { ok: false };
      }
    }

    // Publication automatique de l'étude préparée par le chercheur
    if (order.study_id && !order.activated_at && !["slots_expired", "not_pending", "study_missing"].includes(order.activation_result)) {
      const rpc = await sbJson("rpc/activate_study_after_payment", {
        method: "POST",
        body: JSON.stringify({ p_order_id: order.id }),
      });
      if (!rpc.ok) {
        console.error("[webhook] activate_study_after_payment HTTP", rpc.status, await rpc.text().catch(() => ""));
        return { ok: false };
      }
      const result = await rpc.json();
      if (result !== "activated" && result !== "already_active") {
        await alertAdmin("activation_failed", {
          researcherId: order.researcher_id,
          orderId: order.id,
          message: result === "slots_expired"
            ? `Virement reçu et portefeuille crédité, mais les créneaux de l'étude #${order.study_id} sont passés : elle n'a PAS été publiée (marquée abandonnée). Prévenez le chercheur : il peut la recréer avec de nouvelles dates, son solde est déjà disponible.`
            : `Virement reçu et portefeuille crédité, mais l'étude #${order.study_id} n'a pas pu être publiée automatiquement (${result}).`,
          details: { result, study_id: order.study_id },
        });
      } else {
        console.log(`[webhook] Étude #${order.study_id} publiée après virement (${result}).`);
        // Repère informatif « frais IA réservés » (équivalent de api/charge-ai-fee.js, appelé côté navigateur
        // pour une publication normale). Non bloquant, aucun mouvement d'argent.
        if (result === "activated") {
          try {
            const sr = await sbJson(`studies?id=eq.${order.study_id}&select=ai,max_participants`);
            const st = (await sr.json())?.[0];
            if (st?.ai) {
              const n = Number(st.max_participants) > 0 ? Number(st.max_participants) : 1;
              const fee = 10 * n; // 10€ par participant visé (max. théorique)
              await sbJson("transactions", {
                method: "POST",
                headers: { Prefer: "return=minimal" },
                body: JSON.stringify({
                  type: "ai_fee", study_id: String(order.study_id), user_id: order.researcher_id,
                  amount: fee, fee: 0, total: fee, status: "completed",
                  description: `Frais IA réservés (max. théorique, ${n} participant(s)) — étude #${order.study_id}`,
                  created_at: new Date().toISOString(),
                }),
              });
            }
          } catch (e) {
            console.warn("[webhook] log frais IA échoué (non bloquant):", e.message);
          }
        }
      }
    }

    // Le virement est complet : on efface l'éventuel « il manque X€ » (best-effort, colonne ajoutée par la migration 20261020200000).
    sbJson(`bank_transfer_orders?id=eq.${order.id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ amount_remaining: null }),
    }).catch(() => {});

    // ── EXCÉDENT → PORTEFEUILLE ─────────────────────────────────────────────────────────────────────
    // Si le client a viré PLUS que demandé, Stripe garde le surplus sur son « solde client » (cash balance) :
    // il serait appliqué automatiquement à un autre virement en attente, ou renvoyé à sa banque au bout de 75 jours.
    // On le CONVERTIT donc en recharge du portefeuille, en consommant ce solde Stripe pour qu'il ne puisse jamais
    // être crédité deux fois :
    //   1) on calcule le surplus (virements reçus depuis la commande − montant demandé) ;
    //   2) on le plafonne au solde client RÉELLEMENT disponible chez Stripe (si Stripe l'a déjà appliqué à une
    //      autre commande, celle-ci sera créditée normalement : rien à faire ici) ;
    //   3) on crée un PaymentIntent « customer_balance » de ce montant, payé immédiatement avec ce solde ;
    //   4) son événement payment_intent.succeeded (kind = wallet_recharge_excess) crédite le portefeuille
    //      par le même chemin atomique que toute recharge (+ facture + email).
    // Idempotent : clé Stripe par commande + ignoré si l'excédent a déjà été traité (overpaid_amount renseigné).
    try {
      if (session.customer && order.created_at && !(Number(order.overpaid_amount) > 0)) {
        const sinceSec = Math.floor(new Date(order.created_at).getTime() / 1000);
        const list = await stripe.customers.listCashBalanceTransactions(session.customer, { limit: 100 });
        const funded = (list?.data || [])
          .filter((t) => t.type === "funded" && (t.created || 0) >= sinceSec)
          .reduce((acc, t) => acc + (t.amount || 0), 0);
        const requested = Math.round(Number(order.amount) * 100);
        const extra = Math.max(0, funded - requested);
        if (extra > 0) {
          const cash = await stripe.customers.retrieveCashBalance(session.customer);
          const availableCents = Number(cash?.available?.eur) || 0;
          const toCredit = Math.min(extra, availableCents);
          if (toCredit > 0) {
            let pi = await stripe.paymentIntents.create(
              {
                amount: toCredit,
                currency: "eur",
                customer: session.customer,
                payment_method_types: ["customer_balance"],
                payment_method_data: { type: "customer_balance" },
                payment_method_options: {
                  customer_balance: {
                    funding_type: "bank_transfer",
                    bank_transfer: { type: "eu_bank_transfer", eu_bank_transfer: { country: IBAN_COUNTRY } },
                  },
                },
                confirm: true,
                description: "Excédent de virement → portefeuille StudyReach",
                metadata: {
                  userId: String(order.researcher_id),
                  amount: (toCredit / 100).toFixed(2),
                  kind: "wallet_recharge_excess",
                  order_id: String(order.id),
                },
              },
              { idempotencyKey: `excess-${order.id}` }
            );
            // Si Stripe attend encore le financement, on applique explicitement le solde client.
            if (pi.status !== "succeeded") {
              try {
                pi = await stripe.paymentIntents.applyCustomerBalance(pi.id, { amount: toCredit, currency: "eur" });
              } catch (e) {
                console.warn("[webhook] applyCustomerBalance échoué:", e.message);
              }
            }
            if (pi.status === "succeeded") {
              // Visible côté chercheur (best-effort) : « excédent ajouté à votre portefeuille ».
              sbJson(`bank_transfer_orders?id=eq.${order.id}`, {
                method: "PATCH",
                headers: { Prefer: "return=minimal" },
                body: JSON.stringify({ overpaid_amount: toCredit / 100 }),
              }).catch(() => {});
              await alertAdmin("overpaid", {
                researcherId: order.researcher_id,
                orderId: order.id,
                message: `Excédent de ${(toCredit / 100).toFixed(2)}€ reçu en plus du virement demandé : converti en recharge du portefeuille (le crédit arrive via payment_intent.succeeded du PaymentIntent ${pi.id}). Aucune action nécessaire.`,
                details: { excess_cents: toCredit, payment_intent: pi.id, customer: session.customer },
              });
            } else {
              // Ne laisse pas un PaymentIntent en attente de financement (il pourrait être payé plus tard par erreur).
              try { await stripe.paymentIntents.cancel(pi.id); } catch (e) { /* déjà annulé / terminé */ }
              await alertAdmin("overpaid", {
                researcherId: order.researcher_id,
                orderId: order.id,
                message: `Excédent de ${(toCredit / 100).toFixed(2)}€ reçu mais la conversion automatique en crédit portefeuille a ÉCHOUÉ (statut ${pi.status}). L'argent reste sur le solde client Stripe : créditez le chercheur à la main ou renvoyez-le depuis le Dashboard Stripe (Customers › Cash balance).`,
                details: { excess_cents: toCredit, payment_intent: pi.id, status: pi.status, customer: session.customer },
              });
            }
          }
        }
      }
    } catch (e) {
      console.warn("[webhook] conversion de l'excédent échouée (non bloquant):", e.message);
      await alertAdmin("overpaid", {
        researcherId: order.researcher_id,
        orderId: order.id,
        message: `Excédent de virement détecté mais la conversion automatique a échoué (${e.message}). Vérifiez le solde client dans le Dashboard Stripe et créditez le chercheur à la main si besoin.`,
        details: { customer: session.customer || null },
      });
    }
    return { ok: true };
  } catch (e) {
    console.error("[webhook] finalizeTransferOrder error:", e);
    return { ok: false };
  }
}

// Crédit du portefeuille pour une session Checkout PAYÉE (carte, ou virement reçu).
// Retourne une réponse HTTP déjà envoyée (early return) ou undefined si tout s'est bien passé.
async function creditPaidSession(session, res) {
        const userId = session.metadata?.userId;
        if (!userId) {
          console.warn("checkout.session.completed sans metadata userId");
          return;
        }

        // 🔒 MONTANT CRÉDITÉ = montant RÉELLEMENT encaissé par Stripe (amount_total, en centimes),
        // JAMAIS metadata.amount : les metadata sont une déclaration posée à la création de la
        // session, pas la preuve du paiement. Pour le filet payment_intent.succeeded, la session
        // synthétique reprend amount_received du PaymentIntent (voir plus bas).
        const paidCents = Number.isInteger(session.amount_total) ? session.amount_total : null;
        const currency = String(session.currency || "eur").toLowerCase();
        if (paidCents == null || paidCents <= 0 || currency !== "eur") {
          console.error(`[webhook] CRITIQUE: montant encaissé inexploitable (session ${session.id}, amount_total=${session.amount_total}, currency=${session.currency}) — rien crédité.`);
          await alertAdmin("unmatched", {
            researcherId: userId,
            message: `Paiement reçu mais montant encaissé inexploitable (session ${session.id}, montant ${session.amount_total ?? "absent"}, devise ${session.currency || "absente"}). RIEN n'a été crédité : vérifiez dans le Dashboard Stripe et créditez à la main si besoin.`,
            details: { session_id: session.id, payment_intent: session.payment_intent || null, amount_total: session.amount_total ?? null, currency: session.currency || null },
          });
          return res.status(200).json({ received: true, skipped: "amount_unavailable" });
        }
        const amount = paidCents / 100;

        // Écart entre la déclaration (metadata) et l'encaissé : on crédite l'encaissé, on le signale.
        const declaredCents = Math.round(parseFloat(session.metadata?.amount || "0") * 100);
        if (declaredCents && declaredCents !== paidCents) {
          console.warn(`[webhook] Écart montant : metadata=${declaredCents}c, encaissé=${paidCents}c (session ${session.id}) — crédit de l'encaissé.`);
          await alertAdmin("unmatched", {
            researcherId: userId,
            message: `Écart entre le montant déclaré (${(declaredCents / 100).toFixed(2)}€) et le montant encaissé (${amount.toFixed(2)}€) pour la session ${session.id}. Le portefeuille a été crédité du montant ENCAISSÉ (${amount.toFixed(2)}€).`,
            details: { session_id: session.id, declared_cents: declaredCents, paid_cents: paidCents },
          });
        }

        // 🔒 IDEMPOTENCE ATOMIQUE — protège contre le double-crédit, y compris
        // en cas de livraisons SIMULTANÉES du même événement.
        //
        // Ancien schéma (check-puis-crédit) : deux livraisons concurrentes
        // pouvaient toutes les deux passer le check et créditer deux fois.
        // Nouveau schéma :
        //   1) On INSÈRE d'abord la transaction — l'index UNIQUE sur
        //      stripe_payment_intent_id sert de verrou : la 2e insertion
        //      concurrente reçoit un 409 et sort proprement (200 duplicate).
        //   2) On crédite le wallet SEULEMENT si l'insert a réussi, et on
        //      VÉRIFIE la réponse du RPC (r.ok). Ancien bug : réponse ignorée
        //      → si le crédit échouait, la transaction restait loggée, la garde
        //      bloquait les retries Stripe, et le client était payé sans jamais
        //      être crédité.
        //   3) Si le crédit échoue : on SUPPRIME la transaction insérée
        //      (rollback) et on renvoie 500 → Stripe réessaie, et le prochain
        //      essai peut re-créditer normalement.
        // 🛡️ Compte supprimé entre-temps : increment_wallet ne ferait rien (0 ligne) sans erreur → l'argent serait
        // reçu et loggé mais jamais crédité. On ne crédite rien, on alerte l'admin (remboursement à faire à la main
        // depuis Stripe) et on répond 200 pour que Stripe ne rejoue pas l'événement.
        try {
          const pr0 = await sbJson(`profiles?id=eq.${encodeURIComponent(userId)}&select=id`);
          const rows0 = pr0.ok ? await pr0.json() : null;
          if (Array.isArray(rows0) && rows0.length === 0) {
            await alertAdmin("unmatched", {
              message: `Paiement reçu (${amount}€, session ${session.id}) pour un compte chercheur qui n'existe plus (id ${userId}). RIEN n'a été crédité : remboursez le client depuis le Dashboard Stripe.`,
              details: { session_id: session.id, payment_intent: session.payment_intent || null, user_id: userId, amount },
            });
            return res.status(200).json({ received: true, orphan: true });
          }
        } catch (e) {
          console.warn("[webhook] vérification du profil échouée (on poursuit le crédit):", e.message);
        }

        const piId = session.payment_intent || null;
        const txRow = {
          user_id: userId,
          type: "recharge",
          amount,
          total: amount,
          status: "completed",
          description: "Recharge portefeuille (Stripe)",
          stripe_session_id: session.id,
          stripe_payment_intent_id: piId,
          created_at: new Date().toISOString(),
        };

        if (piId) {
          // 🔒 CRÉDIT ATOMIQUE : la fonction SQL credit_wallet_recharge insère la transaction (verrou
          // d'idempotence via l'index unique) ET crédite le portefeuille dans UNE SEULE transaction SQL.
          // Plus de cas « transaction loggée mais wallet jamais crédité » (crash entre les deux étapes) :
          // soit tout est enregistré, soit rien, et Stripe peut réessayer.
          const rpc = await fetch(`${SUPABASE_URL}/rest/v1/rpc/credit_wallet_recharge`, {
            method: "POST",
            headers: {
              apikey: SUPABASE_SERVICE_KEY,
              Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              p_user_id: userId,
              p_amount: amount,
              p_session_id: session.id,
              p_payment_intent_id: piId,
              p_description: isBankKind(session.metadata?.kind)
                ? "Recharge portefeuille (virement)"
                : txRow.description,
              p_payment_method: isBankKind(session.metadata?.kind) ? "bank_transfer" : "card",
              p_po_number: session.metadata?.po_number || null,
              // Libellé de date de la facture (même format qu'avant : « 22 oct. 2026 »)
              p_date_label: new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", timeZone: "Europe/Paris" }),
            }),
          });
          if (!rpc.ok) {
            const t = await rpc.text().catch(() => "");
            console.error(`[webhook] CRITIQUE: credit_wallet_recharge échoué (HTTP ${rpc.status}): ${t} — rien n'a été enregistré, 500 pour que Stripe réessaie.`);
            return res.status(500).json({ error: "Wallet credit failed — Stripe will retry" });
          }
          const creditResult = await rpc.json();

          if (creditResult === "duplicate") {
            console.log(`[webhook] Paiement ${piId} déjà traité — ignoré (idempotence).`);
            // Le crédit a déjà eu lieu : on s'assure quand même que la commande de virement
            // (et la publication de l'étude) a bien été finalisée — au cas où un premier essai aurait planté.
            const finDup = await finalizeTransferOrder(session);
            if (!finDup.ok) return res.status(500).json({ error: "Order activation failed — Stripe will retry" });
            return res.status(200).json({ received: true, duplicate: true });
          }
          if (creditResult === "no_profile") {
            await alertAdmin("unmatched", {
              message: `Paiement reçu (${amount}€, session ${session.id}) pour un compte chercheur qui n'existe plus (id ${userId}). RIEN n'a été crédité : remboursez le client depuis le Dashboard Stripe.`,
              details: { session_id: session.id, payment_intent: piId, user_id: userId, amount },
            });
            return res.status(200).json({ received: true, orphan: true });
          }
          if (creditResult !== "credited") {
            console.error(`[webhook] credit_wallet_recharge : résultat inattendu "${creditResult}" (session ${session.id}).`);
            return res.status(500).json({ error: "Wallet credit failed — Stripe will retry" });
          }
        } else {
          // Cas rarissime : pas de payment_intent → pas de clé d'idempotence
          // possible. On crédite (vérifié) puis on logue.
          console.warn(`[webhook] Session ${session.id} sans payment_intent — idempotence impossible.`);
          const rpc = await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_wallet`, {
            method: "POST",
            headers: {
              apikey: SUPABASE_SERVICE_KEY,
              Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ p_profile_id: userId, p_amount: amount }),
          });
          if (!rpc.ok) {
            console.error(`[webhook] CRITIQUE: increment_wallet échoué (HTTP ${rpc.status}).`);
            return res.status(500).json({ error: "Wallet credit failed — Stripe will retry" });
          }
          await sb("transactions", "POST", txRow).catch((e) =>
            console.warn("[webhook] Log transaction échoué (non-bloquant):", e.message)
          );
        }

        // 2bis) Récupère le profil une seule fois (facture + email en ont besoin)
        let prof = null;
        try {
          const pr = await fetch(
            `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=email,first_name,last_name,company,wallet`,
            { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } }
          );
          const rows = await pr.json();
          prof = Array.isArray(rows) ? rows[0] : null;
        } catch (e) {
          console.warn("Profile fetch failed (non-blocking):", e.message);
        }

        // 3) Facture (table `invoices`, alimente l'onglet "Factures" du dashboard chercheur).
        // Anciennement géré en double par l'edge function Supabase `stripe-webhook`
        // (désactivée le 2026-07-01) — c'est désormais ici l'unique endroit qui écrit une facture.
        // ⚠️ Cas normal (avec payment_intent) : la facture est créée DANS credit_wallet_recharge (même transaction SQL
        // que le crédit, numéro séquentiel sans trou). Ce bloc ne sert plus que pour le cas rarissime SANS payment_intent.
        if (!piId) try {
          const now = new Date();
          const dateLabel = now.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", timeZone: "Europe/Paris" });
          // Numéro SÉQUENTIEL (F-AAAA-00001…) via la fonction SQL next_invoice_number(). Si elle est indisponible
          // (migration non appliquée…), repli sur l'ancien format basé sur le PaymentIntent : jamais bloquant.
          let invId = null;
          try {
            const nr = await fetch(`${SUPABASE_URL}/rest/v1/rpc/next_invoice_number`, {
              method: "POST",
              headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, "Content-Type": "application/json" },
              body: "{}",
            });
            if (nr.ok) {
              const v = await nr.json();
              if (typeof v === "string" && v) invId = v;
            } else {
              console.warn("[webhook] next_invoice_number HTTP", nr.status, await nr.text().catch(() => ""));
            }
          } catch (e) {
            console.warn("[webhook] next_invoice_number échoué:", e.message);
          }
          if (!invId) {
            const piRef = session.payment_intent || session.id;
            invId = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(piRef).slice(-6).toUpperCase()}`;
            console.warn(`[webhook] Facture ${invId} : numéro de repli (non séquentiel).`);
          }

          const invRes = await sb("invoices", "POST", {
            id: invId,
            researcher_id: userId,
            date: dateLabel,
            amount_cents: Math.round(amount * 100),
            amount_display: `${amount.toFixed(2)}€`,
            status: "Payée",
            stripe_payment_intent_id: session.payment_intent || null,
            researcher_name: prof ? `${prof.first_name || ""} ${prof.last_name || ""}`.trim() || null : null,
            researcher_company: prof?.company || null,
            researcher_email: prof?.email || null,
            ...(session.metadata?.kind === "wallet_recharge_transfer"
              ? { payment_method: "bank_transfer", po_number: session.metadata?.po_number || null }
              : {}),
          });
          if (!invRes.ok) {
            console.error(`[webhook] Insert facture ${invId} échoué (HTTP ${invRes.status}): ${await invRes.text().catch(() => "")} — numéro éventuellement consommé, à vérifier.`);
          }
        } catch (e) {
          console.warn("Invoice insert failed (non-blocking):", e.message);
        }

        // 4) Email de confirmation de recharge au chercheur (reçu). Non bloquant :
        // un échec d'email ne doit jamais empêcher le 200 ni le crédit du wallet.
        try {
          if (prof?.email) {
            await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                apikey: SUPABASE_SERVICE_KEY,
                Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
              },
              body: JSON.stringify({
                type: "recharge_confirmed",
                data: {
                  email: prof.email,
                  first_name: prof.first_name || "",
                  amount,
                  new_balance: prof.wallet != null ? prof.wallet : null,
                  // Moyen de paiement affiché dans le reçu : sans ce champ, send-email retombe sur « Carte (Stripe) ».
                  payment_method: isBankKind(session.metadata?.kind) ? "bank_transfer" : "card",
                },
              }),
            });
          }
        } catch (e) {
          console.warn("Recharge email failed (non-blocking):", e.message);
        }

        // 5) Virement : marque la commande payée, publie l'étude liée, signale un éventuel excédent.
        const fin = await finalizeTransferOrder(session);
        if (!fin.ok) return res.status(500).json({ error: "Order activation failed — Stripe will retry" });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  let event;
  try {
    const rawBody = await readRawBody(req);
    const sig = req.headers["stripe-signature"];
    event = stripe.webhooks.constructEvent(rawBody, sig, WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.payment_status === "paid") {
          // Carte payée — ou virement déjà couvert par le solde Stripe du client
          const handled = await creditPaidSession(session, res);
          if (handled) return handled;
          break;
        }
        if (session.metadata?.kind === "wallet_recharge_transfer") {
          // Virement : le chercheur a vu les instructions (IBAN/BIC/référence). On attend l'argent.
          const order = await getOrderBySession(session.id);
          if (order && order.status === "pending_checkout") {
            let hostedUrl = null;
            try {
              if (session.payment_intent) {
                const pi = await stripe.paymentIntents.retrieve(session.payment_intent);
                hostedUrl = pi.next_action?.display_bank_transfer_instructions?.hosted_instructions_url || null;
              }
            } catch (e) {
              console.warn("[webhook] lecture instructions de virement échouée (non bloquant):", e.message);
            }
            await sbJson(`bank_transfer_orders?id=eq.${order.id}`, {
              method: "PATCH",
              headers: { Prefer: "return=minimal" },
              body: JSON.stringify({
                status: "awaiting_transfer",
                stripe_payment_intent_id: session.payment_intent || null,
                hosted_instructions_url: hostedUrl,
              }),
            });
          }
        }
        break;
      }

      // ✅ Virement reçu en totalité → crédit du portefeuille + publication de l'étude liée
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object;
        const handled = await creditPaidSession(session, res);
        if (handled) return handled;
        break;
      }

      case "checkout.session.async_payment_failed":
      case "checkout.session.expired": {
        const session = event.data.object;
        if (session.metadata?.kind !== "wallet_recharge_transfer") break;
        const order = await getOrderBySession(session.id);
        if (!order || order.status === "paid" || order.status === "cancelled") break;
        const failed = event.type === "checkout.session.async_payment_failed";
        // Une session expirée APRÈS affichage des instructions ne doit pas annuler un virement encore attendu.
        if (!failed && order.status === "awaiting_transfer") break;
        await sbJson(`bank_transfer_orders?id=eq.${order.id}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ status: failed ? "failed" : "expired" }),
        });
        await abandonOrderStudy(order);
        if (failed) {
          await alertAdmin("failed", {
            researcherId: order.researcher_id,
            orderId: order.id,
            message: `Le virement de ${order.amount}€ a échoué (étude ${order.study_id ? "#" + order.study_id : "—"}). L'étude n'a pas été publiée.`,
            details: { session_id: session.id },
          });
        }
        break;
      }

      // ⚠️ Virement trop faible : Stripe finance partiellement la commande, qui reste ouverte.
      // 🛟 Filet de sécurité virement : Stripe envoie ce événement une fois le virement reçu, même si la session
      // Checkout a déjà expiré (24 h), ce que checkout.session.async_payment_succeeded ne garantit pas.
      // Ne traite que les PaymentIntents de NOS virements (metadata kind). L'idempotence (index unique sur
      // stripe_payment_intent_id) empêche le double crédit si async_payment_succeeded arrive aussi.
      case "payment_intent.succeeded": {
        const pi = event.data.object;
        if (!isBankKind(pi.metadata?.kind)) break;
        const synthetic = {
          id: `pi:${pi.id}`,
          payment_intent: pi.id,
          customer: pi.customer || null,
          payment_status: "paid",
          // Montant réellement reçu (centimes) — remplace metadata.amount comme source du crédit.
          amount_total: pi.amount_received > 0 ? pi.amount_received : pi.amount,
          currency: pi.currency || "eur",
          metadata: { ...pi.metadata },
        };
        const handled = await creditPaidSession(synthetic, res);
        if (handled) return handled;
        break;
      }

      case "payment_intent.partially_funded": {
        const pi = event.data.object;
        const order = await getOrderByPaymentIntent(pi.id);
        const remaining = pi.next_action?.display_bank_transfer_instructions?.amount_remaining;
        if (order && remaining != null) {
          // Visible côté chercheur (best-effort) : « il manque X€ ».
          sbJson(`bank_transfer_orders?id=eq.${order.id}`, {
            method: "PATCH",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({ amount_remaining: remaining / 100 }),
          }).catch(() => {});
        }
        await alertAdmin("partial", {
          researcherId: order?.researcher_id || null,
          orderId: order?.id || null,
          message: `Virement INCOMPLET pour ${order ? order.amount + "€" : (pi.amount / 100).toFixed(2) + "€"}${remaining != null ? ` : il manque ${(remaining / 100).toFixed(2)}€` : ""}. Rien n'est crédité tant que le solde n'est pas reçu — contactez le client si besoin.`,
          details: { payment_intent: pi.id, amount: pi.amount, amount_remaining: remaining ?? null, customer: pi.customer || null },
        });
        break;
      }

      // Optionnel : tracer les versements participants
      case "transfer.created": {
        const t = event.data.object;
        await sb(`transactions?stripe_transfer_id=eq.${t.id}`, "PATCH", { status: "processing" });
        break;
      }
      case "payout.paid":
      case "payout.failed": {
        // Versement banque participant (sur compte Connect) — log informatif
        console.log("Payout event:", event.type, event.data.object.id);
        break;
      }

      default:
        // On ignore proprement tout event non géré (recommandé par Stripe)
        break;
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("Webhook handler error:", err);
    return res.status(500).json({ error: err.message });
  }
}
