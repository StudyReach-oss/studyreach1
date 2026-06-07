// App.jsx
// Remplacez votre composant App actuel par ce code.

export default function App() {
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("landing");
  const [role, setRole] = useState(null);

  useEffect(() => {
    const restoreSession = async () => {
      const token = Storage.get("sb_token");
      const savedRole = Storage.get("sb_role");

      if (!token || !savedRole) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(
          "https://bwaoxwfkqqpqvtpynwzh.supabase.co/auth/v1/user",
          {
            headers: {
              apikey: "sb_publishable_SsnkELg6dLx--AjHaW0ShA_N1ISmMKg",
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!res.ok) {
          Storage.remove("sb_token");
          Storage.remove("sb_role");
          setLoading(false);
          return;
        }

        const user = await res.json();

        if (user?.id) {
          setRole(savedRole);
          setView(savedRole);
        } else {
          Storage.remove("sb_token");
          Storage.remove("sb_role");
        }
      } catch (err) {
        console.error(err);
      }

      setLoading(false);
    };

    restoreSession();
  }, []);

  const nav = (v) => {
    if (v === "landing") {
      setRole(null);
      Storage.remove("sb_token");
      Storage.remove("sb_role");
    }

    setView(v);
  };

  const authDone = (r) => {
    setRole(r);
    setView(r);
  };

  if (loading) {
    return <div>Chargement...</div>;
  }

  return <div>Version corrigée App()</div>;
}
