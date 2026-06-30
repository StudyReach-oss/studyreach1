// api/create-checkout-session.js
// Recharge du portefeuille chercheur → Stripe Checkout (redirection hébergée).
// Le crédit RÉEL du wallet est fait par le webhook (checkout.session.completed),
// pas ici : ne jamais créditer côté client comme source de vérité.

import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-05-27.dahlia",
});

const SITE_URL = process.env.SITE_URL || "https://getstudyreach.com";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { amount, userId } = req.body || {};
  const eur = parseFloat(amount);

  if (!eur || eur <= 0) return res.status(400).json({ error: "Montant invalide." });
  if (!userId) return res.status(400).json({ error: "userId manquant." });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: { name: "Recharge portefeuille StudyReach" },
            unit_amount: Math.round(eur * 100), // en centimes
          },
          quantity: 1,
        },
      ],
      // metadata lue par le webhook pour créditer le bon compte
      metadata: { userId: String(userId), amount: eur.toFixed(2), kind: "wallet_recharge" },
      success_url: `${SITE_URL}/?payment=success&amount=${eur}`,
      cancel_url: `${SITE_URL}/?payment=cancel`,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return res.status(500).json({ error: "Erreur Stripe", details: err.message });
  }
}
