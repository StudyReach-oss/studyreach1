// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  CONTENU DES PAGES PUBLIQUES — source unique
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Fichier JS "pur" (pas de JSX) utilisé à deux endroits :
//  1. App.jsx (l'app React normale, pour l'affichage aux visiteurs)
//  2. scripts/prerender.mjs (génère une version HTML statique de chaque
//     page publique après le build, lisible par les robots qui n'exécutent
//     pas JavaScript — GPTBot, ClaudeBot, PerplexityBot, etc.)
// En modifiant un texte ici, il change automatiquement aux deux endroits —
// pas besoin de le modifier deux fois.

export const PAGE_META = {
  "blog":{title:"Blog — Comment recruter des participants pour une étude en France | StudyReach",description:"Guide complet pour recruter des participants qualifiés à une étude : méthodes classiques, leurs limites, et alternatives — recherche académique, UX, consommation."},
  "faq":{title:"FAQ — StudyReach",description:"Questions fréquentes sur StudyReach : tarifs, recrutement de participants, paiement, sécurité."},
  "pricing":{title:"Tarifs — StudyReach",description:"Découvrez les tarifs StudyReach pour recruter des participants rémunérés à vos études."},
  "how-it-works":{title:"Comment ça marche — StudyReach",description:"Comment StudyReach connecte chercheurs et participants rémunérés pour vos études, étape par étape."},
  "for-participants":{title:"Devenir participant rémunéré — StudyReach",description:"Participez à des études rémunérées en France via StudyReach : inscription, critères, paiement."},
  "status":{title:"Status de la plateforme — StudyReach",description:"Surveillance en temps réel des services StudyReach."},
};

export const INFO_PAGES={
  "how-it-works":{
    title:"Comment ça marche ?",
    subtitle:"De la publication à l’entretien en 3 étapes simples.",
    sections:[
      {icon:"📋",title:"1. Publiez votre étude",body:"Créez votre étude en quelques minutes : choisissez le thème, la durée, le mode d’entretien (lien personnel ou IA), et publiez. Votre étude est immédiatement visible par notre base de participants qualifiés."},
      {icon:"👥",title:"2. Les participants postulent",body:"Notre algorithme notifie automatiquement les participants correspondant à votre profil cible. Ils s’inscrivent à votre étude en un clic. Vous pouvez suivre les inscriptions en temps réel depuis votre tableau de bord."},
      {icon:"💸",title:"3. Menez l’entretien et payez",body:"Une fois l’entretien terminé, validez la participation depuis votre tableau de bord. Le participant est alors crédité de sa rémunération, qu’il pourra retirer après avoir renseigné ses informations de paiement."},
      {icon:"🤖",title:"Entretiens IA (option)",body:"Activez le mode IA pour laisser notre intelligence artificielle conduire l’entretien à votre place. Elle pose vos questions, gère les relances, et vous livre un rapport synthétique complet avec verbatims."},
      {icon:"💳",title:"Budget et portefeuille",body:"À la publication, le budget total de votre étude (nombre de participants × tarif) est bloqué sur votre portefeuille. Si vous fermez l’étude avant d’avoir atteint le nombre de participants visé, le solde correspondant aux places non utilisées vous est automatiquement recrédité."},
    ]
  },
  "pricing":{
    title:"Tarifs",
    subtitle:"Simple, transparent, sans abonnement. Vous ne payez qu’à la publication.",
    sections:[
      {icon:"⏱",title:"7 durées, de 10€ à 50€ / participant",body:"5 min — 10€ · 10 min — 20€ · 20 min — 30€ (le plus populaire) · 30 min — 35€ · 40 min — 40€ · 50 min — 45€ · 60 min — 50€. Vous choisissez la durée à la création de l’étude ; le tarif s’applique par participant."},
      {icon:"💸",title:"Le participant reçoit 90%",body:"StudyReach prélève 10% de frais de service. Le participant est donc rémunéré de 9€ (5 min) à 45€ (60 min) net, versé sur son compte bancaire après validation."},
      {icon:"🤖",title:"Option Entretiens IA — +10€ / participant",body:"Activez l'IA pour conduire les entretiens automatiquement. Vous définissez le guide de questions, l'IA gère tout le reste et vous livre un rapport complet. Disponible pour tous les formats."},
      {icon:"↩️",title:"Vous ne payez que pour les entretiens réalisés",body:"Le budget de votre étude est bloqué à la publication, mais si vous la fermez avant d’avoir atteint le nombre de participants visé, le solde non utilisé est automatiquement recrédité sur votre portefeuille."},
    ]
  },
  "for-participants":{
    title:"Pour les participants",
    subtitle:"Donnez votre avis sur de vrais produits et soyez payé automatiquement.",
    sections:[
      {icon:"💸",title:"Soyez rémunéré de 9€ à 45€",body:"Chaque entretien auquel vous participez est rémunéré net selon sa durée : de 9€ (5 min) à 45€ (60 min). Après validation, le montant est crédité sur votre solde StudyReach ; vous le retirez quand vous le souhaitez, et il arrive sur votre compte bancaire sous 24-72h après le retrait."},
      {icon:"⏰",title:"À votre rythme, 100% en ligne",body:"Les études durent entre 5 et 60 minutes et se font entièrement en ligne. Vous choisissez les études qui vous intéressent et participez quand vous le souhaitez, depuis chez vous."},
      {icon:"🎯",title:"Études adaptées à votre profil",body:"Créez votre profil participant (profession, âge, région, centres d’intérêt) et recevez uniquement des études qui correspondent à votre profil. Plus votre profil est complet, plus vous recevez d’opportunités."},
      {icon:"🔒",title:"Données protégées",body:"Vos données personnelles sont protégées conformément au RGPD. Seuls les chercheurs dont vous acceptez l’étude ont accès à vos réponses."},
    ]
  },
  "blog":{
    title:"Blog StudyReach",
    subtitle:"Conseils, méthodes et inspirations pour mener de meilleures études qualitatives.",
    sections:[
      {icon:"🎯",title:"Comment recruter des participants pour une étude en France",body:"Recruter des participants qualifiés reste l'un des points de friction les plus fréquents, que l'on soit chercheur en laboratoire, en école doctorale, ou responsable d'études côté entreprise (insights, marketing, UX) pour tester un produit, une marque ou un concept — food, mode, sport, cosmétique, ou tout autre secteur de consommation. Entre les mails de relance sans réponse, les publications sur les groupes internes, et les créneaux à recaser à la main, le recrutement peut facilement absorber plus de temps que l'étude elle-même."},
      {icon:"🔍",title:"Les méthodes classiques et leurs limites",body:"Le bouche-à-oreille et les mailing lists internes sont rapides mais donnent un vivier limité et biaisé. Les posts sur les réseaux communautaires touchent surtout un public étudiant local, peu adapté dès qu'on cherche un profil précis. Les panels professionnels existent mais sont souvent tarifés pour des études de marché à l'anglo-saxonne, avec un vivier majoritairement international. Les incitations non-monétaires (cadeaux, tirages au sort) fonctionnent, mais tiennent moins bien les délais qu'une rémunération directe et transparente."},
      {icon:"⏱️",title:"Ce qui coûte réellement du temps",body:"Au-delà de trouver des participants, la charge de travail se situe surtout dans les relances répétées pour confirmer une disponibilité, la gestion des no-show et annulations de dernière minute, le suivi des paiements ou dédommagements, et la vérification que chaque profil correspond bien aux critères de l'étude."},
      {icon:"🚀",title:"Une alternative : les marketplaces dédiées à la recherche",body:"Des plateformes comme StudyReach connectent chercheurs et équipes études (UX, psychologie, sciences du langage, neurosciences, IA, marketing, consommation...) avec des participants rémunérés, recrutés selon des critères précis. Le principe : vous publiez votre étude avec vos critères de recrutement, la plateforme propose des participants qualifiés et gère la logistique (rappels, paiement, suivi des no-show) — pour se concentrer sur la conduite de l'étude plutôt que sur la chasse aux participants. Pertinent pour les chercheurs en laboratoire ou en thèse, les équipes UX/produit, et les équipes insights/marketing en entreprise (food, mode, sport, cosmétique, boissons...) qui testent un produit ou un concept auprès d'un panel de consommateurs."},
    ]
  },
  "status":{
    title:"Status de la plateforme",
    subtitle:"Surveillance en temps réel des services StudyReach.",
    sections:[
      {icon:"🟢",title:"API Authentification — Opérationnel",body:"Inscription, connexion et gestion des sessions fonctionnent normalement. Aucun incident signalé."},
      {icon:"🟢",title:"Base de données — Opérationnel",body:"Lecture et écriture des données (profils, études, transactions) fonctionnent normalement."},
      {icon:"🟢",title:"Paiements Stripe — Opérationnel",body:"Les virements bancaires vers les participants sont traités normalement sous 24-72h après la demande de retrait."},
      {icon:"🟢",title:"Interface web — Opérationnel",body:"L’application est accessible et fonctionne normalement sur tous les appareils."},
    ]
  },
  "faq":{
    title:"FAQ",
    subtitle:"Les réponses aux questions les plus fréquentes.",
    sections:[
      {icon:"💰",title:"Comment sont calculés les paiements ?",body:"Les chercheurs paient un tarif fixe par participant, selon la durée de l’entretien. StudyReach prélève 10% de frais de service. Le participant reçoit donc 90% du montant : crédité sur son solde après validation de l’entretien, puis versé sur son compte bancaire sous 24-72h une fois le retrait demandé."},
      {icon:"📋",title:"Comment créer une étude ?",body:"Connectez-vous à votre espace chercheur, cliquez sur « Nouvelle étude », choisissez le thème, la durée et le type d’étude, rechargez votre portefeuille et publiez. Votre étude est immédiatement visible par les participants."},
      {icon:"↩️",title:"Que se passe-t-il si je ferme une étude avant la fin ?",body:"Les participants déjà interviewés sont rémunérés normalement. Le solde correspondant aux places non utilisées (budget bloqué moins entretiens réalisés) est automatiquement recrédité sur votre portefeuille."},
      {icon:"👥",title:"Comment sont sélectionnés les participants ?",body:"Quand vous publiez une étude, vous définissez votre cible : critères de profil (profession, âge, centres d’intérêt…) et zone géographique. StudyReach notifie alors automatiquement les participants qui correspondent à ces critères. Ceux que l’étude intéresse répondent à vos questions de présélection : seuls les profils qui remplissent vos conditions peuvent rejoindre l’étude."},
      {icon:"🤖",title:"Comment fonctionne le mode IA ?",body:"En activant le mode IA (+10€ par participant), notre intelligence artificielle conduit l'entretien à votre place selon vos critères. Elle gère les relances et vous livre un rapport complet avec verbatims après chaque entretien."},
      {icon:"🔒",title:"Mes données sont-elles sécurisées ?",body:"Oui. StudyReach est conforme au RGPD. Vos données sont hébergées en Europe et ne sont jamais revendues à des tiers. Les entretiens sont accessibles uniquement aux parties concernées."},
      {icon:"✉️",title:"Je n’ai pas trouvé ma réponse, que faire ?",body:"Contactez-nous directement à contact@getstudyreach.com. Nous répondons généralement sous 48h ouvrées."},
    ]
  },
};

export const LEGAL_PAGES={
  terms:{title:"Conditions Générales d'Utilisation",sections:[{t:"1. Objet",c:"Les présentes CGU régissent l'utilisation de la plateforme StudyReach, accessible depuis www.getstudyreach.com. En créant un compte, vous acceptez sans réserve les présentes conditions."},{t:"2. Inscription",c:"L'inscription est gratuite. Vous devez fournir des informations exactes. Vous êtes responsable de la confidentialité de vos identifiants."},{t:"3. Services",c:"StudyReach permet à des chercheurs de recruter des participants pour des études qualitatives. Les chercheurs paient par participant recruté. Les participants reçoivent une rémunération par virement bancaire."},{t:"4. Tarification",c:"Les tarifs varient selon la durée de l’entretien, de 10€ (5 min) à 50€ (60 min) par participant. Une option entretiens IA est disponible pour +10€ par participant. StudyReach prélève 10% de frais de service sur la rémunération de chaque participant. Le client paie un prix fixe, les participants reçoivent 90% de ce montant. Ces tarifs peuvent évoluer."},{t:"5. Paiements",c:"Les paiements des chercheurs sont effectués par carte bancaire. Les paiements aux participants sont effectués par virement bancaire (Stripe) dans un délai de 24 à 72h après la demande de retrait."},{t:"6. Résiliation",c:"Vous pouvez supprimer votre compte à tout moment depuis vos paramètres. StudyReach se réserve le droit de suspendre tout compte en cas de non-respect des présentes CGU."}]},
  privacy:{title:"Politique de Confidentialité",sections:[{t:"1. Responsable de traitement",c:"Le responsable de traitement est Samira Koibich, auto-entrepreneur (SIRET : 106 697 063 00019), 5 rue Adalbert Simond, 78970 Mézières-sur-Seine, France. Contact : contact@getstudyreach.com."},{t:"2. Sous-traitants",c:"StudyReach fait appel aux sous-traitants suivants : Supabase (hébergement base de données, région EU — Irlande), Stripe (traitement des paiements, certifié PCI-DSS), Resend (envoi d'emails transactionnels). Ces prestataires sont soumis à des obligations strictes de confidentialité et de sécurité."},{t:"3. Données collectées",c:"Nous collectons : nom, prénom, adresse e-mail, profession, coordonnées bancaires (participants), données de paiement (chercheurs), et données d'utilisation anonymisées."},{t:"4. Utilisation",c:"Ces données sont utilisées pour fournir le service, effectuer les paiements, améliorer la plateforme et, avec votre consentement, vous envoyer des communications."},{t:"5. RGPD",c:"Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, d'effacement, de portabilité et d'opposition. Exercez vos droits via votre espace paramètres ou à contact@getstudyreach.com."},{t:"6. Conservation",c:"Vos données sont conservées pendant la durée de votre compte + 3 ans (obligations légales). Les données de paiement sont conservées 10 ans."},{t:"7. Sécurité",c:"Nous utilisons le chiffrement SSL, le hachage des mots de passe et des audits de sécurité réguliers pour protéger vos données."}]},
  legal:{title:"Mentions Légales",sections:[{t:"Éditeur du site",c:"Le site StudyReach est édité par Samira Koibich, entrepreneur individuel (micro-entreprise) exerçant sous le nom commercial StudyReach. SIREN : 106 697 063. SIRET (siège) : 106 697 063 00019. Code APE : 8299Z. Siège : 5 rue Adalbert Simond, 78970 Mézières-sur-Seine, France. TVA non applicable, art. 293 B du CGI (franchise en base de TVA). Directeur de la publication : Valentin Coupeaud."},{t:"Contact",c:"Email : contact@getstudyreach.com"},{t:"Hébergement",c:"Le site est hébergé par Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis. La base de données et les services backend sont hébergés par Supabase, au sein de l'Union européenne (région eu-west-1, Irlande)."},{t:"Propriété intellectuelle",c:"L'ensemble des contenus présents sur le site StudyReach (textes, graphismes, logo, icônes, structure) est protégé par les lois françaises et internationales relatives à la propriété intellectuelle. Toute reproduction, représentation ou diffusion, en tout ou partie, est interdite sans autorisation écrite préalable."},{t:"Données personnelles",c:"Conformément à la loi Informatique et Libertés du 6 janvier 1978 modifiée et au Règlement Général sur la Protection des Données (RGPD), vous disposez d'un droit d'accès, de rectification et de suppression de vos données. Pour exercer ce droit, contactez-nous à : contact@getstudyreach.com."},{t:"Cookies",c:"Le site StudyReach utilise des cookies techniques nécessaires à son fonctionnement. Aucun cookie publicitaire ou de tracking tiers n'est utilisé sans votre consentement explicite."},{t:"Litiges",c:"En cas de litige, une solution amiable sera recherchée avant toute action judiciaire. À défaut, les tribunaux du ressort du siège de l'éditeur seront seuls compétents. Le droit français est applicable."}]},
};
