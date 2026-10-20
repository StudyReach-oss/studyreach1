// api/create-bank-transfer.js
// Recharge du portefeuille par VIREMENT BANCAIRE (institutions : universités, labos, agences…).
//
// Flux :
//   1) Le chercheur renseigne ses infos de facturation (+ n° de bon de commande facultatif).
//   2) On crée/retrouve son client Stripe, puis une session Checkout "customer_balance"
//      (virement SEPA) → Stripe affiche l'IBAN, le BIC et la référence à communiquer à la compta.
//   3) On enregistre une "commande de virement" (bank_transfer_orders), éventuellement liée à une
//      étude en attente de paiement (status = 'pending_payment').
//   4) Quand le virement arrive, le WEBHOOK (api/webhook.js) crédite le portefeuille et publie l'étude.
//      Rien n'est jamais crédité ici : ne jamais créditer côté client.
//
// MODÈLE ACTUEL (UI) : portefeuille seul. Le chercheur recharge son portefeuille (carte ou virement,
// sans studyId) et publie ensuite son étude uniquement si le solde est suffisant. Le mode "étude liée"
// (studyId + publication automatique) reste disponible côté serveur mais n'est plus appelé par l'interface.
//
// Le montant est calculé côté SERVEUR (jamais pris tel quel depuis le navigateur) quand une étude est liée.

import Stripe from "stripe";
import { requireUser, unauthorized } from "./_lib/auth.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-05-27.dahlia",
});

const SITE_URL = process.env.SITE_URL || "https://getstudyreach.com";
const SUPABASE_URL = process.env.SUPABASE_URL || "https://bwaoxwfkqqpqvtpynwzh.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const MIN_TRANSFER = Number(process.env.BANK_TRANSFER_MIN || 50); // € — montant minimum d'un virement
const MAX_TRANSFER = 50000; // € — garde-fou
// Pays de l'IBAN affiché au client (FR, DE, ES, IE, NL, BE selon Stripe) — doit correspondre à ton compte.
const IBAN_COUNTRY = process.env.BANK_TRANSFER_COUNTRY || "FR";
const MAX_QUEUE = 5000; // participants prévenus par email à la publication
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const sbHeaders = {
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  "Content-Type": "application/json",
};

async function sbGet(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders });
  if (!r.ok) throw new Error(`Supabase GET ${path} → HTTP ${r.status}`);
  return r.json();
}

const clean = (v, max) => String(v ?? "").trim().slice(0, max);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = await requireUser(req);
  if (!user) return unauthorized(res);
  const userId = user.id;

  const body = req.body || {};
  const billing = {
    name: clean(body.billing?.name, 200),
    address: clean(body.billing?.address, 500),
    vat: clean(body.billing?.vat, 40),
    siret: clean(body.billing?.siret, 40),
  };
  const poNumber = clean(body.po_number, 80) || null;
  const studyId = body.studyId ? Number(body.studyId) : null;

  if (!billing.name) return res.status(400).json({ error: "Raison sociale / nom à facturer requis." });
  if (!billing.address) return res.status(400).json({ error: "Adresse de facturation requise." });

  try {
    // 🔒 Seuls les chercheurs peuvent recharger
    const profs = await sbGet(`profiles?id=eq.${userId}&select=id,role,email,first_name,last_name,wallet`);
    const prof = profs[0];
    if (!prof || prof.role !== "researcher") {
      return res.status(403).json({ error: "Réservé aux comptes chercheurs." });
    }

    // ── Montant : calculé côté serveur si une étude est liée ──────────────
    let amount;
    let queue = [];
    if (studyId) {
      const studies = await sbGet(
        `studies?id=eq.${studyId}&researcher_id=eq.${userId}&select=id,status,cost_per_participant,max_participants,is_test`
      );
      const study = studies[0];
      if (!study) return res.status(404).json({ error: "Étude introuvable." });
      if (study.status !== "pending_payment") {
        return res.status(409).json({ error: "Cette étude n'est pas en attente de paiement." });
      }
      if (study.is_test) return res.status(400).json({ error: "Une étude offerte n'a pas besoin de paiement." });

      const required = Math.round((Number(study.cost_per_participant) || 0) * (Number(study.max_participants) || 0) * 100) / 100;
      const missing = Math.ceil(Math.max(0, required - (Number(prof.wallet) || 0)));
      // Rien à payer ? (le solde couvre déjà le budget) → pas de virement nécessaire.
      if (missing <= 0) return res.status(400).json({ error: "Votre solde couvre déjà cette étude : publiez-la directement." });
      amount = Math.max(missing, MIN_TRANSFER);

      // Participants à prévenir une fois l'étude publiée (liste calculée par le navigateur,
      // revalidée ici : ids valides uniquement, plafonnée).
      queue = (Array.isArray(body.queue) ? body.queue : [])
        .slice(0, MAX_QUEUE)
        .filter((q) => q && UUID_RE.test(String(q.participant_id)))
        .map((q) => ({
          participant_id: String(q.participant_id),
          study_price: Number.isFinite(Number(q.study_price)) ? Number(q.study_price) : null,
          study_type_label: clean(q.study_type_label, 80) || null,
        }));
    } else {
      amount = parseFloat(body.amount);
      if (!amount || amount <= 0) return res.status(400).json({ error: "Montant invalide." });
      if (amount < MIN_TRANSFER) return res.status(400).json({ error: `Montant minimum pour un virement : ${MIN_TRANSFER}€.` });
    }
    if (amount > MAX_TRANSFER) return res.status(400).json({ error: `Montant maximum : ${MAX_TRANSFER}€ par virement.` });
    amount = Math.round(amount * 100) / 100;

    // ── Infos de facturation + client Stripe (le virement exige un Customer) ──
    const existing = (await sbGet(`researcher_billing?researcher_id=eq.${userId}&select=stripe_customer_id`))[0];
    let customerId = existing?.stripe_customer_id || null;
    const customerFields = {
      name: billing.name,
      email: prof.email || user.email || undefined,
      description: [billing.address, billing.vat && `TVA: ${billing.vat}`, billing.siret && `SIRET: ${billing.siret}`].filter(Boolean).join(" | "),
      metadata: { researcher_id: userId },
    };
    if (customerId) {
      await stripe.customers.update(customerId, customerFields);
    } else {
      const c = await stripe.customers.create(customerFields);
      customerId = c.id;
    }
    const up = await fetch(`${SUPABASE_URL}/rest/v1/researcher_billing?on_conflict=researcher_id`, {
      method: "POST",
      headers: { ...sbHeaders, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        researcher_id: userId,
        stripe_customer_id: customerId,
        billing_name: billing.name,
        billing_address: billing.address,
        billing_vat_number: billing.vat || null,
        billing_siret: billing.siret || null,
        updated_at: new Date().toISOString(),
      }),
    });
    if (!up.ok) throw new Error(`researcher_billing upsert → HTTP ${up.status} ${await up.text().catch(() => "")}`);

    // ── Session Checkout : virement SEPA ──────────────────────────────────
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      payment_method_types: ["customer_balance"],
      payment_method_options: {
        customer_balance: {
          funding_type: "bank_transfer",
          bank_transfer: { type: "eu_bank_transfer", eu_bank_transfer: { country: IBAN_COUNTRY } },
        },
      },
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: { name: "Recharge portefeuille StudyReach (virement)" },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      // Lu par le webhook : userId/amount comme pour la carte, + kind pour distinguer le virement
      metadata: {
        userId: String(userId),
        amount: amount.toFixed(2),
        kind: "wallet_recharge_transfer",
        ...(poNumber ? { po_number: poNumber } : {}),
      },
      // ⚠️ Si Stripe redirige ICI (une fois les coordonnées bancaires affichées), l'argent n'est PAS encore reçu :
      // on ne passe donc surtout pas par ?payment=success (qui affiche "Recharge effectuée" et crédite visuellement).
      // Le front affiche « ⏳ En attente de virement » ; le crédit réel n'arrive que par le webhook.
      // (Stripe n'impose pas de redirection depuis la page des coordonnées bancaires : le front relit aussi
      // les virements en attente à chaque retour sur l'onglet, voir App.jsx.)
      success_url: `${SITE_URL}/?payment=transfer_pending&amount=${amount}`,
      cancel_url: `${SITE_URL}/?payment=cancel`,
    });

    // ── Commande de virement (suivi + lien avec l'étude en attente) ────────
    const ins = await fetch(`${SUPABASE_URL}/rest/v1/bank_transfer_orders`, {
      method: "POST",
      headers: { ...sbHeaders, Prefer: "return=minimal" },
      body: JSON.stringify({
        researcher_id: userId,
        amount,
        po_number: poNumber,
        stripe_session_id: session.id,
        study_id: studyId,
        email_queue: queue,
        status: "pending_checkout",
      }),
    });
    if (!ins.ok) {
      const t = await ins.text().catch(() => "");
      console.error(`[create-bank-transfer] Insert commande échoué (HTTP ${ins.status}): ${t}`);
      // Un autre virement est peut-être déjà ouvert pour cette étude (index unique)
      if (ins.status === 409) return res.status(409).json({ error: "Un virement est déjà en attente pour cette étude. Consultez l'onglet Factures." });
      return res.status(500).json({ error: "Impossible d'enregistrer la commande de virement." });
    }

    return res.status(200).json({ url: session.url, amount });
  } catch (err) {
    console.error("create-bank-transfer error:", err);
    return res.status(500).json({ error: "Erreur lors de la création du virement", details: err.message });
  }
}
