import React, { useState, useEffect } from "react";

// Design tokens (repris de App.jsx)
const C = {
  bg:"#07080e", surface:"#0e1120", surfaceHigh:"#141829", border:"#1c2035",
  accent:"#5b7cfa", accentGlow:"rgba(91,124,250,0.15)", accentLight:"#8fa4ff",
  green:"#1ec98a", greenGlow:"rgba(30,201,138,0.13)",
  red:"#f0556a", yellow:"#f5c542", orange:"#f87c3a",
  text:"#dce2f5", muted:"#606880", dimmed:"#3a4060",
  white:"#fff",
};
const FONT = "'Plus Jakarta Sans', 'DM Sans', sans-serif";

// Données de tarification par type d'étude
const STUDY_TYPES = {
  interview: {
    label: "Entretien qualitatif",
    icon: "💬",
    basePrices: { 15: 20, 30: 35, 45: 50, 60: 65 },
    description: "Entretien semi-structuré ou ouvert"
  },
  usability: {
    label: "Test d'utilisabilité",
    icon: "🖥️",
    basePrices: { 15: 25, 30: 40, 45: 55, 60: 75 },
    description: "Test de site/app/prototype"
  },
  survey: {
    label: "Sondage / Questionnaire",
    icon: "📋",
    basePrices: { 10: 5, 15: 8, 20: 10, 30: 15 },
    description: "Sondage en ligne ou papier"
  },
  focus_group: {
    label: "Focus group",
    icon: "👥",
    basePrices: { 60: 50, 90: 70, 120: 90 },
    description: "Groupe de discussion (tarif par personne)"
  },
  longitudinal: {
    label: "Étude longitudinale",
    icon: "📊",
    basePrices: { "30j": 80, "60j": 150, "90j": 220 },
    description: "Suivi sur plusieurs semaines/mois"
  },
  diary: {
    label: "Étude de journal de bord",
    icon: "📝",
    basePrices: { "7j": 30, "14j": 55, "30j": 100 },
    description: "Suivi quotidien pendant X jours"
  },
  experiment: {
    label: "Expérience / Protocole",
    icon: "🧪",
    basePrices: { 30: 40, 60: 65, 90: 90 },
    description: "Expérience scientifique en labo/en ligne"
  },
  other: {
    label: "Autre type d'étude",
    icon: "🔬",
    basePrices: { 30: 30, 60: 55, 120: 100 },
    description: "À adapter selon le contexte"
  }
};

// Multiplicateurs par population cible
const POPULATION_MULTIPLIERS = {
  general: { label: "Grand public", mult: 1 },
  specialized: { label: "Population spécialisée", mult: 1.5 },
  patients: { label: "Patients / Personnes en situation de vulnérabilité", mult: 2 },
  executives: { label: "Cadres dirigeants / Experts", mult: 2.5 },
};

const CompensationCalculator = () => {
  const [studyType, setStudyType] = useState("interview");
  const [duration, setDuration] = useState("30");
  const [population, setPopulation] = useState("general");
  const [showResult, setShowResult] = useState(false);

  // Fonction pour obtenir le prix de base
  const getBasePrice = () => {
    const study = STUDY_TYPES[studyType];
    if (!study) return null;
    
    // Pour les études longitudinales et journaux, la durée est en jours
    const key = studyType === "longitudinal" || studyType === "diary" 
      ? `${duration}j` 
      : parseInt(duration);
    
    return study.basePrices[key] || null;
  };

  const basePrice = getBasePrice();
  const multiplier = POPULATION_MULTIPLIERS[population].mult;
  const finalPrice = basePrice ? Math.round(basePrice * multiplier) : 0;

  // Fourchette recommandée (±15%)
  const minPrice = Math.round(finalPrice * 0.85);
  const maxPrice = Math.round(finalPrice * 1.15);

  const handleCalculate = () => {
    setShowResult(true);
  };

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
          <h1 style={{ fontSize: "48px", fontWeight: 700, marginBottom: "16px", background: `linear-gradient(135deg, ${C.accentLight}, ${C.accent})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            💰 Calculateur de dédommagement
          </h1>
          <p style={{ fontSize: "18px", color: C.muted, marginBottom: "32px", lineHeight: 1.6 }}>
            Combien payer vos participants ? Entrez les paramètres de votre étude pour obtenir une fourchette tarifaire recommandée basée sur les meilleures pratiques éthiques et académiques.
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
          {/* TYPE D'ÉTUDE */}
          <div style={{ marginBottom: "40px" }}>
            <label style={{ fontSize: "14px", fontWeight: 600, color: C.accentLight, textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "12px" }}>
              1. Type d'étude
            </label>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
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
                  <div style={{ fontSize: "20px", marginBottom: "6px" }}>{data.icon}</div>
                  <div style={{ fontWeight: 600, marginBottom: "4px" }}>{data.label}</div>
                  <div style={{ fontSize: "12px", color: C.muted }}>{data.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* DURÉE */}
          <div style={{ marginBottom: "40px" }}>
            <label style={{ fontSize: "14px", fontWeight: 600, color: C.accentLight, textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "12px" }}>
              2. Durée
            </label>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
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

          {/* POPULATION CIBLE */}
          <div style={{ marginBottom: "40px" }}>
            <label style={{ fontSize: "14px", fontWeight: 600, color: C.accentLight, textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "12px" }}>
              3. Population cible
            </label>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
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
                    fontSize: "14px",
                    fontWeight: 500,
                    transition: "all 0.2s",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => { if (population !== key) e.target.style.borderColor = C.green; }}
                  onMouseLeave={(e) => { if (population !== key) e.target.style.borderColor = C.border; }}
                >
                  <div style={{ fontWeight: 600, marginBottom: "4px" }}>{data.label}</div>
                  <div style={{ fontSize: "12px", color: C.muted }}>×{data.mult}</div>
                </button>
              ))}
            </div>
          </div>

          {/* BOUTON CALCULER */}
          <button
            onClick={handleCalculate}
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
            Calculer le dédommagement
          </button>
        </div>

        {/* RÉSULTAT */}
        {showResult && basePrice && (
          <div style={{
            marginTop: "40px",
            background: C.surfaceHigh,
            border: `2px solid ${C.green}`,
            borderRadius: "12px",
            padding: "40px",
            textAlign: "center",
            animation: "slideUp 0.3s ease-out"
          }}>
            <style>{`
              @keyframes slideUp {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
              }
            `}</style>
            
            <p style={{ fontSize: "14px", color: C.muted, marginBottom: "16px", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600 }}>
              Fourchette recommandée par participant
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
            
            <div style={{
              fontSize: "16px",
              color: C.muted,
              marginBottom: "32px",
              lineHeight: 1.6,
            }}>
              <p>Prix de base : <strong style={{ color: C.text }}>{basePrice}€</strong> × {multiplier}x (population) = <strong style={{ color: C.green }}>{finalPrice}€</strong></p>
              <p style={{ fontSize: "13px", marginTop: "16px", fontStyle: "italic" }}>
                ±15% pour tenir compte des variations régionales et du contexte spécifique
              </p>
            </div>

            <div style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: "8px",
              padding: "24px",
              marginBottom: "32px",
              textAlign: "left",
            }}>
              <h4 style={{ marginBottom: "12px", color: C.accentLight }}>💡 Conseils</h4>
              <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "14px", color: C.muted, lineHeight: 1.8 }}>
                <li>Mentionnez clairement le dédommagement dans l'appel à participants</li>
                <li>Versez le paiement rapidement après participation (max 2 semaines)</li>
                <li>Documentez les montants pour conformité légale/éthique</li>
                <li>Ajustez si l'étude demande une expertise particulière (chercheurs, développeurs, etc.)</li>
                <li>Consultez votre comité d'éthique pour les projets sensibles</li>
              </ul>
            </div>

            <a href="/" style={{
              display: "inline-block",
              padding: "14px 32px",
              background: C.accent,
              color: C.white,
              textDecoration: "none",
              borderRadius: "8px",
              fontWeight: 600,
              fontSize: "14px",
              fontFamily: FONT,
              transition: "all 0.2s",
              cursor: "pointer",
              marginRight: "12px",
            }}
            onMouseEnter={(e) => { e.target.style.background = C.accentLight; }}
            onMouseLeave={(e) => { e.target.style.background = C.accent; }}
            >
              ↳ Publier votre étude sur StudyReach
            </a>
            
            <button
              onClick={() => setShowResult(false)}
              style={{
                padding: "14px 32px",
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
        )}
      </section>

      {/* FAQ */}
      <section style={{
        background: C.surface,
        borderTop: `1px solid ${C.border}`,
        padding: "60px 20px",
      }}>
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
          <h2 style={{ fontSize: "32px", fontWeight: 700, marginBottom: "40px", textAlign: "center" }}>
            Vos questions
          </h2>

          <div style={{ display: "grid", gap: "24px" }}>
            {[
              {
                q: "Ces tarifs s'appliquent-ils en France ?",
                a: "Oui, ces recommandations sont basées sur les standards français et européens pour la recherche éthique. Ajustez selon votre budget et contexte régional."
              },
              {
                q: "Dois-je vraiment rémunérer les participants ?",
                a: "Oui, c'est un standard éthique. Rémunérer reconnaît le temps investi, améliore le recrutement, et satisfait les comités d'éthique. Même un montant modéré est mieux que rien."
              },
              {
                q: "Et si je ne peux pas me permettre ces tarifs ?",
                a: "Vous pouvez réduire la durée de l'étude, réduire le nombre de participants, ou viser une population plus générale. Être honnête sur le budget dès l'appel aide aussi."
              },
              {
                q: "Comment payer les participants ?",
                a: "Virement bancaire (le plus courant), carte cadeau, chèque, ou PayPal. Tracez les paiements pour conformité légale."
              },
              {
                q: "StudyReach peut-m'aider à gérer les paiements ?",
                a: "Oui ! StudyReach automatise le recrutement, la planification et les paiements. Publiez votre étude et on s'occupe du reste."
              },
            ].map((item, i) => (
              <div key={i} style={{
                background: C.surfaceHigh,
                border: `1px solid ${C.border}`,
                borderRadius: "8px",
                padding: "20px",
              }}>
                <h4 style={{ margin: "0 0 12px 0", fontSize: "16px", fontWeight: 600, color: C.accentLight }}>
                  {item.q}
                </h4>
                <p style={{ margin: 0, fontSize: "14px", color: C.muted, lineHeight: 1.6 }}>
                  {item.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section style={{
        background: `linear-gradient(135deg, ${C.surfaceHigh}, ${C.surface})`,
        borderTop: `1px solid ${C.border}`,
        padding: "60px 20px",
        textAlign: "center",
      }}>
        <div style={{ maxWidth: "600px", margin: "0 auto" }}>
          <h2 style={{ fontSize: "32px", fontWeight: 700, marginBottom: "16px" }}>
            Prêt à lancer votre étude ?
          </h2>
          <p style={{ fontSize: "16px", color: C.muted, marginBottom: "32px", lineHeight: 1.6 }}>
            Publiez votre étude sur StudyReach et laissez-nous gérer le recrutement, la planification et les paiements.
          </p>
          <a href="/" style={{
            display: "inline-block",
            padding: "16px 40px",
            background: C.green,
            color: C.white,
            textDecoration: "none",
            borderRadius: "8px",
            fontWeight: 600,
            fontSize: "16px",
            fontFamily: FONT,
            transition: "all 0.2s",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => { e.target.style.transform = "translateY(-2px)"; e.target.style.opacity = "0.9"; }}
          onMouseLeave={(e) => { e.target.style.transform = "translateY(0)"; e.target.style.opacity = "1"; }}
          >
            Créer une étude →
          </a>
        </div>
      </section>
    </div>
  );
};

export default CompensationCalculator;
