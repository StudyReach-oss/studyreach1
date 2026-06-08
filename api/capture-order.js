// api/capture-order.js
// Capture le paiement PayPal après retour de l'utilisateur
// Enregistre la transaction de recharge dans Supabase

const SUPABASE_URL = process.env.SUPABASE_URL || "https://bwaoxwfkqqpqvtpynwzh.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  const { orderID, userId, amount } = req.body;

  if (!orderID) {
    return res.status(400).json({ error: "orderID manquant" });
  }

  try {
    const auth = Buffer.from(
      process.env.PAYPAL_CLIENT_ID + ":" + process.env.PAYPAL_SECRET
    ).toString("base64");

    // Capture l'ordre PayPal
    const response = await fetch(
      `https://api-m.paypal.com/v2/checkout/orders/${orderID}/capture`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`,
        },
      }
    );

    const data = await response.json();

    if (data.status !== "COMPLETED") {
      return res.status(400).json({ error: "Paiement non complété", details: data });
    }

    const capturedAmount =
      data.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value || amount;

    // Enregistrer la recharge dans Supabase
    if (SUPABASE_KEY && userId) {
      try {
        // 1. Enregistrer la transaction
        await fetch(`${SUPABASE_URL}/rest/v1/transactions`, {
          method: "POST",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            type: "recharge",
            user_id: userId,
            amount: parseFloat(capturedAmount),
            fee: 0,
            total: parseFloat(capturedAmount),
            paypal_order_id: orderID,
            status: "completed",
            created_at: new Date().toISOString(),
          }),
        });

        // 2. Mettre à jour le wallet du chercheur dans profiles
        const profileRes = await fetch(
          `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=wallet`,
          {
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
            },
          }
        );
        const profiles = await profileRes.json();
        const currentWallet = profiles?.[0]?.wallet || 0;

        await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
          method: "PATCH",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            wallet: currentWallet + parseFloat(capturedAmount),
          }),
        });
      } catch (dbErr) {
        console.warn("Supabase update failed (non-blocking):", dbErr.message);
      }
    }

    return res.status(200).json({ ...data, capturedAmount });
  } catch (error) {
    console.error("Capture error:", error);
    return res.status(500).json({ error: "Erreur PayPal", details: error.message });
  }
}
