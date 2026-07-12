// api/webhook.js
// Webhook Stripe — SOURCE DE VÉRITÉ des paiements.
// - checkout.session.completed → crédite profiles.wallet (RPC increment_wallet) + log transaction
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
        if (session.payment_status !== "paid") break;

        const userId = session.metadata?.userId;
        const amount = parseFloat(session.metadata?.amount || "0");
        if (!userId || !amount) {
          console.warn("checkout.session.completed sans metadata userId/amount");
          break;
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
          // 1) Insert-first : verrou d'idempotence via l'index unique.
          const ins = await sb("transactions", "POST", txRow);
          if (ins.status === 409) {
            console.log(`[webhook] Paiement ${piId} déjà traité — ignoré (idempotence).`);
            return res.status(200).json({ received: true, duplicate: true });
          }
          if (!ins.ok) {
            const t = await ins.text().catch(() => "");
            console.error(`[webhook] Insert transaction échoué (HTTP ${ins.status}): ${t}`);
            return res.status(500).json({ error: "Transaction insert failed" });
          }

          // 2) Crédit atomique du wallet — réponse VÉRIFIÉE.
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
            // 3) Rollback du log pour ne pas bloquer les retries Stripe.
            const t = await rpc.text().catch(() => "");
            console.error(`[webhook] CRITIQUE: increment_wallet échoué (HTTP ${rpc.status}): ${t} — rollback du log + 500.`);
            await sb(
              `transactions?stripe_payment_intent_id=eq.${piId}&type=eq.recharge`,
              "DELETE"
            ).catch((e) => console.error("[webhook] Rollback log échoué:", e.message));
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
        try {
          const now = new Date();
          const dateLabel = now.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
          const piId = session.payment_intent || session.id;
          const invId = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(piId).slice(-6).toUpperCase()}`;

          await sb("invoices", "POST", {
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
          });
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
                },
              }),
            });
          }
        } catch (e) {
          console.warn("Recharge email failed (non-blocking):", e.message);
        }
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
