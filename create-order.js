const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_SECRET = process.env.PAYPAL_SECRET;
const PAYPAL_BASE = "https://api-m.paypal.com";
const SITE_URL = process.env.SITE_URL || "https://studyreach.vercel.app";

async function getAccessToken() {
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString("base64");
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await res.json();
  return data.access_token;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { amount, userId } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: "Montant invalide" });

  try {
    const accessToken = await getAccessToken();

    const order = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          amount: {
            currency_code: "EUR",
            value: parseFloat(amount).toFixed(2),
          },
          description: `Recharge portefeuille StudyReach - ${amount}€`,
          custom_id: userId || "anonymous",
        }],
        application_context: {
          return_url: `${SITE_URL}/api/paypal/capture`,
          cancel_url: `${SITE_URL}?payment=cancelled`,
          brand_name: "StudyReach",
          locale: "fr-FR",
          user_action: "PAY_NOW",
        },
      }),
    });

    const orderData = await order.json();
    const approvalUrl = orderData.links?.find(l => l.rel === "approve")?.href;

    if (!approvalUrl) throw new Error("Pas d'URL d'approbation PayPal");

    return res.status(200).json({ approvalUrl, orderId: orderData.id });
  } catch (err) {
    console.error("PayPal create-order error:", err);
    return res.status(500).json({ error: "Erreur PayPal" });
  }
}
