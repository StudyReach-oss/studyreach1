// api/create-bank-transfer.js
// Recharge du portefeuille par VIREMENT BANCAIRE (institutions : universités, labos, agences…).
//
// Trois actions (champ "action" du body, "create" par défaut) :
//   • create       — crée (ou RÉUTILISE) une commande de virement et renvoie l'URL Stripe des coordonnées bancaires
//   • instructions — renvoie l'URL des coordonnées bancaires d'une commande en attente (la relit chez Stripe si besoin)
//   • cancel       — retire une commande de la liste du chercheur (statut « cancelled »)
//
// Flux :
//   1) Le chercheur renseigne ses infos de facturation (+ n° de bon de commande facultatif).
//   2) On crée/retrouve son client Stripe, puis une session Checkout "customer_balance"
//      (virement SEPA) → Stripe affiche l'IBAN, le BIC et la référence à communiquer à la compta.
//   3) On enregistre une "commande de virement" (bank_transfer_orders).
//   4) Quand le virement arrive, le WEBHOOK (api/webhook.js) crédite le portefeuille.
//      Rien n'est jamais crédité ici : ne jamais créditer côté client.
//
// MODÈLE : portefeuille seul. Le chercheur recharge son portefeuille (carte ou virement) puis publie son
// étude uniquement si le solde est suffisant. L'ancien mode « étude liée » (studyId) est DÉSACTIVÉ ici ;
// le webhook et la fonction SQL activate_study_after_payment restent en place uniquement pour d'éventuelles
// commandes anciennes encore ouvertes.
//
// Anti-doublons : un même chercheur qui redemande le même montant retrouve la commande déjà ouverte au lieu
// d'en créer une nouvelle ; plafond de MAX_OPEN_ORDERS virements en attente ; clé d'idempotence Stripe
// (double clic / deux onglets).

import Stripe from "stripe";
import { createHash } from "crypto";
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
const MAX_OPEN_ORDERS = 5; // virements « en attente » simultanés par chercheur
const REUSE_CHECKOUT_MAX_AGE_MS = 23 * 3600 * 1000; // une session Checkout non finalisée expire côté Stripe après 24 h

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

async function sbPatch(path, body) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "PATCH",
    headers: { ...sbHeaders, Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
}

const clean = (v, max) => String(v ?? "").trim().slice(0, max);
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

// URL Stripe des coordonnées bancaires (IBAN, BIC, référence) d'une commande.
async function hostedUrlFromStripe(order) {
  let piId = order.stripe_payment_intent_id || null;
  if (!piId) {
    const s = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
    piId = typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id || null;
  }
  if (!piId) return null;
  const pi = await stripe.paymentIntents.retrieve(piId);
  return pi.next_action?.display_bank_transfer_instructions?.hosted_instructions_url || null;
}

async function getOwnOrder(userId, orderId) {
  if (!UUID_RE.test(String(orderId || ""))) return null;
  const rows = await sbGet(
    `bank_transfer_orders?id=eq.${orderId}&researcher_id=eq.${userId}&select=id,status,amount,stripe_session_id,stripe_payment_intent_id,hosted_instructions_url`
  );
  return rows[0] || null;
}

// ── Action « instructions » ───────────────────────────────────────────────
async function handleInstructions(userId, body, res) {
  const order = await getOwnOrder(userId, body.order_id);
  if (!order) return res.status(404).json({ error: "Virement introuvable." });
  if (order.status !== "awaiting_transfer") {
    return res.status(409).json({ error: "Ce virement n'est plus en attente." });
  }
  let url = order.hosted_instructions_url || null;
  if (!url) {
    url = await hostedUrlFromStripe(order);
    if (url) await sbPatch(`bank_transfer_orders?id=eq.${order.id}`, { hosted_instructions_url: url });
  }
  if (!url) return res.status(404).json({ error: "Coordonnées bancaires indisponibles pour le moment. Réessayez dans quelques minutes ou contactez-nous." });
  return res.status(200).json({ url });
}

// ── Action « cancel » ─────────────────────────────────────────────────────
// Retire la commande de la liste. Côté Stripe un virement déjà annoncé ne peut pas être annulé : si le
// chercheur le fait quand même, le webhook crédite le portefeuille normalement (aucun argent perdu).
async function handleCancel(userId, body, res) {
  const order = await getOwnOrder(userId, body.order_id);
  if (!order) return res.status(404).json({ error: "Virement introuvable." });
  if (!["pending_checkout", "awaiting_transfer"].includes(order.status)) {
    return res.status(409).json({ error: "Ce virement ne peut plus être retiré." });
  }
  if (order.status === "pending_checkout") {
    try { await stripe.checkout.sessions.expire(order.stripe_session_id); } catch (e) { /* déjà expirée / finalisée */ }
  }
  // Filtre sur le statut : si le webhook vient de passer la commande à « paid », on n'écrase rien.
  const r = await sbPatch(
    `bank_transfer_orders?id=eq.${order.id}&status=in.(pending_checkout,awaiting_transfer)`,
    { status: "cancelled" }
  );
  if (!r.ok) return res.status(500).json({ error: "Impossible de retirer ce virement." });
  return res.status(200).json({ ok: true });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = await requireUser(req);
  if (!user) return unauthorized(res);
  const userId = user.id;

  const body = req.body || {};
  const action = String(body.action || "create");

  try {
    // 🔒 Seuls les chercheurs
    const profs = await sbGet(`profiles?id=eq.${userId}&select=id,role,email,first_name,last_name`);
    const prof = profs[0];
    if (!prof || prof.role !== "researcher") {
      return res.status(403).json({ error: "Réservé aux comptes chercheurs." });
    }

    if (action === "instructions") return await handleInstructions(userId, body, res);
    if (action === "cancel") return await handleCancel(userId, body, res);
    if (action !== "create") return res.status(400).json({ error: "Action inconnue." });

    // ── Création ────────────────────────────────────────────────────────
    if (body.studyId) {
      return res.status(400).json({ error: "Le paiement lié à une étude n'est plus disponible : rechargez votre portefeuille, puis publiez votre étude." });
    }
    const billing = {
      name: clean(body.billing?.name, 200),
      address: clean(body.billing?.address, 500),
      vat: clean(body.billing?.vat, 40),
      siret: clean(body.billing?.siret, 40),
    };
    const poNumber = clean(body.po_number, 80) || null;
    if (!billing.name) return res.status(400).json({ error: "Raison sociale / nom à facturer requis." });
    if (!billing.address) return res.status(400).json({ error: "Adresse de facturation requise." });

    let amount = parseFloat(body.amount);
    if (!amount || amount <= 0) return res.status(400).json({ error: "Montant invalide." });
    if (amount < MIN_TRANSFER) return res.status(400).json({ error: `Montant minimum pour un virement : ${MIN_TRANSFER}€.` });
    if (amount > MAX_TRANSFER) return res.status(400).json({ error: `Montant maximum : ${MAX_TRANSFER}€ par virement.` });
    amount = Math.round(amount * 100) / 100;

    // ── Anti-doublons : réutiliser une commande déjà ouverte pour le même montant ──
    const open = await sbGet(
      `bank_transfer_orders?researcher_id=eq.${userId}&study_id=is.null&status=in.(pending_checkout,awaiting_transfer)` +
        `&order=created_at.desc&limit=50&select=id,created_at,amount,status,stripe_session_id,stripe_payment_intent_id,hosted_instructions_url`
    );
    for (const o of open) {
      if (Math.round(Number(o.amount) * 100) !== Math.round(amount * 100)) continue;
      if (o.status === "awaiting_transfer") {
        let url = o.hosted_instructions_url || null;
        if (!url) {
          try {
            url = await hostedUrlFromStripe(o);
            if (url) await sbPatch(`bank_transfer_orders?id=eq.${o.id}`, { hosted_instructions_url: url });
          } catch (e) { console.warn("[create-bank-transfer] relecture instructions échouée:", e.message); }
        }
        if (url) return res.status(200).json({ url, amount, reused: true });
      } else if (Date.now() - new Date(o.created_at).getTime() < REUSE_CHECKOUT_MAX_AGE_MS) {
        try {
          const s = await stripe.checkout.sessions.retrieve(o.stripe_session_id);
          if (s.status === "open" && s.url) return res.status(200).json({ url: s.url, amount, reused: true });
        } catch (e) { console.warn("[create-bank-transfer] relecture session échouée:", e.message); }
      }
    }
    const awaitingCount = open.filter((o) => o.status === "awaiting_transfer").length;
    if (awaitingCount >= MAX_OPEN_ORDERS) {
      return res.status(409).json({
        error: `Vous avez déjà ${awaitingCount} virements en attente. Retirez ceux que vous ne comptez pas effectuer (Portefeuille › Virements en attente) ou attendez leur réception avant d'en créer un nouveau.`,
      });
    }

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
    // Clé d'idempotence (même chercheur, même montant, même minute, mêmes infos) : un double clic ou deux
    // onglets ne créent pas deux sessions.
    const idemKey =
      "bt-" + createHash("sha1").update(JSON.stringify([userId, Math.round(amount * 100), poNumber, billing.name, Math.floor(Date.now() / 60000)])).digest("hex");
    const session = await stripe.checkout.sessions.create(
      {
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
        // on ne passe donc surtout pas par ?payment=success (qui affiche "Recharge effectuée").
        // Le front affiche « ⏳ Mes virements en attente » (onglet Portefeuille) ; le crédit réel n'arrive que
        // par le webhook. (Stripe n'impose pas de redirection depuis la page des coordonnées bancaires : le
        // front relit aussi les virements en attente à chaque retour sur l'onglet, voir App.jsx.)
        success_url: `${SITE_URL}/?payment=transfer_pending&amount=${amount}`,
        cancel_url: `${SITE_URL}/?payment=cancel`,
      },
      { idempotencyKey: idemKey }
    );

    // ── Commande de virement (suivi) ────────────────────────────────────────
    const ins = await fetch(`${SUPABASE_URL}/rest/v1/bank_transfer_orders`, {
      method: "POST",
      headers: { ...sbHeaders, Prefer: "return=minimal" },
      body: JSON.stringify({
        researcher_id: userId,
        amount,
        po_number: poNumber,
        stripe_session_id: session.id,
        study_id: null,
        email_queue: [],
        status: "pending_checkout",
      }),
    });
    if (!ins.ok) {
      const t = await ins.text().catch(() => "");
      // Requête jumelle (idempotence Stripe) : la commande existe déjà pour cette session → on la réutilise.
      if (ins.status === 409) {
        const dup = await sbGet(`bank_transfer_orders?stripe_session_id=eq.${encodeURIComponent(session.id)}&select=id`).catch(() => []);
        if (dup[0]) return res.status(200).json({ url: session.url, amount, reused: true });
      }
      console.error(`[create-bank-transfer] Insert commande échoué (HTTP ${ins.status}): ${t}`);
      return res.status(500).json({ error: "Impossible d'enregistrer la commande de virement." });
    }

    return res.status(200).json({ url: session.url, amount });
  } catch (err) {
    console.error("create-bank-transfer error:", err);
    return res.status(500).json({ error: "Erreur lors de la création du virement", details: err.message });
  }
}
