export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  const { amount } = req.body;

  try {
    const auth = Buffer.from(
      process.env.PAYPAL_CLIENT_ID + ":" + process.env.PAYPAL_SECRET
    ).toString("base64");

    const response = await fetch(
      "https://api-m.paypal.com/v2/checkout/orders",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [{ amount: { currency_code: "EUR", value: String(amount) } }],
          application_context: {
            return_url: `${process.env.SITE_URL}?payment=success&amount=${amount}`,
            cancel_url: `${process.env.SITE_URL}?payment=cancel`,
          },
        }),
      }
    );

    const data = await response.json();
    const approvalUrl = data.links?.find(l => l.rel === "approve")?.href;

    if (!approvalUrl) {
      return res.status(500).json({ error: "Pas d'URL PayPal", details: data });
    }

    return res.status(200).json({ approvalUrl });
  } catch (error) {
    return res.status(500).json({ error: "Erreur PayPal", details: error.message });
  }
}
