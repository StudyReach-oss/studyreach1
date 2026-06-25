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

        // 1) Crédit atomique du wallet via la fonction Postgres existante
        await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_wallet`, {
          method: "POST",
          headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ p_profile_id: userId, p_amount: amount }),
        });

        // 2) Log de la transaction
        await sb("transactions", "POST", {
          user_id: userId,
          type: "recharge",
          amount,
          total: amount,
          status: "completed",
          description: "Recharge portefeuille (Stripe)",
          stripe_session_id: session.id,
          stripe_payment_intent_id: session.payment_intent || null,
          created_at: new Date().toISOString(),
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
