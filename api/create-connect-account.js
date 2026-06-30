// api/create-connect-account.js
// Onboarding participant pour recevoir des paiements via Stripe Connect (Express).
// Stripe ne peut pas envoyer d'argent à une simple adresse email.
// Chaque participant doit créer un compte Connect et renseigner
// son IBAN + identité une seule fois. Ensuite api/payout.js peut le payer.
//
// Flux :
//  1. Front appelle ce endpoint avec { userId, email }
//  2. On crée (ou réutilise) un compte Express, on stocke stripe_account_id
//  3. On renvoie une URL d'onboarding → le front redirige le participant
//  4. Au retour, le participant peut retirer ses gains

import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-05-27.dahlia",
});

const SITE_URL = process.env.SITE_URL || "https://getstudyreach.com";
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

async function saveAccountId(userId, accountId) {
  await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ stripe_account_id: accountId }),
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { userId, email } = req.body || {};
  if (!userId) return res.status(400).json({ error: "userId manquant." });

  try {
    const profile = await getProfile(userId);
    let accountId = profile?.stripe_account_id;

    // Crée le compte Express si pas encore fait
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "FR",
        email: email || profile?.email || undefined,
        capabilities: { transfers: { requested: true } },
        business_type: "individual",
        metadata: { userId: String(userId) },
      });
      accountId = account.id;
      await saveAccountId(userId, accountId);
    }

    // Lien d'onboarding (à usage unique, courte durée)
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${SITE_URL}/?connect=refresh`,
      return_url: `${SITE_URL}/?connect=done`,
      type: "account_onboarding",
    });

    return res.status(200).json({ url: accountLink.url, accountId });
  } catch (err) {
    console.error("Connect onboarding error:", err);
    return res.status(500).json({ error: "Erreur Stripe Connect", details: err.message });
  }
}
