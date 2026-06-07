const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, password } = req.body;

  try {
    const authRes = await fetch(
      `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      }
    );

    const authData = await authRes.json();

    if (authData.error) {
      return res.status(401).json({
        error: "Email ou mot de passe incorrect",
      });
    }

    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${authData.user.id}`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${authData.access_token}`,
        },
      }
    );

    const profiles = await profileRes.json();

    return res.status(200).json({
      success: true,
      user: {
        ...authData.user,
        ...profiles[0],
      },
      token: authData.access_token,
      refresh_token: authData.refresh_token,
      expires_in: authData.expires_in,
      expires_at: authData.expires_at,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      error: "Erreur serveur",
    });
  }
}
