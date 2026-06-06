const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { email, password, firstName, lastName, role, paypal, profession, company } = req.body;
  if (!email || !password || !role) return res.status(400).json({ error: "Données manquantes" });
  try {
    const authRes = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: "POST",
      headers: { "apikey": SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const authData = await authRes.json();
    if (authData.error) return res.status(400).json({ error: authData.error.message });
    await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
      method: "POST",
      headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", "Prefer": "return=representation" },
      body: JSON.stringify({ id: authData.user?.id, email, first_name: firstName, last_name: lastName, role, paypal_email: paypal||null, profession: profession||null, company: company||null, wallet: 0, created_at: new Date().toISOString() }),
    });
    return res.status(200).json({ success: true, user: authData.user });
  } catch (err) {
    return res.status(500).json({ error: "Erreur serveur" });
  }
}
