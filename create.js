const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { title, theme, duration, mode, link, cost, userId } = req.body;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/studies`, {
      method: "POST",
      headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", "Prefer": "return=representation" },
      body: JSON.stringify({ title, theme, duration, mode, link: link||null, cost_per_participant: cost, researcher_id: userId, status: "active", created_at: new Date().toISOString() }),
    });
    const data = await r.json();
    return res.status(200).json({ success: true, study: data[0] });
  } catch (err) {
    return res.status(500).json({ error: "Erreur serveur" }); 
  }
}
