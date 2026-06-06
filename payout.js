const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_SECRET = process.env.PAYPAL_SECRET;
const PAYPAL_BASE = "https://api-m.paypal.com";
const STUDYREACH_EMAIL = "freelance.project.web@gmail.com";
const FEE_RATE = 0.10; // 10% StudyReach commission

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

  const { participantEmail, studyAmount, studyId, participantId } = req.body;

  if (!participantEmail || !studyAmount) {
    return res.status(400).json({ error: "Données manquantes" });
  }

  const totalAmount = parseFloat(studyAmount);
  const fee = Math.round(totalAmount * FEE_RATE * 100) / 100;
  const participantAmount = Math.round((totalAmount - fee) * 100) / 100;

  try {
    const accessToken = await getAccessToken();

    // Send payment to participant (90%)
    const payout = await fetch(`${PAYPAL_BASE}/v1/payments/payouts`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender_batch_header: {
          sender_batch_id: `study_${studyId}_participant_${participantId}_${Date.now()}`,
          email_subject: "StudyReach — Votre paiement est arrivé 🎉",
          email_message: `Merci pour votre participation ! Vous recevez ${participantAmount}€ pour votre étude complétée sur StudyReach.`,
        },
        items: [
          {
            recipient_type: "EMAIL",
            amount: { value: participantAmount.toFixed(2), currency: "EUR" },
            receiver: participantEmail,
            note: `Paiement étude StudyReach #${studyId}`,
            sender_item_id: `participant_${participantId}`,
          },
          // StudyReach commission (10%)
          {
            recipient_type: "EMAIL",
            amount: { value: fee.toFixed(2), currency: "EUR" },
            receiver: STUDYREACH_EMAIL,
            note: `Commission StudyReach 10% - étude #${studyId}`,
            sender_item_id: `fee_${studyId}`,
          },
        ],
      }),
    });

    const payoutData = await payout.json();

    if (payoutData.batch_header?.payout_batch_id) {
      return res.status(200).json({
        success: true,
        participantAmount,
        fee,
        batchId: payoutData.batch_header.payout_batch_id,
      });
    } else {
      throw new Error(JSON.stringify(payoutData));
    }
  } catch (err) {
    console.error("PayPal payout error:", err);
    return res.status(500).json({ error: "Erreur paiement PayPal" });
  }
}
