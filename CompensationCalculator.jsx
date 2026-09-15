import React, { useState } from "react";

const C = {
  bg:"#07080e", surface:"#0e1120", surfaceHigh:"#141829", border:"#1c2035",
  accent:"#5b7cfa", accentGlow:"rgba(91,124,250,0.15)", accentLight:"#8fa4ff",
  green:"#1ec98a", greenGlow:"rgba(30,201,138,0.13)",
  text:"#dce2f5", muted:"#606880", dimmed:"#3a4060",
  white:"#fff",
};
const FONT = "'Plus Jakarta Sans', 'DM Sans', sans-serif";

const STUDY_TYPES = {
  interview: {
    label: "Entretien qualitatif",
    icon: "💬",
    basePrices: { 15: 20, 30: 35, 45: 50, 60: 65 },
    description: "1 participant face-à-face (ou Zoom)"
  },
  usability: {
    label: "Test d'utilisabilité",
    icon: "🖥️",
    basePrices: { 15: 25, 30: 40, 45: 55, 60: 75 },
    description: "Participant teste votre site/app"
  },
  survey: {
    label: "Sondage / Questionnaire",
    icon: "📋",
    basePrices: { 10: 5, 15: 8, 20: 10, 30: 15 },
    description: "Participant remplit un formulaire"
  },
  focus_group: {
    label: "Focus group",
    icon: "👥",
    basePrices: { 60: 50, 90: 70, 120: 90 },
    description: "Groupe de discussion (par personne)"
  },
  longitudinal: {
    label: "Étude longitudinale",
    icon: "",
    basePrices: { "30j": 80, "60j": 150, "90j": 220 },
    description: "Participant suivi pendant plusieurs semaines"
  },
  diary: {
    label: "Journal de bord",
    icon: "📝",
    basePrices: { "7j": 30, "14j": 55, "30j": 100 },
    description: "Participant note ses observations X jours"
  },
  experiment: {
    label: "Expérience / Protocole",
    icon: "🧪",
    basePrices: { 30: 40, 60: 65, 90: 90 },
    description: "Participant en labo ou en ligne"
  },
  other: {
    label: "Autre type d'étude",
    icon: "🔬",
    basePrices: { 30: 30, 60: 55, 120: 100 },
    description: "À adapter selon votre contexte"
  }
};

const POPULATION_MULTIPLIERS = {
  general: { 
    label: "Grand public", 
    mult: 1,
    explanation: "N'importe qui peut participer"
  },
  specialized: { 
    label: "Population spécialisée", 
    mult: 1.5,
    explanation: "Besoin d'expertise ou de compétences spéciales (ex: développeurs, designers)"
  },
  patients: { 
    label: "Patients / Personnes en situation de vulnérabilité", 
    mult: 2,
    explanation: "Personnes malades ou en difficulté → rémunération plus élevée par respect éthique"
  },
  executives: { 
    label: "Cadres dirigeants / Experts", 
    mult: 2.5,
    explanation: "Leur temps coûte très cher → compensation proportionnelle"
  },
};

const CompensationCalculator = () => {
  const [studyType, setStudyType] = useState("interview");
  const [duration, setDuration] = useState("30");
  const [population, setPopulation] = useState("general");
  const [showResult, setShowResult] = useState(false);

  const getBasePrice = () => {
    const study = STUDY_TYPES[studyType];
    const key = (studyType === "longitudinal" || studyType === "diary") 
      ? `${duration}j` 
      : parseInt(duration);
    return study.basePrices[key] || null;
  };

  const basePrice = getBasePrice();
  const multiplier = POPULATION_MULTIPLIERS[population].mult;
  const finalPrice = basePrice ? Math.round(basePrice * multiplier) : 0;
  const minPrice = Math.round(finalPrice * 0.85);
  const maxPrice = Math.round(finalPrice * 1.15);

  const durations = () => {
    const study = STUDY_TYPES[studyType];
    if (studyType === "longitudinal" || studyType === "diary") {
      return Object.keys(study.basePrices);
    }
    return Object.keys(study.basePrices).map(Number).sort((a, b) => a - b).map(String);
  };

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
            Un outil pour déterminer la rémunération juste et éthique de vos participants. Basé sur les standards académiques français.
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
              {Object.entries(STUDY_TYPES).map(([key, data]) => (
                <button
                  key={key}
                  onClick={() => { setStudyType(key); setShowResult(false); setDuration(Object.keys(data.basePrices)[0]); }}
                  style={{
                    padding: "16px",
                    background: studyType === key ? C.accentGlow : "transparent",
                    border: `2px solid ${studyType === key ? C.accent : C.border}`,
                    borderRadius: "8px",
                    color: C.text,
                    cursor: "pointer",
                    fontFamily: FONT,
                    fontSize: "14px",
                    fontWeight: 500,
                    transition: "all 0.2s",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => { if (studyType !== key) e.target.style.borderColor = C.accentLight; }}
                  onMouseLeave={(e) => { if (studyType !== key) e.target.style.borderColor = C.border; }}
                >
                  {data.icon && (
                    <div style={{ fontSize: "20px", marginBottom: "6px" }}>{data.icon}</div>
                  )}
                  <div style={{ fontWeight: 600, marginBottom: "4px" }}>{data.label}</div>
                  <div style={{ fontSize: "12px", color: C.muted }}>{data.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* ÉTAPE 2 */}
          <div style={{ marginBottom: "50px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: C.accentLight, marginBottom: "20px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Étape 2 — Combien de temps ?
            </h2>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))",
              gap: "10px",
            }}>
              {durations().map((d) => (
                <button
                  key={d}
                  onClick={() => { setDuration(d); setShowResult(false); }}
                  style={{
                    padding: "12px",
                    background: duration === d ? C.accentGlow : "transparent",
                    border: `2px solid ${duration === d ? C.accent : C.border}`,
                    borderRadius: "8px",
                    color: C.text,
                    cursor: "pointer",
                    fontFamily: FONT,
                    fontSize: "14px",
                    fontWeight: 600,
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => { if (duration !== d) e.target.style.borderColor = C.accentLight; }}
                  onMouseLeave={(e) => { if (duration !== d) e.target.style.borderColor = C.border; }}
                >
                  {d}{studyType === "longitudinal" || studyType === "diary" ? "" : " min"}
                </button>
              ))}
            </div>
          </div>

          {/* ÉTAPE 3 */}
          <div style={{ marginBottom: "50px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: C.accentLight, marginBottom: "20px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Étape 3 — Quel type de participant ?
            </h2>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "12px",
            }}>
              {Object.entries(POPULATION_MULTIPLIERS).map(([key, data]) => (
                <button
                  key={key}
                  onClick={() => { setPopulation(key); setShowResult(false); }}
                  style={{
                    padding: "16px",
                    background: population === key ? C.greenGlow : "transparent",
                    border: `2px solid ${population === key ? C.green : C.border}`,
                    borderRadius: "8px",
                    color: C.text,
                    cursor: "pointer",
                    fontFamily: FONT,
                    fontSize: "13px",
                    fontWeight: 500,
                    transition: "all 0.2s",
                    textAlign: "left",
                    lineHeight: 1.4,
                  }}
                  onMouseEnter={(e) => { if (population !== key) e.target.style.borderColor = C.green; }}
                  onMouseLeave={(e) => { if (population !== key) e.target.style.borderColor = C.border; }}
                >
                  <div style={{ fontWeight: 700, marginBottom: "6px", color: C.text }}>{data.label}</div>
                  <div style={{ fontSize: "11px", color: C.muted, marginBottom: "6px" }}>{data.explanation}</div>
                  <div style={{ fontSize: "12px", color: C.green, fontWeight: 600 }}>
                    {data.mult === 1
                      ? "Tarif de base (pas de majoration)"
                      : `+${Math.round((data.mult - 1) * 100)}% par rapport au tarif de base`}
                  </div>
                </button>
              ))}
            </div>
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
                q: "Et si je ne peux pas me permettre ces tarifs ?",
                a: "Réduisez la durée de l'étude, réduisez le nombre de participants, ou visez une population moins spécialisée. Soyez honnête dès l'appel à participants sur votre budget."
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
        {showResult && basePrice && (
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
                Prix recommandé par participant
              </p>
              <div style={{
                fontSize: "56px",
                fontWeight: 700,
                color: C.green,
                marginBottom: "8px",
                fontVariantNumeric: "tabular-nums",
              }}>
                {minPrice}€ — {maxPrice}€
              </div>
              <p style={{ fontSize: "13px", color: C.muted, fontStyle: "italic" }}>
                ±15% pour tenir compte des régions et contextes différents
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
                  <strong style={{ color: C.text }}>Prix de base :</strong> {basePrice}€ 
                  {studyType === "interview" && " (pour " + duration + " min d'entretien)"}
                </p>
                <p style={{ margin: "0 0 12px 0" }}>
                  <strong style={{ color: C.text }}>Type de participant :</strong> {POPULATION_MULTIPLIERS[population].label} 
                  <br/>
                  <span style={{ fontSize: "12px", color: C.muted }}>{POPULATION_MULTIPLIERS[population].explanation}</span>
                </p>
                <p style={{ margin: "0 0 0 0" }}>
                  <strong style={{ color: C.text }}>Calcul :</strong> {basePrice}€
                  {multiplier > 1 ? ` + ${Math.round((multiplier - 1) * 100)}% (majoration) ` : " "}
                  = <strong style={{ color: C.green, fontSize: "15px" }}>{finalPrice}€</strong>
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
                <li><strong style={{ color: C.text }}>Versez rapidement :</strong> Idéalement dans la semaine suivant la participation (2 semaines maximum)</li>
                <li><strong style={{ color: C.text }}>Tracez les paiements :</strong> Gardez un registre pour conformité légale et audit</li>
                <li><strong style={{ color: C.text }}>Adaptez si nécessaire :</strong> Si votre participant demande une expertise rare (développeur, chercheur), vous pouvez augmenter</li>
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
