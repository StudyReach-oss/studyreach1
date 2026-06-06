const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_SECRET = process.env.PAYPAL_SECRET;
const PAYPAL_BASE = "https://api-m.paypal.com";
const STUDYREACH_PAYPAL = process.env.STUDYREACH_PAYPAL_EMAIL || "freelance.project.web@gmail.com";

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
  const { token: orderId } = req.query;
  if (!orderId) return res.redirect("/?payment=error");

  try {
    const accessToken = await getAccessToken();

    // Capture the payment
    const capture = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderId}/capture`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    const captureData = await capture.json();
    const amount = captureData.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value;
    const userId = captureData.purchase_units?.[0]?.custom_id;

    if (captureData.status === "COMPLETED") {
      // Redirect back to app with success
      return res.redirect(`/?payment=success&amount=${amount}&userId=${userId}`);
    } else {
      return res.redirect("/?payment=error");
    }
  } catch (err) {
    console.error("PayPal capture error:", err);
    return res.redirect("/?payment=error");
  }
}
