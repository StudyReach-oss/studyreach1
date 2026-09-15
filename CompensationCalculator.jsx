import React, { useState } from "react";

const C = {
  bg:"#07080e", surface:"#0e1120", surfaceHigh:"#141829", border:"#1c2035",
  accent:"#5b7cfa", accentGlow:"rgba(91,124,250,0.15)", accentLight:"#8fa4ff",
  green:"#1ec98a", greenGlow:"rgba(30,201,138,0.13)",
  text:"#dce2f5", muted:"#606880", dimmed:"#3a4060",
  white:"#fff",
};
const FONT = "'Plus Jakarta Sans', 'DM Sans', sans-serif";

// Les 7 types d'étude réels de la plateforme (mêmes id/label/icônes que STUDY_TYPES dans App.jsx).
// Le type d'étude n'a AUCUN impact sur le prix : il est purement informatif ici (comme sur la plateforme).
const STUDY_TYPES = [
  { id: "video", icon: "🎥", label: "Appel vidéo", color: "#5b7cfa" },
  { id: "video_group", icon: "🎥👥", label: "Appel vidéo (groupe)", color: "#5b7cfa" },
  { id: "inperson", icon: "🤝", label: "En personne", color: "#1ec98a" },
  { id: "inperson_group", icon: "🤝👥", label: "En personne (groupe)", color: "#1ec98a" },
  { id: "task", icon: "💻", label: "Tâche en ligne", color: "#f59e0b" },
  { id: "survey", icon: "📋", label: "Enquête", color: "#f59e0b" },
  { id: "diary", icon: "📓", label: "Étude de journal", color: "#ec4899" },
];

// Barème réel, identique à DURATIONS dans App.jsx. Une seule table, valable pour tous les types d'étude.
const DURATIONS = [
  { id: "5", l: "5 min", price: 10, desc: "Test ultra-rapide" },
  { id: "10", l: "10 min", price: 20, desc: "Retour express ciblé" },
  { id: "20", l: "20 min", price: 30, desc: "Format standard approfondi", popular: true },
  { id: "30", l: "30 min", price: 35, desc: "Entretien approfondi" },
  { id: "40", l: "40 min", price: 40, desc: "Exploration détaillée" },
  { id: "50", l: "50 min", price: 45, desc: "Analyse complète" },
  { id: "60", l: "60 min", price: 50, desc: "Session longue" },
];

const AI_SURCHARGE = 10; // Supplément facturé au chercheur pour le mode "Entretiens IA" — marge StudyReach, pas un bonus participant (cf. App.jsx).

// Plus de multiplicateur de prix ici : la population n'entre plus dans le calcul.
// On garde uniquement un conseil textuel, cohérent avec le vrai système (durée = seul levier de prix).
const POPULATION_TIPS = {
  general: {
    label: "Grand public",
    explanation: "N'importe qui peut participer",
    tip: "Le tarif de base suffit généralement pour ce profil.",
  },
  specialized: {
    label: "Population spécialisée",
    explanation: "Besoin d'expertise ou de compétences spéciales (ex : développeurs, designers)",
    tip: "Pour mieux valoriser un public expert, choisissez plutôt une durée plus longue (40 à 60 min).",
  },
  patients: {
    label: "Patients / personnes en situation de vulnérabilité",
    explanation: "Personnes malades ou en difficulté → attention particulière",
    tip: "Restez sur le barème standard, mais soignez le confort de l'entretien : une durée plus courte est souvent préférable.",
  },
  executives: {
    label: "Cadres dirigeants / experts",
    explanation: "Leur temps coûte cher, mais le tarif reste plafonné par le barème plateforme",
    tip: "Le tarif maximum toutes durées confondues est 60€ (60 min + option IA). Si ce plafond ne suffit pas pour ce profil, StudyReach n'est probablement pas le bon canal pour ce recrutement.",
  },
};

const CompensationCalculator = () => {
  const [studyType, setStudyType] = useState("video");
  const [durationId, setDurationId] = useState("20");
  const [showPopulationNote, setShowPopulationNote] = useState(false);
  const [aiMode, setAiMode] = useState(false);
  const [showResult, setShowResult] = useState(false);

  const duration = DURATIONS.find((d) => d.id === durationId);
  const basePrice = duration ? duration.price : 0;
  const researcherPays = basePrice + (aiMode ? AI_SURCHARGE : 0);
  const participantNet = Math.round(basePrice * 0.9 * 100) / 100;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: FONT }}>
      {/* HERO */}
      <section style={{
        background: `linear-gradient(135deg, ${C.surface} 0%, ${C.surfaceHigh} 100%)`,
        borderBottom: `1px solid ${C.border}`,
        padding: "60px 20px",
        textAlign: "center",
      }}>
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
          <h1 style={{ fontSize: "48px", fontWeight: 700, marginBottom: "16px", color: C.accentLight }}>
            Combien payer vos participants ?
          </h1>
          <p style={{ fontSize: "18px", color: C.muted, marginBottom: "0px", lineHeight: 1.6 }}>
            Le tarif exact que vous retrouverez lors de la publication de votre étude sur StudyReach — aucune surprise.
          </p>
        </div>
      </section>

      {/* CALCULATEUR */}
      <section style={{ maxWidth: "900px", margin: "0 auto", padding: "60px 20px" }}>
        <div style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: "12px",
          padding: "40px",
        }}>
          {/* ÉTAPE 1 */}
          <div style={{ marginBottom: "50px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: C.accentLight, marginBottom: "20px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Étape 1 — Quel type d'étude ?
            </h2>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "12px",
            }}>
              {STUDY_TYPES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setStudyType(t.id); setShowResult(false); }}
                  style={{
                    padding: "16px",
                    background: studyType === t.id ? C.accentGlow : "transparent",
                    border: `2px solid ${studyType === t.id ? C.accent : C.border}`,
                    borderRadius: "8px",
                    color: C.text,
                    cursor: "pointer",
                    fontFamily: FONT,
                    fontSize: "14px",
                    fontWeight: 500,
                    transition: "all 0.2s",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => { if (studyType !== t.id) e.target.style.borderColor = C.accentLight; }}
                  onMouseLeave={(e) => { if (studyType !== t.id) e.target.style.borderColor = C.border; }}
                >
                  <div style={{ fontSize: "20px", marginBottom: "6px" }}>{t.icon}</div>
                  <div style={{ fontWeight: 600 }}>{t.label}</div>
                </button>
              ))}
            </div>
            <p style={{ fontSize: "12px", color: C.dimmed, marginTop: "12px", fontStyle: "italic" }}>
              Le type d'étude n'affecte pas le prix : sur StudyReach, seule la durée détermine la rémunération.
            </p>
          </div>

          {/* ÉTAPE 2 */}
          <div style={{ marginBottom: "50px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: C.accentLight, marginBottom: "20px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Étape 2 — Combien de temps ?
            </h2>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
              gap: "10px",
            }}>
              {DURATIONS.map((d) => (
                <button
                  key={d.id}
                  onClick={() => { setDurationId(d.id); setShowResult(false); }}
                  style={{
                    padding: "12px",
                    background: durationId === d.id ? C.accentGlow : "transparent",
                    border: `2px solid ${durationId === d.id ? C.accent : C.border}`,
                    borderRadius: "8px",
                    color: C.text,
                    cursor: "pointer",
                    fontFamily: FONT,
                    fontSize: "14px",
                    fontWeight: 600,
                    transition: "all 0.2s",
                    textAlign: "center",
                  }}
                  onMouseEnter={(e) => { if (durationId !== d.id) e.target.style.borderColor = C.accentLight; }}
                  onMouseLeave={(e) => { if (durationId !== d.id) e.target.style.borderColor = C.border; }}
                >
                  <div>{d.l}</div>
                  <div style={{ fontSize: "12px", color: C.green, fontWeight: 700, marginTop: "4px" }}>{d.price}€</div>
                </button>
              ))}
            </div>

            {/* NOTE CONTEXTUELLE — ne fait plus partie du calcul, juste un conseil au clic */}
            <button
              onClick={() => setShowPopulationNote(!showPopulationNote)}
              style={{
                marginTop: "16px",
                background: "transparent",
                border: "none",
                color: C.accentLight,
                fontFamily: FONT,
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                padding: 0,
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              {showPopulationNote ? "▾" : "▸"} Public difficile à recruter ?
            </button>
            {showPopulationNote && (
              <div style={{
                marginTop: "12px",
                background: C.surfaceHigh,
                border: `1px solid ${C.border}`,
                borderRadius: "8px",
                padding: "16px",
                display: "grid",
                gap: "12px",
              }}>
                {Object.entries(POPULATION_TIPS).filter(([key]) => key !== "general").map(([key, data]) => (
                  <div key={key}>
                    <p style={{ margin: "0 0 4px 0", fontSize: "12px", fontWeight: 700, color: C.text }}>{data.label}</p>
                    <p style={{ margin: 0, fontSize: "12px", color: C.muted, lineHeight: 1.5 }}>{data.tip}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ÉTAPE 3 — OPTION IA */}
          <div style={{ marginBottom: "50px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: C.accentLight, marginBottom: "20px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Étape 3 — Entretiens menés par l'IA StudyReach ?
            </h2>
            <button
              onClick={() => { setAiMode(!aiMode); setShowResult(false); }}
              style={{
                width: "100%",
                padding: "16px",
                background: aiMode ? C.accentGlow : "transparent",
                border: `2px solid ${aiMode ? C.accent : C.border}`,
                borderRadius: "8px",
                color: C.text,
                cursor: "pointer",
                fontFamily: FONT,
                fontSize: "14px",
                fontWeight: 500,
                textAlign: "left",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>🤖 Notre IA conduit et synthétise l'entretien à votre place</span>
              <strong style={{ color: C.accentLight }}>{aiMode ? "Activé — " : "Désactivé — "}+{AI_SURCHARGE}€ / participant</strong>
            </button>
            <p style={{ fontSize: "12px", color: C.dimmed, marginTop: "12px", fontStyle: "italic" }}>
              Ce supplément est facturé au chercheur (marge StudyReach) — il n'augmente pas la rémunération versée au participant.
            </p>
          </div>

          {/* BOUTON */}
          <button
            onClick={() => setShowResult(true)}
            style={{
              width: "100%",
              padding: "16px",
              background: C.accent,
              color: C.white,
              border: "none",
              borderRadius: "8px",
              fontSize: "16px",
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: FONT,
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => { e.target.style.background = C.accentLight; }}
            onMouseLeave={(e) => { e.target.style.background = C.accent; }}
          >
            Calculer la rémunération →
          </button>
        </div>

        {/* FAQ - toujours visible, même avant de cliquer sur Calculer */}
        <div style={{
          marginTop: "40px",
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: "12px",
          padding: "28px",
        }}>
          <h3 style={{ margin: "0 0 18px 0", fontSize: "16px", fontWeight: 700, color: C.accentLight }}>
            Questions fréquentes
          </h3>
          <div style={{ display: "grid", gap: "16px" }}>
            {[
              {
                q: "Pourquoi je ne peux pas payer plus ou moins que le barème ?",
                a: "Le prix est fixé par la durée de l'étude (10€ à 50€) pour garantir une rémunération juste et cohérente sur toute la plateforme. Ajustez la durée pour changer le montant."
              },
              {
                q: "Comment je paye les participants ?",
                a: "Le montant est crédité sur le solde du participant dès la validation de sa participation. Il peut ensuite demander un retrait à tout moment : virement bancaire sécurisé via Stripe, sous 24 à 72h. Vous ne payez que les participants validés."
              },
              {
                q: "Dois-je vraiment rémunérer ?",
                a: "Oui. C'est un standard éthique. Rémunérer reconnaît le temps investi, améliore le recrutement, et satisfait les comités d'éthique."
              },
              {
                q: "Comment recruter mes participants sur StudyReach ?",
                a: "Publiez votre étude avec vos critères (thème, durée, profil ciblé). Notre algorithme de matching notifie automatiquement les participants correspondants — vous pouvez recevoir vos premiers participants sous 48h."
              },
            ].map((item, i) => (
              <div key={i}>
                <p style={{ margin: "0 0 4px 0", fontSize: "13px", fontWeight: 600, color: C.text }}>
                  {item.q}
                </p>
                <p style={{ margin: 0, fontSize: "13px", color: C.muted, lineHeight: 1.5 }}>
                  {item.a}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* RÉSULTAT */}
        {showResult && duration && (
          <div style={{
            marginTop: "40px",
            background: C.surfaceHigh,
            border: `2px solid ${C.green}`,
            borderRadius: "12px",
            padding: "40px",
            animation: "slideUp 0.3s ease-out"
          }}>
            <style>{`@keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }`}</style>

            {/* PRIX RECOMMANDÉ */}
            <div style={{ textAlign: "center", marginBottom: "32px" }}>
              <p style={{ fontSize: "12px", color: C.muted, marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600 }}>
                Prix par participant à sélectionner sur la plateforme
              </p>
              <div style={{
                fontSize: "56px",
                fontWeight: 700,
                color: C.green,
                marginBottom: "8px",
                fontVariantNumeric: "tabular-nums",
              }}>
                {researcherPays}€
              </div>
              <p style={{ fontSize: "13px", color: C.muted, fontStyle: "italic" }}>
                Montant exact — le même que celui que vous retrouverez à l'étape "Durée" lors de la publication.
              </p>
            </div>

            {/* EXPLICATION DU CALCUL */}
            <div style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: "8px",
              padding: "20px",
              marginBottom: "28px",
            }}>
              <h4 style={{ margin: "0 0 16px 0", fontSize: "14px", fontWeight: 700, color: C.text }}>
                🔍 Comment le calcul fonctionne ?
              </h4>
              <div style={{ fontSize: "13px", color: C.muted, lineHeight: 1.7 }}>
                <p style={{ margin: "0 0 12px 0" }}>
                  <strong style={{ color: C.text }}>Tarif pour {duration.l} :</strong> {basePrice}€
                </p>
                {aiMode && (
                  <p style={{ margin: "0 0 12px 0" }}>
                    <strong style={{ color: C.text }}>+ Option Entretiens IA :</strong> {AI_SURCHARGE}€ (marge StudyReach, ne va pas au participant)
                  </p>
                )}
                <p style={{ margin: "0 0 12px 0" }}>
                  <strong style={{ color: C.text }}>Total facturé au chercheur :</strong>{" "}
                  <strong style={{ color: C.green, fontSize: "15px" }}>{researcherPays}€</strong>
                </p>
                <p style={{ margin: 0 }}>
                  <strong style={{ color: C.text }}>Le participant reçoit :</strong> {participantNet}€ (90% du tarif de base, hors option IA — commission StudyReach : 10%)
                </p>
              </div>
            </div>

            {/* CONSEILS */}
            <div style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: "8px",
              padding: "20px",
              marginBottom: "28px",
            }}>
              <h4 style={{ margin: "0 0 16px 0", fontSize: "14px", fontWeight: 700, color: C.text }}>
                ✅ Conseils pratiques
              </h4>
              <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "13px", color: C.muted, lineHeight: 1.8 }}>
                <li><strong style={{ color: C.text }}>Soyez honnête :</strong> Mentionnez clairement le montant exact de la rémunération dans votre appel à participants</li>
                <li><strong style={{ color: C.text }}>Versez rapidement :</strong> Le montant est crédité dès la validation de la participation</li>
                <li><strong style={{ color: C.text }}>Public difficile à recruter :</strong> Privilégiez une durée plus longue plutôt qu'un tarif hors barème (impossible sur la plateforme)</li>
                <li><strong style={{ color: C.text }}>Consultez votre comité d'éthique :</strong> Pour les projets sensibles (santé, personnes vulnérables)</li>
              </ul>
            </div>

            {/* CTA */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <a href="/" style={{
                display: "inline-block",
                padding: "14px 24px",
                background: C.accent,
                color: C.white,
                textDecoration: "none",
                borderRadius: "8px",
                fontWeight: 600,
                fontSize: "14px",
                fontFamily: FONT,
                transition: "all 0.2s",
                cursor: "pointer",
                textAlign: "center",
              }}
              onMouseEnter={(e) => { e.target.style.background = C.accentLight; }}
              onMouseLeave={(e) => { e.target.style.background = C.accent; }}
              >
                ↳ Publier votre étude
              </a>

              <button
                onClick={() => setShowResult(false)}
                style={{
                  padding: "14px 24px",
                  background: "transparent",
                  color: C.accent,
                  border: `2px solid ${C.accent}`,
                  borderRadius: "8px",
                  fontWeight: 600,
                  fontSize: "14px",
                  fontFamily: FONT,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => { e.target.style.background = C.accentGlow; }}
                onMouseLeave={(e) => { e.target.style.background = "transparent"; }}
              >
                Recalculer
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default CompensationCalculator;
