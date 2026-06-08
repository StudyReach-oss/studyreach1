// api/payout.js
// Déclenché par la validation manuelle du chercheur
// Envoie le paiement au participant via PayPal Payouts API

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_SECRET = process.env.PAYPAL_SECRET;
const PAYPAL_BASE = "https://api-m.paypal.com";
const STUDYREACH_EMAIL = process.env.STUDYREACH_PAYPAL_EMAIL || "freelance.project.web@gmail.com";
const FEE_RATE = 0.10; // 10% commission StudyReach

const SUPABASE_URL = process.env.SUPABASE_URL || "https://bwaoxwfkqqpqvtpynwzh.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

async function getAccessToken() {
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString("base64");
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("Impossible d'obtenir le token PayPal : " + JSON.stringify(data));
  return data.access_token;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { participantEmail, studyAmount, studyId, participantId } = req.body;

  if (!participantEmail || !studyAmount) {
    return res.status(400).json({ error: "Données manquantes : participantEmail et studyAmount requis." });
  }

  const totalAmount = parseFloat(studyAmount);
  const fee = Math.round(totalAmount * FEE_RATE * 100) / 100;
  const participantAmount = Math.round((totalAmount - fee) * 100) / 100;

  if (participantAmount < 1) {
    return res.status(400).json({ error: "Montant trop faible pour un payout PayPal (minimum 1€)." });
  }

  try {
    const accessToken = await getAccessToken();

    const payoutItems = [
      {
        recipient_type: "EMAIL",
        amount: { value: participantAmount.toFixed(2), currency: "EUR" },
        receiver: participantEmail,
        note: `Paiement étude StudyReach #${studyId}`,
        sender_item_id: `participant_${participantId}_${Date.now()}`,
      },
    ];

    // Commission StudyReach (uniquement si différent du destinataire)
    if (STUDYREACH_EMAIL && STUDYREACH_EMAIL !== participantEmail && fee >= 0.01) {
      payoutItems.push({
        recipient_type: "EMAIL",
        amount: { value: fee.toFixed(2), currency: "EUR" },
        receiver: STUDYREACH_EMAIL,
        note: `Commission StudyReach 10% — étude #${studyId}`,
        sender_item_id: `fee_${studyId}_${Date.now()}`,
      });
    }

    const payout = await fetch(`${PAYPAL_BASE}/v1/payments/payouts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender_batch_header: {
          sender_batch_id: `studyreach_${studyId}_${Date.now()}`,
          email_subject: "StudyReach — Votre paiement est arrivé 🎉",
          email_message: `Merci pour votre participation ! Vous recevez ${participantAmount}€ pour votre étude complétée sur StudyReach.`,
        },
        items: payoutItems,
      }),
    });

    const payoutData = await payout.json();

    if (!payoutData.batch_header?.payout_batch_id) {
      console.error("PayPal payout error:", JSON.stringify(payoutData));
      throw new Error(payoutData.message || JSON.stringify(payoutData));
    }

    const batchId = payoutData.batch_header.payout_batch_id;

    // Enregistrer la transaction dans Supabase (si clé dispo)
    if (SUPABASE_KEY) {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/transactions`, {
          method: "POST",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            type: "payout",
            study_id: studyId || null,
            participant_id: participantId || null,
            participant_email: participantEmail,
            amount: participantAmount,
            fee,
            total: totalAmount,
            paypal_batch_id: batchId,
            status: "processing",
            created_at: new Date().toISOString(),
          }),
        });
      } catch (dbErr) {
        console.warn("Supabase transaction log failed (non-blocking):", dbErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      participantAmount,
      fee,
      batchId,
    });
  } catch (err) {
    console.error("PayPal payout error:", err);
    return res.status(500).json({ error: "Erreur paiement PayPal", details: err.message });
  }
}
