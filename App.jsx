import { useState, useEffect, useRef } from "react";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  DESIGN TOKENS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const C = {
  bg:"#07080e", surface:"#0e1120", surfaceHigh:"#141829", border:"#1c2035",
  accent:"#5b7cfa", accentGlow:"rgba(91,124,250,0.15)", accentLight:"#8fa4ff",
  green:"#1ec98a", greenGlow:"rgba(30,201,138,0.13)",
  red:"#f0556a", yellow:"#f5c542", orange:"#f87c3a",
  text:"#dce2f5", muted:"#606880", dimmed:"#3a4060",
  white:"#fff",
};
const FONT = "'Plus Jakarta Sans', 'DM Sans', sans-serif";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  MOCK DATA
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const THEMES=[{id:"ux",l:"UX / Design produit",i:"🎨"},{id:"mkt",l:"Marketing & Branding",i:"📣"},{id:"csr",l:"Comportement consommateur",i:"🛒"},{id:"hlth",l:"Santé & Bien-être",i:"🏥"},{id:"fin",l:"Finance & Banque",i:"💳"},{id:"tech",l:"Tech & Innovation",i:"🤖"},{id:"edu",l:"Éducation & Formation",i:"📚"},{id:"other",l:"Autre",i:"✨"}];
const DURATIONS=[{id:"10",l:"10 min",price:20,desc:"Retour express ciblé"},{id:"20",l:"20 min",price:30,desc:"Format standard approfondi",popular:true},{id:"45",l:"45 min",price:40,desc:"Exploration en profondeur"}];
const PROFESSIONS=["Designer","Développeur","Étudiant","Manager","Infirmier·ère","Enseignant·e","Commerçant·e","Retraité·e","Autre"];

const INIT_R_STUDIES=[];
const INIT_P_STUDIES=[];
const INIT_MESSAGES=[
];
const INIT_NOTIFS_R=[];
const INIT_NOTIFS_P=[];
const ADMIN_STATS={users:0,researchers:0,participants:0,studies:0,revenue:0,pending:0};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  SHARED UI PRIMITIVES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const Tag=({color=C.accent,children,style:s})=>(
  <span style={{background:color+"22",color,fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:20,letterSpacing:.4,textTransform:"uppercase",...s}}>{children}</span>
);
const Badge=({n,color=C.red})=>n>0?(<span style={{background:color,color:"#fff",fontSize:10,fontWeight:900,padding:"1px 6px",borderRadius:10,minWidth:16,display:"inline-block",textAlign:"center"}}>{n}</span>):null;
const Card=({children,style:s,onClick})=>(
  <div onClick={onClick} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,...s,cursor:onClick?"pointer":undefined}}>{children}</div>
);
const Btn=({children,onClick,secondary,small,ghost,disabled,danger,green,full,style:s})=>(
  <button onClick={onClick} disabled={disabled} style={{
    background:danger?C.red:green?C.green:secondary||ghost?"transparent":C.accent,
    color:ghost?C.muted:secondary?C.text:"#fff",
    border:secondary?`1px solid ${C.border}`:ghost?"none":"none",
    borderRadius:10,padding:small?"7px 16px":"11px 22px",
    fontSize:small?13:14,fontWeight:700,cursor:disabled?"not-allowed":"pointer",
    opacity:disabled?.45:1,width:full?"100%":undefined,
    transition:"all .15s",...s,
  }}>{children}</button>
);
const Inp=({label,hint,style:s,...p})=>(
  <div style={{marginBottom:14,...s}}>
    {label&&<label style={{display:"block",fontSize:12,fontWeight:600,color:C.muted,marginBottom:5,letterSpacing:.4}}>{label}</label>}
    <input {...p} style={{width:"100%",padding:"10px 13px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:9,color:C.text,fontSize:14,outline:"none",boxSizing:"border-box"}}/>
    {hint&&<p style={{fontSize:11,color:C.muted,marginTop:4}}>{hint}</p>}
  </div>
);
const Sel=({label,options,value,onChange})=>(
  <div style={{marginBottom:14}}>
    {label&&<label style={{display:"block",fontSize:12,fontWeight:600,color:C.muted,marginBottom:5,letterSpacing:.4}}>{label}</label>}
    <select value={value} onChange={onChange} style={{width:"100%",padding:"10px 13px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:9,color:C.text,fontSize:14,outline:"none",boxSizing:"border-box"}}>
      <option value="">Sélectionner…</option>
      {options.map(o=><option key={o} value={o}>{o}</option>)}
    </select>
  </div>
);
const Modal=({children,onClose,title,wide})=>(
  <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:16}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
    <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:20,padding:"28px 28px",width:"100%",maxWidth:wide?680:480,maxHeight:"92vh",overflowY:"auto",position:"relative"}}>
      <button onClick={onClose} style={{position:"absolute",top:14,right:14,background:"none",border:"none",color:C.muted,fontSize:20,cursor:"pointer",lineHeight:1}}>✕</button>
      {title&&<h2 style={{fontSize:20,fontWeight:800,marginBottom:18}}>{title}</h2>}
      {children}
    </div>
  </div>
);
const Divider=({style:s})=>(<div style={{height:1,background:C.border,margin:"18px 0",...s}}/>);
const Avatar=({initials,color=C.accent,size=34})=>(<div style={{width:size,height:size,borderRadius:"50%",background:color+"22",border:`1.5px solid ${color}44`,color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*.32,fontWeight:800,flexShrink:0}}>{initials}</div>);
function Logo({small}){return(<div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:small?16:20,color:C.accent}}>◆</span><span style={{fontSize:small?16:18,fontWeight:900,letterSpacing:"-0.5px"}}>StudyReach</span></div>);}
function ProgressBar({value,max,color=C.accent}){const pct=Math.min(100,Math.round((value/max)*100));return(<div style={{height:6,background:C.border,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:color,borderRadius:3,transition:"width .4s"}}/></div>);}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  LANDING PAGE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function Landing({onNav}){
  const [faq,setFaq]=useState(null);
  const faqs=[
    {q:"Comment fonctionne le recrutement ?",a:"Vous publiez votre étude avec vos critères (thème, durée). Notre algorithme de matching notifie les participants correspondant à votre profil cible. Vous pouvez recevoir vos premiers participants sous 48h."},
    {q:"Comment sont rémunérés les participants ?",a:"À la validation de chaque entretien, le paiement est automatiquement envoyé sur le compte PayPal que le participant a renseigné lors de son inscription. Le délai de versement est de 24 à 48h."},
    {q:"Qu'est-ce que les entretiens IA ?",a:"Notre IA conduit l'entretien à votre place selon un guide de questions que vous définissez. Elle gère les relances, adapte les questions et vous livre un rapport synthétique avec les verbatims complets."},
    {q:"Puis-je annuler une étude en cours ?",a:"Oui, vous pouvez suspendre ou annuler une étude à tout moment depuis votre tableau de bord. Les participants déjà interviewés sont rémunérés, et le solde restant est recrédité sur votre portefeuille."},
    {q:"Quelles données personnelles sont collectées ?",a:"Nous collectons uniquement les données nécessaires au bon fonctionnement du service. Conformément au RGPD, vous pouvez demander la suppression de vos données à tout moment depuis vos paramètres."},
  ];
  return(
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column"}}>
      {/* Nav */}
      <header style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"18px 56px",borderBottom:`1px solid ${C.border}`,position:"sticky",top:0,background:C.bg+"ee",backdropFilter:"blur(12px)",zIndex:50}}>
        <Logo/>
        <nav style={{display:"flex",gap:28,alignItems:"center"}}>
        </nav>
        <div style={{display:"flex",gap:10}}>
          <Btn secondary small onClick={()=>onNav("login-researcher")}>Connexion</Btn>
          <Btn small onClick={()=>onNav("signup-researcher")}>S'inscrire</Btn>
        </div>
      </header>

      {/* Hero */}
      <section style={{textAlign:"center",padding:"80px 24px 60px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:600,height:600,background:`radial-gradient(circle, ${C.accent}14 0%, transparent 70%)`,pointerEvents:"none"}}/>
        <div style={{display:"inline-block",background:C.accentGlow,color:C.accentLight,fontSize:12,fontWeight:700,letterSpacing:1.2,textTransform:"uppercase",padding:"5px 16px",borderRadius:20,marginBottom:22,border:`1px solid ${C.accent}33`}}>
          Plateforme de recherche qualitative
        </div>
        <h1 style={{fontSize:62,fontWeight:900,letterSpacing:"-2.5px",lineHeight:1.08,marginBottom:20,maxWidth:760,margin:"0 auto 20px"}}>
          Recrutez des participants.<br/><span style={{color:C.accentLight}}>Menez vos études.</span><br/>Payez simplement.
        </h1>
        <p style={{color:C.muted,fontSize:18,maxWidth:520,lineHeight:1.7,margin:"0 auto 44px"}}>
          Connectez chercheurs et participants pour des entretiens qualitatifs, tests UX et questionnaires rémunérés.
        </p>
        <div style={{display:"flex",gap:14,justifyContent:"center",flexWrap:"wrap"}}>
          <Btn onClick={()=>onNav("signup-researcher")} style={{padding:"13px 28px",fontSize:15}}>Je recrute des participants →</Btn>
          <Btn secondary onClick={()=>onNav("signup-participant")} style={{padding:"13px 28px",fontSize:15}}>Je veux participer →</Btn>
        </div>
        <div style={{display:"flex",gap:40,justifyContent:"center",marginTop:52,flexWrap:"wrap"}}>
          {[["2 400+","Participants actifs"],["98%","Taux de satisfaction"],["48h","Délai moyen"],["312","Études publiées"]].map(([v,l])=>(
            <div key={l} style={{textAlign:"center"}}>
              <div style={{fontSize:26,fontWeight:900,color:C.text}}>{v}</div>
              <div style={{fontSize:13,color:C.muted,marginTop:2}}>{l}</div>
            </div>
          ))}
        </div>
      </section>



      {/* For participants */}
      <section style={{padding:"60px 56px",borderTop:`1px solid ${C.border}`,background:C.surface}}>
        <div style={{maxWidth:900,margin:"0 auto",display:"grid",gridTemplateColumns:"1fr 1fr",gap:48,alignItems:"center"}}>
          <div>
            <Tag color={C.green} style={{marginBottom:16}}>Pour les participants</Tag>
            <h2 style={{fontSize:32,fontWeight:900,marginBottom:14,letterSpacing:"-1px"}}>Donnez votre avis.<br/><span style={{color:C.green}}>Soyez payé.</span></h2>
            <p style={{color:C.muted,lineHeight:1.7,marginBottom:24}}>Rejoignez des milliers de participants qui donnent leur avis sur des produits et services réels. Chaque participation est rémunérée automatiquement sous 48h.</p>
            <ul style={{listStyle:"none",display:"flex",flexDirection:"column",gap:10,marginBottom:28}}>
              {["20€ à 40€ par entretien","Paiement automatique sous 48h","Études de 10 à 45 minutes","100% en ligne, à votre rythme"].map(i=>(
                <li key={i} style={{display:"flex",gap:10,alignItems:"center",fontSize:14,color:C.muted}}><span style={{color:C.green,fontWeight:700}}>✓</span>{i}</li>
              ))}
            </ul>
            <Btn green onClick={()=>onNav("signup-participant")}>Créer mon profil participant →</Btn>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{padding:"60px 56px",borderTop:`1px solid ${C.border}`,textAlign:"center"}}>
        <h2 style={{fontSize:34,fontWeight:900,marginBottom:12,letterSpacing:"-1px"}}>Prêt à lancer votre première étude ?</h2>
        <p style={{color:C.muted,marginBottom:28,fontSize:16}}>Créez votre compte gratuitement. Vous ne payez qu'à la publication.</p>
        <Btn onClick={()=>onNav("signup-researcher")} style={{padding:"14px 32px",fontSize:16}}>Commencer maintenant →</Btn>
      </section>

      {/* Footer */}
      <footer style={{borderTop:`1px solid ${C.border}`,padding:"32px 56px",display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:20}}>
        <div>
          <Logo small/>
          <p style={{color:C.muted,fontSize:13,marginTop:8,maxWidth:240}}>La plateforme de recherche utilisateur qui connecte chercheurs et participants.</p>
        </div>
        <div style={{display:"flex",gap:48,flexWrap:"wrap"}}>
          {[
            {title:"Produit",links:["Comment ça marche","Tarifs","Pour les participants","Blog"]},
            {title:"Légal",links:["CGU","Politique de confidentialité","Mentions légales","RGPD"]},
            {title:"Support",links:["Centre d'aide","Contact","Status","API"]},
          ].map(col=>(
            <div key={col.title}>
              <div style={{fontSize:12,fontWeight:700,color:C.muted,marginBottom:12,letterSpacing:.8,textTransform:"uppercase"}}>{col.title}</div>
              {col.links.map(l=>(<div key={l} style={{fontSize:13,color:C.dimmed,marginBottom:8,cursor:"pointer"}}>{l}</div>))}
            </div>
          ))}
        </div>
      </footer>
      <div style={{textAlign:"center",padding:"12px 0",fontSize:12,color:C.dimmed,borderTop:`1px solid ${C.border}`}}>© 2026 StudyReach · Tous droits réservés · Fait avec ♥ en France</div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  AUTH
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function AuthPage({type,onDone,onNav}){
  const isLogin=type.startsWith("login");
  const isPart=type.includes("participant");
  const [f,setF]=useState({first:"",last:"",email:"",pass:"",paypal:"",prof:"",company:"",agree:false});
  const [err,setErr]=useState("");
  const accent=isPart?C.green:C.accent;

  const [loading,setLoading]=useState(false);
  const SUPA_URL="https://bwaoxwfkqqpqvtpynwzh.supabase.co";
  const SUPA_KEY="sb_publishable_SsnkELg6dLx--AjHaW0ShA_N1ISmMKg";

  const submit=async()=>{
    if(!f.email||!f.pass){setErr("Veuillez remplir tous les champs obligatoires.");return;}
    if(!isLogin&&!isPart&&!f.company){setErr("Veuillez indiquer votre entreprise.");return;}
    if(!isLogin&&isPart&&!f.paypal){setErr("Veuillez renseigner votre adresse PayPal.");return;}
    if(!isLogin&&!f.agree){setErr("Veuillez accepter les CGU.");return;}
    setLoading(true);setErr("");
    try{
      if(isLogin){
        const res=await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`,{
          method:"POST",
          headers:{"apikey":SUPA_KEY,"Content-Type":"application/json"},
          body:JSON.stringify({email:f.email,password:f.pass}),
        });
        const data=await res.json();
        if(data.error||!data.access_token)throw new Error("Email ou mot de passe incorrect");
        let role="researcher";
        try{
          const profileRes=await fetch(`${SUPA_URL}/rest/v1/profiles?id=eq.${data.user?.id}`,{
            headers:{"apikey":SUPA_KEY,"Authorization":`Bearer ${data.access_token}`},
          });
          const profiles=await profileRes.json();
          role=profiles?.[0]?.role||"researcher";
        }catch(e){role="researcher";}
        onDone(role);
      } else {
        const res=await fetch(`${SUPA_URL}/auth/v1/signup`,{
          method:"POST",
          headers:{"apikey":SUPA_KEY,"Content-Type":"application/json"},
          body:JSON.stringify({email:f.email,password:f.pass}),
        });
        const data=await res.json();
        if(data.error)throw new Error(data.error.message||"Erreur d'inscription");
        await fetch(`${SUPA_URL}/rest/v1/profiles`,{
          method:"POST",
          headers:{"apikey":SUPA_KEY,"Authorization":`Bearer ${data.access_token}`,"Content-Type":"application/json","Prefer":"return=representation"},
          body:JSON.stringify({id:data.user?.id,email:f.email,first_name:f.first,last_name:f.last,role:isPart?"participant":"researcher",paypal_email:f.paypal||null,profession:f.prof||null,company:f.company||null,wallet:0}),
        });
        onDone(isPart?"participant":"researcher");
      }
    }catch(e){
      setErr(e.message||"Erreur. Veuillez réessayer.");
    }
    setLoading(false);
  };

  return(
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column"}}>
      <header style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"18px 48px",borderBottom:`1px solid ${C.border}`}}>
        <Logo/><Btn secondary small onClick={()=>onNav("landing")}>← Accueil</Btn>
      </header>
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
        <Card style={{width:"100%",maxWidth:460,padding:"36px 36px"}}>
          <Tag color={accent} style={{marginBottom:12}}>{isPart?"Participant":"Chercheur"}</Tag>
          <h2 style={{fontSize:24,fontWeight:800,marginTop:8,marginBottom:4}}>{isLogin?"Connexion":"Créer un compte"}</h2>
          <p style={{color:C.muted,fontSize:13,marginBottom:22}}>{isLogin?"Bon retour 👋":isPart?"Rejoignez des milliers de participants rémunérés.":"Recrutez des participants qualifiés pour vos études."}</p>
          {!isLogin&&(<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><Inp label="Prénom *" placeholder="Marie" value={f.first} onChange={e=>setF({...f,first:e.target.value})}/><Inp label="Nom *" placeholder="Dupont" value={f.last} onChange={e=>setF({...f,last:e.target.value})}/></div>)}
          <Inp label="E-mail *" type="email" placeholder="marie@exemple.com" value={f.email} onChange={e=>setF({...f,email:e.target.value})}/>
          <Inp label="Mot de passe *" type="password" placeholder="••••••••" value={f.pass} onChange={e=>setF({...f,pass:e.target.value})}/>
          {!isLogin&&!isPart&&<Inp label="Entreprise / Organisation *" placeholder="DesignLab Studio" value={f.company} onChange={e=>setF({...f,company:e.target.value})}/>}
          {!isLogin&&isPart&&(<>
            <Sel label="Profession" options={PROFESSIONS} value={f.prof} onChange={e=>setF({...f,prof:e.target.value})}/>
            <Inp label="Adresse PayPal *" type="email" placeholder="paypal@exemple.com" value={f.paypal} onChange={e=>setF({...f,paypal:e.target.value})} hint="💸 Vos revenus seront virés automatiquement sur ce compte PayPal sous 24-48h."/>
          </>)}
          {!isLogin&&(
            <label style={{display:"flex",gap:8,alignItems:"flex-start",fontSize:13,color:C.muted,marginBottom:14,cursor:"pointer"}}>
              <input type="checkbox" checked={f.agree} onChange={e=>setF({...f,agree:e.target.checked})} style={{marginTop:2}}/>
              J'accepte les <span style={{color:accent,cursor:"pointer"}} onClick={()=>onNav("terms")}>CGU</span> et la <span style={{color:accent,cursor:"pointer"}} onClick={()=>onNav("privacy")}>politique de confidentialité</span>
            </label>
          )}
          {err&&<div style={{background:C.red+"22",border:`1px solid ${C.red}44`,borderRadius:8,padding:"10px 12px",fontSize:13,color:C.red,marginBottom:12}}>{err}</div>}
          <Btn full style={{background:accent}} onClick={submit} disabled={loading}>{loading?"Chargement...":(isLogin?"Se connecter →":"Créer mon compte →")}</Btn>
          {isLogin&&<div style={{textAlign:"center",marginTop:10}}><span style={{fontSize:13,color:accent,cursor:"pointer"}}>Mot de passe oublié ?</span></div>}
          <Divider/>
          <p style={{textAlign:"center",fontSize:13,color:C.muted}}>
            {isLogin?"Pas encore de compte ? ":"Déjà inscrit ? "}
            <span style={{color:accent,cursor:"pointer",fontWeight:600}} onClick={()=>onNav((isLogin?"signup-":"login-")+(isPart?"participant":"researcher"))}>
              {isLogin?"S'inscrire":"Se connecter"}
            </span>
          </p>
          {!isPart&&<p style={{textAlign:"center",fontSize:12,color:C.muted,marginTop:8}}>Vous êtes participant ? <span style={{color:C.green,cursor:"pointer"}} onClick={()=>onNav(isLogin?"login-participant":"signup-participant")}>{isLogin?"Connexion":"Inscription"} participant →</span></p>}
        </Card>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  RESEARCHER DASHBOARD
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function ResearcherDashboard({onLogout}){
  const [tab,setTab]=useState("overview");
  const [studies,setStudies]=useState(INIT_R_STUDIES);
  const [wallet,setWallet]=useState(0);
  const [notifs,setNotifs]=useState(INIT_NOTIFS_R);
  const [msgs,setMsgs]=useState([
  ]);
  const [showStudyModal,setShowStudyModal]=useState(false);
  const [showWalletModal,setShowWalletModal]=useState(false);
  const [showNotifs,setShowNotifs]=useState(false);
  const [activeMsg,setActiveMsg]=useState(null);
  const [newMsg,setNewMsg]=useState("");
  const [nsStep,setNsStep]=useState(0);
  const [ns,setNs]=useState({title:"",theme:"",dur:"",mode:"",link:"",ai:false,description:""});
  const [recharge,setRecharge]=useState({amt:"",done:false});
  const [invoices]=useState([]);
  const [showStudyDetail,setShowStudyDetail]=useState(null);

  // Handle PayPal redirect back
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const payment=params.get("payment");
    const amount=params.get("amount");
    if(payment==="success"&&amount){
      setWallet(prev=>prev+parseFloat(amount));
      setRecharge({amt:amount,done:true});
      setShowWalletModal(true);
      window.history.replaceState({},"","/");
    }
  },[]);

  const unread=notifs.filter(n=>!n.read).length;
  const unreadMsg=msgs.reduce((a,m)=>a+m.unread,0);
  const selDur=DURATIONS.find(d=>d.id===ns.dur);
  const studyCost=selDur?selDur.price+(ns.ai?10:0):0;
  const studyFee=Math.round(studyCost*0.10*100)/100;
  const participantPay=Math.round((studyCost-studyFee)*100)/100;

  const sendMsg=()=>{if(!newMsg.trim())return;setMsgs(prev=>prev.map(m=>m.id===activeMsg?{...m,messages:[...m.messages,{from:"Vous",text:newMsg,time:"maintenant",mine:true}]}:m));setNewMsg("");};
  const publishStudy=()=>{
    const t=THEMES.find(x=>x.id===ns.theme),d=DURATIONS.find(x=>x.id===ns.dur);
    if(wallet<studyCost){
      setNsErr(`Solde insuffisant (${wallet.toFixed(2)}€). Rechargez votre portefeuille avant de publier.`);
      return;
    }
    setStudies(prev=>[...prev,{id:Date.now(),title:ns.title||"Nouvelle étude",theme:`${t?.i} ${t?.l}`,dur:d?.l,mode:ns.ai?"IA":"Lien",link:ns.link,target:10,joined:0,budget:studyCost,status:"active",created:new Date().toLocaleDateString("fr-FR",{day:"2-digit",month:"short",year:"numeric"})}]);
    setWallet(prev=>prev-studyCost);
    setShowStudyModal(false);setNsStep(0);setNs({title:"",theme:"",dur:"",mode:"",link:"",ai:false,description:""});
  };
  const doRecharge=async()=>{
    const a=parseFloat(recharge.amt);
    if(!a||a<=0)return;
    try{
      const res=await fetch("/api/create-order",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({amount:a,userId:"user_123"})
      });
      const data=await res.json();
      if(data.approvalUrl){
        window.location.href=data.approvalUrl;
      }
    }catch(e){
      console.error("PayPal error:",e);
      alert("Erreur de connexion PayPal. Réessayez.");
    }
  };
  const markNotifRead=()=>setNotifs(n=>n.map(x=>({...x,read:true})));

  const sideItems=[
    {id:"overview",icon:"⬡",label:"Vue d'ensemble"},
    {id:"studies",icon:"📋",label:"Mes études",badge:studies.filter(s=>s.status==="active").length},
    {id:"messages",icon:"💬",label:"Messages",badge:unreadMsg},
    {id:"wallet",icon:"💰",label:"Portefeuille"},
    {id:"invoices",icon:"🧾",label:"Factures"},
    {id:"settings",icon:"⚙️",label:"Paramètres"},
  ];

  return(
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",fontFamily:FONT}}>
      {/* Topbar */}
      <header style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 28px",borderBottom:`1px solid ${C.border}`,background:C.surface,position:"sticky",top:0,zIndex:40}}>
        <Logo/>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <div style={{display:"flex",alignItems:"center",gap:8,background:C.accentGlow,border:`1px solid ${C.accent}44`,padding:"7px 14px",borderRadius:10,cursor:"pointer"}} onClick={()=>setShowWalletModal(true)}>
            <span style={{fontSize:13,color:C.muted}}>Solde</span>
            <span style={{fontSize:15,fontWeight:800,color:C.accentLight}}>{wallet.toFixed(2)}€</span>
            <span style={{fontSize:11,color:C.accent}}>+ Recharger</span>
          </div>
          <div style={{position:"relative",cursor:"pointer"}} onClick={()=>setShowNotifs(!showNotifs)}>
            <div style={{width:36,height:36,borderRadius:10,background:C.surfaceHigh,border:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🔔</div>
            {unread>0&&<span style={{position:"absolute",top:-4,right:-4,background:C.red,color:"#fff",fontSize:10,fontWeight:900,padding:"1px 5px",borderRadius:8}}>{unread}</span>}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <Avatar initials="?" color={C.accent}/>
            <div style={{fontSize:13}}><div style={{fontWeight:700}}>Mon compte</div><div style={{color:C.muted,fontSize:11}}>Chercheur</div></div>
          </div>
          <Btn secondary small onClick={onLogout}>Déconnexion</Btn>
        </div>
        {/* Notif dropdown */}
        {showNotifs&&(
          <div style={{position:"absolute",top:64,right:28,width:340,background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,boxShadow:"0 16px 48px rgba(0,0,0,.5)",zIndex:100}}>
            <div style={{padding:"14px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`1px solid ${C.border}`}}>
              <span style={{fontWeight:700,fontSize:14}}>Notifications</span>
              <span style={{fontSize:12,color:C.accent,cursor:"pointer"}} onClick={markNotifRead}>Tout lire</span>
            </div>
            {notifs.map(n=>(
              <div key={n.id} style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",gap:10,alignItems:"flex-start",background:n.read?"transparent":C.accentGlow}}>
                <span style={{fontSize:18}}>{n.type==="join"?"👤":n.type==="complete"?"✅":"💰"}</span>
                <div><div style={{fontSize:13,lineHeight:1.4}}>{n.text}</div><div style={{fontSize:11,color:C.muted,marginTop:3}}>{n.time}</div></div>
              </div>
            ))}
          </div>
        )}
      </header>

      <div style={{display:"flex",flex:1}}>
        {/* Sidebar */}
        <nav style={{width:210,borderRight:`1px solid ${C.border}`,padding:"20px 0",display:"flex",flexDirection:"column",gap:2,background:C.surface}}>
          {sideItems.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 18px",background:tab===t.id?C.accentGlow:"transparent",borderLeft:tab===t.id?`3px solid ${C.accent}`:"3px solid transparent",border:"none",color:tab===t.id?C.accentLight:C.muted,fontSize:13,fontWeight:tab===t.id?700:400,cursor:"pointer",textAlign:"left",transition:"all .15s",justifyContent:"space-between"}}>
              <span style={{display:"flex",gap:9,alignItems:"center"}}><span>{t.icon}</span>{t.label}</span>
              {t.badge>0&&<Badge n={t.badge}/>}
            </button>
          ))}
        </nav>

        {/* Content */}
        <main style={{flex:1,padding:"28px 32px",overflowY:"auto",background:C.bg}}>

          {/* OVERVIEW */}
          {tab==="overview"&&(
            <div>
              <h1 style={{fontSize:22,fontWeight:800,marginBottom:4}}>Bonjour 👋</h1>
              <p style={{color:C.muted,fontSize:14,marginBottom:24}}>Voici l'état de vos études en cours.</p>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:28}}>
                {[
                  {l:"Études actives",v:studies.filter(s=>s.status==="active").length,c:C.accentLight,i:"📋"},
                  {l:"Participants total",v:studies.reduce((a,s)=>a+s.joined,0),c:C.green,i:"👥"},
                  {l:"Budget total dépensé",v:studies.reduce((a,s)=>a+s.budget,0)+"€",c:C.yellow,i:"💸"},
                  {l:"Solde portefeuille",v:wallet.toFixed(2)+"€",c:C.accentLight,i:"💰"},
                ].map(s=>(
                  <Card key={s.l} style={{padding:"18px 20px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                      <span style={{fontSize:22}}>{s.i}</span>
                    </div>
                    <div style={{fontSize:24,fontWeight:900,color:s.c,marginBottom:2}}>{s.v}</div>
                    <div style={{fontSize:12,color:C.muted}}>{s.l}</div>
                  </Card>
                ))}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:20}}>
                <div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                    <h2 style={{fontSize:16,fontWeight:700}}>Études récentes</h2>
                    <span style={{fontSize:13,color:C.accent,cursor:"pointer"}} onClick={()=>setTab("studies")}>Voir tout →</span>
                  </div>
                  {studies.slice(0,3).map(s=>(<StudyCard key={s.id} s={s} onClick={()=>setShowStudyDetail(s)}/>))}
                </div>
                <div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                    <h2 style={{fontSize:16,fontWeight:700}}>Messages récents</h2>
                    <span style={{fontSize:13,color:C.accent,cursor:"pointer"}} onClick={()=>setTab("messages")}>Voir tout →</span>
                  </div>
                  {msgs.map(m=>(
                    <Card key={m.id} style={{padding:"12px 14px",marginBottom:8,cursor:"pointer"}} onClick={()=>{setActiveMsg(m.id);setTab("messages");}}>
                      <div style={{display:"flex",gap:10,alignItems:"center"}}>
                        <Avatar initials={m.avatar} color={C.accent} size={30}/>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontWeight:700,fontSize:13}}>{m.from}</div>
                          <div style={{fontSize:11,color:C.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.messages[m.messages.length-1].text}</div>
                        </div>
                        {m.unread>0&&<Badge n={m.unread}/>}
                      </div>
                    </Card>
                  ))}
                  <Btn full secondary small style={{marginTop:8}} onClick={()=>setTab("wallet")}>💰 Recharger le portefeuille</Btn>
                </div>
              </div>
            </div>
          )}

          {/* STUDIES */}
          {tab==="studies"&&(
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
                <div><h1 style={{fontSize:22,fontWeight:800,marginBottom:4}}>Mes études</h1><p style={{color:C.muted,fontSize:14}}>Gérez et suivez vos études.</p></div>
                <Btn onClick={()=>{setShowStudyModal(true);setNsStep(0);}}>+ Nouvelle étude</Btn>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {studies.map(s=>(<StudyCard key={s.id} s={s} full onClick={()=>setShowStudyDetail(s)}/>))}
              </div>
            </div>
          )}

          {/* MESSAGES */}
          {tab==="messages"&&(
            <div style={{display:"grid",gridTemplateColumns:"260px 1fr",gap:0,height:"calc(100vh - 140px)",border:`1px solid ${C.border}`,borderRadius:16,overflow:"hidden"}}>
              <div style={{borderRight:`1px solid ${C.border}`,background:C.surface,overflowY:"auto"}}>
                <div style={{padding:"14px 16px",fontWeight:700,fontSize:14,borderBottom:`1px solid ${C.border}`}}>Messages</div>
                {msgs.map(m=>(
                  <div key={m.id} onClick={()=>{setActiveMsg(m.id);setMsgs(prev=>prev.map(x=>x.id===m.id?{...x,unread:0}:x));}} style={{padding:"14px 16px",cursor:"pointer",background:activeMsg===m.id?C.accentGlow:undefined,borderLeft:activeMsg===m.id?`3px solid ${C.accent}`:"3px solid transparent",display:"flex",gap:10,alignItems:"center"}}>
                    <Avatar initials={m.avatar} size={32}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontWeight:700,fontSize:13}}>{m.from}</span><span style={{fontSize:10,color:C.muted}}>{m.time}</span></div>
                      <div style={{fontSize:11,color:C.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.study}</div>
                    </div>
                    {m.unread>0&&<Badge n={m.unread}/>}
                  </div>
                ))}
              </div>
              {activeMsg?(()=>{const c=msgs.find(m=>m.id===activeMsg);return(
                <div style={{display:"flex",flexDirection:"column"}}>
                  <div style={{padding:"14px 20px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:10}}>
                    <Avatar initials={c.avatar} size={30}/>
                    <div><div style={{fontWeight:700,fontSize:14}}>{c.from}</div><div style={{fontSize:11,color:C.muted}}>{c.study}</div></div>
                  </div>
                  <div style={{flex:1,overflowY:"auto",padding:"16px 20px",display:"flex",flexDirection:"column",gap:10}}>
                    {c.messages.map((m,i)=>(<div key={i} style={{display:"flex",justifyContent:m.mine?"flex-end":"flex-start"}}><div style={{maxWidth:"70%",padding:"10px 14px",borderRadius:12,background:m.mine?C.accent:C.surfaceHigh,fontSize:14,lineHeight:1.5}}>{m.text}<div style={{fontSize:10,color:m.mine?"rgba(255,255,255,.6)":C.muted,marginTop:4,textAlign:"right"}}>{m.time}</div></div></div>))}
                  </div>
                  <div style={{padding:"12px 16px",borderTop:`1px solid ${C.border}`,display:"flex",gap:10}}>
                    <input value={newMsg} onChange={e=>setNewMsg(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendMsg()} placeholder="Écrire un message…" style={{flex:1,padding:"9px 13px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:9,color:C.text,fontSize:14,outline:"none"}}/>
                    <Btn small onClick={sendMsg}>Envoyer</Btn>
                  </div>
                </div>
              );})():(
                <div style={{display:"flex",alignItems:"center",justifyContent:"center",color:C.muted,fontSize:14}}>Sélectionnez une conversation</div>
              )}
            </div>
          )}

          {/* WALLET */}
          {tab==="wallet"&&(
            <div style={{maxWidth:600}}>
              <h1 style={{fontSize:22,fontWeight:800,marginBottom:4}}>Portefeuille</h1>
              <p style={{color:C.muted,fontSize:14,marginBottom:24}}>Rechargez votre compte pour financer vos études.</p>
              <Card style={{padding:"28px",marginBottom:20,background:"linear-gradient(135deg,#0a1428,#0e1b35)",border:`1px solid ${C.accent}44`}}>
                <div style={{fontSize:13,color:C.muted,marginBottom:6}}>Solde disponible</div>
                <div style={{fontSize:48,fontWeight:900,color:C.accentLight,letterSpacing:"-2px",marginBottom:16}}>{wallet.toFixed(2)}<span style={{fontSize:22}}> €</span></div>
                <Btn onClick={()=>{setShowWalletModal(true);setRecharge({amt:"",done:false});}}>+ Recharger mon portefeuille</Btn>
              </Card>
              <h3 style={{fontWeight:700,fontSize:13,color:C.muted,textTransform:"uppercase",letterSpacing:.8,marginBottom:12}}>Historique des transactions</h3>
              <Card style={{overflow:"hidden"}}>
                {[
                ].length===0?<div style={{padding:"24px",textAlign:"center",color:C.muted,fontSize:14}}>Aucune transaction pour l'instant.</div>:[].map((t,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 20px",borderBottom:`1px solid ${C.border}`}}>
                    <div><div style={{fontSize:14,fontWeight:600}}>{t.l}</div><div style={{fontSize:12,color:C.muted}}>{t.d}</div></div>
                    <span style={{fontWeight:800,color:t.c,fontSize:15}}>{t.a}</span>
                  </div>
                ))}
              </Card>
            </div>
          )}

          {/* INVOICES */}
          {tab==="invoices"&&(
            <div style={{maxWidth:700}}>
              <h1 style={{fontSize:22,fontWeight:800,marginBottom:4}}>Factures</h1>
              <p style={{color:C.muted,fontSize:14,marginBottom:24}}>Toutes vos factures téléchargeables.</p>
              <Card style={{overflow:"hidden"}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr auto",padding:"10px 20px",borderBottom:`1px solid ${C.border}`,fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:.6}}>
                  <span>N°</span><span>Date</span><span>Étude</span><span>Montant</span><span>Statut</span>
                </div>
                {invoices.length===0?<div style={{padding:"24px",textAlign:"center",color:C.muted,fontSize:14}}>Aucune facture pour l'instant.</div>:invoices.map(inv=>(
                  <div key={inv.id} style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr auto",padding:"14px 20px",borderBottom:`1px solid ${C.border}`,alignItems:"center",fontSize:14}}>
                    <span style={{fontWeight:700,color:C.accent}}>{inv.id}</span>
                    <span style={{color:C.muted}}>{inv.date}</span>
                    <span>{inv.study}</span>
                    <span style={{fontWeight:700}}>{inv.amount}</span>
                    <div style={{display:"flex",gap:10,alignItems:"center"}}>
                      <Tag color={C.green}>{inv.status}</Tag>
                      <Btn secondary small onClick={()=>{}}>PDF</Btn>
                    </div>
                  </div>
                ))}
              </Card>
            </div>
          )}

          {/* SETTINGS */}
          {tab==="settings"&&(
            <div style={{maxWidth:560}}>
              <h1 style={{fontSize:22,fontWeight:800,marginBottom:4}}>Paramètres</h1>
              <p style={{color:C.muted,fontSize:14,marginBottom:24}}>Gérez votre compte et vos préférences.</p>
              <Card style={{padding:24,marginBottom:16}}>
                <h3 style={{fontWeight:700,marginBottom:16,fontSize:15}}>Informations personnelles</h3>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><Inp label="Prénom" defaultValue=""/><Inp label="Nom" defaultValue=""/></div>
                <Inp label="E-mail" type="email" defaultValue=""/>
                <Inp label="Entreprise" defaultValue=""/>
                <Inp label="Téléphone" defaultValue=""/>
                <Btn>Enregistrer</Btn>
              </Card>
              <Card style={{padding:24,marginBottom:16}}>
                <h3 style={{fontWeight:700,marginBottom:16,fontSize:15}}>Sécurité</h3>
                <Inp label="Mot de passe actuel" type="password" placeholder="••••••••"/>
                <Inp label="Nouveau mot de passe" type="password" placeholder="••••••••"/>
                <Inp label="Confirmer le nouveau mot de passe" type="password" placeholder="••••••••"/>
                <Btn>Changer le mot de passe</Btn>
              </Card>
              <Card style={{padding:24}}>
                <h3 style={{fontWeight:700,marginBottom:16,fontSize:15}}>Notifications e-mail</h3>
                {["Nouveau participant inscrit à mon étude","Étude complétée","Recharge de portefeuille confirmée","Nouvelles fonctionnalités"].map(l=>(
                  <label key={l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,fontSize:13,cursor:"pointer"}}>
                    {l}<input type="checkbox" defaultChecked style={{width:16,height:16}}/>
                  </label>
                ))}
              </Card>
            </div>
          )}
        </main>
      </div>

      {/* MODAL: New Study */}
      {showStudyModal&&(
        <Modal onClose={()=>setShowStudyModal(false)} title={`Nouvelle étude — Étape ${nsStep+1}/4`} wide>
          {nsStep===0&&(
            <div>
              <Inp label="Titre de l'étude *" placeholder="Ex: Test UX de notre nouvelle app mobile…" value={ns.title} onChange={e=>setNs({...ns,title:e.target.value})}/>
              <div style={{marginBottom:8,fontSize:12,fontWeight:600,color:C.muted,letterSpacing:.4}}>THÈME *</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
                {THEMES.map(t=>(<button key={t.id} onClick={()=>setNs({...ns,theme:t.id})} style={{background:ns.theme===t.id?C.accentGlow:C.bg,border:`1.5px solid ${ns.theme===t.id?C.accent:C.border}`,borderRadius:10,padding:"10px 8px",cursor:"pointer",color:C.text,fontSize:12,textAlign:"center"}}><div style={{fontSize:20,marginBottom:4}}>{t.i}</div>{t.l}</button>))}
              </div>
            </div>
          )}
          {nsStep===1&&(
            <div>
              <p style={{fontWeight:700,marginBottom:12}}>Durée de l'entretien</p>
              {DURATIONS.map(d=>(<div key={d.id} onClick={()=>setNs({...ns,dur:d.id})} style={{background:ns.dur===d.id?C.accentGlow:C.bg,border:`1.5px solid ${ns.dur===d.id?C.accent:C.border}`,borderRadius:12,padding:"16px",cursor:"pointer",marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div><div style={{fontWeight:700,display:"flex",gap:8,alignItems:"center"}}>{d.l}{d.popular&&<Tag color={C.accent}>Populaire</Tag>}</div><div style={{fontSize:12,color:C.muted,marginTop:2}}>{d.desc}</div></div>
                <span style={{fontWeight:800,color:C.accentLight,fontSize:22}}>{d.price}€</span>
              </div>))}
            </div>
          )}
          {nsStep===2&&(
            <div>
              <p style={{fontWeight:700,marginBottom:12}}>Mode d'entretien</p>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:16}}>
                {[{id:"link",icon:"🔗",title:"Mon propre lien",desc:"Gérez l'entretien vous-même (Zoom, Typeform, Calendly…)"},{id:"ai",icon:"🤖",title:"Entretiens IA",desc:"Notre IA conduit et synthétise l'entretien",extra:"+10€ / étude"}].map(m=>(
                  <div key={m.id} onClick={()=>setNs({...ns,mode:m.id,ai:m.id==="ai"})} style={{background:ns.mode===m.id?C.accentGlow:C.bg,border:`1.5px solid ${ns.mode===m.id?C.accent:C.border}`,borderRadius:12,padding:"20px",cursor:"pointer",textAlign:"center"}}>
                    <div style={{fontSize:28,marginBottom:8}}>{m.icon}</div>
                    <div style={{fontWeight:800,fontSize:14,marginBottom:4}}>{m.title}</div>
                    <div style={{fontSize:12,color:C.muted}}>{m.desc}</div>
                    {m.extra&&<div style={{marginTop:8,fontSize:12,fontWeight:700,color:C.accentLight}}>{m.extra}</div>}
                  </div>
                ))}
              </div>
              {ns.mode==="link"&&<Inp label="Lien de votre étude *" placeholder="https://forms.typeform.com/…" value={ns.link} onChange={e=>setNs({...ns,link:e.target.value})}/>}
              {ns.mode==="ai"&&(<div style={{background:C.accentGlow,border:`1px solid ${C.accent}33`,borderRadius:12,padding:"14px 16px",fontSize:13,color:C.muted}}><strong style={{color:C.text}}>Comment ça marche ?</strong><br/>Notre IA pose vos questions, gère les relances et vous livre un rapport synthétique avec verbatims sous 48h après chaque entretien.</div>)}
            </div>
          )}
          {nsStep===3&&(
            <div>
              <p style={{fontWeight:700,marginBottom:14}}>Récapitulatif</p>
              <Card style={{padding:"4px 0",marginBottom:16}}>
                {[["Titre",ns.title||"—"],["Thème",THEMES.find(t=>t.id===ns.theme)?.l||"—"],["Durée",DURATIONS.find(d=>d.id===ns.dur)?.l||"—"],["Mode",ns.ai?"🤖 Entretiens IA":"🔗 Lien personnel"],ns.link?["Lien",ns.link]:null].filter(Boolean).map(([k,v])=>(
                  <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"10px 16px",borderBottom:`1px solid ${C.border}`,fontSize:13}}><span style={{color:C.muted}}>{k}</span><span style={{maxWidth:260,textAlign:"right",wordBreak:"break-all"}}>{v}</span></div>
                ))}
              </Card>
              <div style={{background:C.accentGlow,border:`1px solid ${C.accent}44`,borderRadius:12,padding:"14px 16px",marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                  <span style={{fontSize:13,color:C.muted}}>Prix fixe par participant</span><span style={{fontWeight:700}}>{studyCost}€</span>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                  <span style={{fontSize:13,color:C.muted}}>Frais StudyReach (10%)</span><span style={{fontWeight:700,color:C.red}}>-{studyFee}€</span>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",borderTop:`1px solid ${C.border}`,paddingTop:8}}>
                  <span style={{fontWeight:700}}>Reçu par le candidat</span><strong style={{color:C.green,fontSize:20}}>{participantPay}€</strong>
                </div>
              </div>
              <p style={{fontSize:12,color:C.muted}}>Solde actuel : {wallet.toFixed(2)}€ {wallet<studyCost*5?<span style={{color:C.red}}>— Pensez à recharger votre portefeuille</span>:""}</p>
            </div>
          )}
          <div style={{display:"flex",justifyContent:"space-between",marginTop:24,paddingTop:16,borderTop:`1px solid ${C.border}`}}>
            <Btn secondary onClick={()=>nsStep>0?setNsStep(nsStep-1):setShowStudyModal(false)}>{nsStep===0?"Annuler":"← Retour"}</Btn>
            {nsStep<3?<Btn onClick={()=>setNsStep(nsStep+1)} disabled={(nsStep===0&&(!ns.title||!ns.theme))||(nsStep===1&&!ns.dur)||(nsStep===2&&!ns.mode)}>Continuer →</Btn>:<Btn onClick={publishStudy}>🚀 Publier l'étude</Btn>}
          </div>
        </Modal>
      )}

      {/* MODAL: Wallet */}
      {showWalletModal&&(
        <Modal onClose={()=>setShowWalletModal(false)} title={recharge.done?"":"Recharger le portefeuille"}>
          {!recharge.done?(
            <>
              <p style={{color:C.muted,fontSize:13,marginBottom:18}}>Solde actuel : <strong style={{color:C.accentLight}}>{wallet.toFixed(2)}€</strong></p>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:14}}>
                {[20,50,100,200].map(a=>(<button key={a} onClick={()=>setRecharge(r=>({...r,amt:String(a)}))} style={{background:recharge.amt==a?C.accentGlow:C.bg,border:`1.5px solid ${recharge.amt==a?C.accent:C.border}`,borderRadius:10,padding:"10px",cursor:"pointer",fontWeight:700,color:C.text,fontSize:14}}>{a}€</button>))}
              </div>
              <Inp label="Montant personnalisé (€)" type="number" placeholder="Ex: 75" value={recharge.amt} onChange={e=>setRecharge(r=>({...r,amt:e.target.value}))}/>
              <Divider/>
              <p style={{fontWeight:700,fontSize:14,marginBottom:12}}>Payer via PayPal</p>
              <p style={{fontSize:13,color:C.muted,marginBottom:16}}>Vous allez être redirigé vers PayPal pour finaliser la recharge de votre portefeuille.</p>
              <Btn full onClick={doRecharge} disabled={!recharge.amt||parseFloat(recharge.amt)<=0} style={{marginTop:4,background:"#0070ba",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                <span style={{fontSize:18}}>🅿</span> Payer {recharge.amt?recharge.amt+"€":""} avec PayPal →
              </Btn>
              <p style={{fontSize:11,color:C.muted,marginTop:8,textAlign:"center"}}>🔒 Paiement sécurisé par PayPal</p>
            </>
          ):(
            <div style={{textAlign:"center",padding:"16px 0"}}>
              <div style={{width:60,height:60,borderRadius:"50%",background:C.greenGlow,border:`2px solid ${C.green}`,color:C.green,fontSize:26,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px"}}>✓</div>
              <h3 style={{fontSize:20,fontWeight:800,marginBottom:6}}>Recharge effectuée !</h3>
              <p style={{color:C.muted,marginBottom:6}}>+{recharge.amt}€ ajoutés à votre portefeuille.</p>
              <p style={{fontSize:20,fontWeight:800,color:C.accentLight,marginBottom:20}}>Nouveau solde : {wallet.toFixed(2)}€</p>
              <Btn onClick={()=>setShowWalletModal(false)}>Fermer</Btn>
            </div>
          )}
        </Modal>
      )}

      {/* MODAL: Study detail */}
      {showStudyDetail&&(
        <Modal onClose={()=>setShowStudyDetail(null)} title={showStudyDetail.title} wide>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14,marginBottom:20}}>
            {[{l:"Participants",v:`${showStudyDetail.joined} / ${showStudyDetail.target}`,c:C.accentLight},{l:"Budget dépensé",v:showStudyDetail.budget+"€",c:C.yellow},{l:"Statut",v:showStudyDetail.status==="active"?"Active":"Terminée",c:showStudyDetail.status==="active"?C.green:C.muted}].map(s=>(
              <Card key={s.l} style={{padding:"14px 16px",textAlign:"center"}}>
                <div style={{fontSize:20,fontWeight:800,color:s.c}}>{s.v}</div>
                <div style={{fontSize:12,color:C.muted,marginTop:2}}>{s.l}</div>
              </Card>
            ))}
          </div>
          <div style={{marginBottom:14}}>
            <div style={{fontSize:12,color:C.muted,marginBottom:6}}>Progression du recrutement</div>
            <ProgressBar value={showStudyDetail.joined} max={showStudyDetail.target}/>
            <div style={{fontSize:11,color:C.muted,marginTop:4}}>{Math.round((showStudyDetail.joined/showStudyDetail.target)*100)}% de l'objectif atteint</div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,fontSize:13}}>
            {[["Thème",showStudyDetail.theme],["Durée",showStudyDetail.dur],["Mode",showStudyDetail.mode],["Créée le",showStudyDetail.created]].map(([k,v])=>(
              <div key={k} style={{background:C.surfaceHigh,borderRadius:10,padding:"10px 12px"}}><div style={{color:C.muted,fontSize:11,marginBottom:2}}>{k}</div><div style={{fontWeight:600}}>{v}</div></div>
            ))}
          </div>
          {showStudyDetail.link&&<div style={{marginTop:14}}><div style={{fontSize:12,color:C.muted,marginBottom:4}}>Lien de l'étude</div><div style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 12px",fontSize:13,wordBreak:"break-all",color:C.accent}}>{showStudyDetail.link}</div></div>}
          <div style={{display:"flex",gap:10,marginTop:20}}>
            {showStudyDetail.status==="active"&&<Btn danger small onClick={()=>{setStudies(prev=>prev.map(s=>s.id===showStudyDetail.id?{...s,status:"completed"}:s));setShowStudyDetail(null);}}>Terminer l'étude</Btn>}
            <Btn secondary small onClick={()=>setShowStudyDetail(null)}>Fermer</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

function StudyCard({s,full,onClick}){
  return(
    <Card style={{padding:"18px 22px",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:full?0:8,cursor:"pointer"}} onClick={onClick}>
      <div style={{flex:1}}>
        <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:6}}>
          <span style={{fontSize:15,fontWeight:700}}>{s.title}</span>
          <Tag color={s.status==="active"?C.green:C.muted}>{s.status==="active"?"Active":"Terminée"}</Tag>
        </div>
        <div style={{display:"flex",gap:14,fontSize:12,color:C.muted,flexWrap:"wrap"}}>
          <span>{s.theme}</span><span>· {s.dur}</span><span>· {s.mode}</span>
          {full&&<span>· Créée le {s.created}</span>}
        </div>
        {full&&<div style={{marginTop:8}}><ProgressBar value={s.joined} max={s.target}/><div style={{fontSize:11,color:C.muted,marginTop:3}}>{s.joined}/{s.target} participants</div></div>}
      </div>
      <div style={{textAlign:"right",marginLeft:16}}>
        <div style={{fontSize:15,fontWeight:700}}>{s.joined} participants</div>
        <div style={{fontSize:12,color:C.muted}}>{s.budget}€ dépensés</div>
      </div>
    </Card>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  PARTICIPANT DASHBOARD
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function ParticipantDashboard({onLogout}){
  const [tab,setTab]=useState("overview");
  const [studies,setStudies]=useState(INIT_P_STUDIES);
  const [earnings,setEarnings]=useState(0);
  const [pending,setPending]=useState(0);
  const [notifs,setNotifs]=useState(INIT_NOTIFS_P);
  const [msgs,setMsgs]=useState(INIT_MESSAGES);
  const [activeMsg,setActiveMsg]=useState(null);
  const [newMsg,setNewMsg]=useState("");
  const [showNotifs,setShowNotifs]=useState(false);
  const [showWithdraw,setShowWithdraw]=useState(false);
  const [withdrawDone,setWithdrawDone]=useState(false);
  const [showStudyDetail,setShowStudyDetail]=useState(null);
  const [filterTheme,setFilterTheme]=useState("");
  const [filterDur,setFilterDur]=useState("");
  const [profile,setProfile]=useState({first:"",last:"",email:"",paypal:"",prof:"",bio:"",age:"",region:""});

  const unread=notifs.filter(n=>!n.read).length;
  const unreadMsg=msgs.reduce((a,m)=>a+m.messages.filter(x=>!x.mine).length,0);
  const totalEarned=studies.filter(s=>s.status==="completed").reduce((a,s)=>a+s.pay,0);

  const joinStudy=(id)=>{
    const s=studies.find(x=>x.id===id);
    setStudies(prev=>prev.map(x=>x.id===id?{...x,status:"joined"}:x));
    setPending(p=>p+s.pay);
    setShowStudyDetail(null);
  };
  const completeStudy=(id)=>{
    const s=studies.find(x=>x.id===id);
    setStudies(prev=>prev.map(x=>x.id===id?{...x,status:"completed"}:x));
    setPending(p=>Math.max(0,p-s.pay));
    setEarnings(e=>e+s.pay);
  };
  const sendMsg=()=>{if(!newMsg.trim())return;setMsgs(prev=>prev.map(m=>m.id===activeMsg?{...m,messages:[...m.messages,{from:"Vous",text:newMsg,time:"maintenant",mine:true}]}:m));setNewMsg("");};
  const markRead=()=>setNotifs(n=>n.map(x=>({...x,read:true})));

  const avail=studies.filter(s=>s.status==="available"&&(filterTheme?s.theme.includes(filterTheme):true)&&(filterDur?s.dur===filterDur:true));

  const sideItems=[
    {id:"overview",icon:"⬡",label:"Vue d'ensemble"},
    {id:"studies",icon:"🔍",label:"Études disponibles",badge:studies.filter(s=>s.status==="available").length},
    {id:"history",icon:"📂",label:"Mes participations"},
    {id:"earnings",icon:"💸",label:"Mes revenus"},
    {id:"messages",icon:"💬",label:"Messages",badge:unreadMsg},
    {id:"profile",icon:"👤",label:"Mon profil"},
    {id:"settings",icon:"⚙️",label:"Paramètres"},
  ];

  return(
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",fontFamily:FONT}}>
      <header style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 28px",borderBottom:`1px solid ${C.border}`,background:C.surface,position:"sticky",top:0,zIndex:40}}>
        <Logo/>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <div style={{display:"flex",alignItems:"center",gap:8,background:C.greenGlow,border:`1px solid ${C.green}44`,padding:"7px 14px",borderRadius:10}}>
            <span style={{fontSize:13,color:C.muted}}>Gains disponibles</span>
            <span style={{fontSize:15,fontWeight:800,color:C.green}}>{earnings.toFixed(2)}€</span>
          </div>
          {pending>0&&<div style={{fontSize:13,color:C.yellow,background:C.yellow+"18",padding:"7px 12px",borderRadius:10,border:`1px solid ${C.yellow}44`}}>⏳ {pending}€ en attente</div>}
          <div style={{position:"relative",cursor:"pointer"}} onClick={()=>setShowNotifs(!showNotifs)}>
            <div style={{width:36,height:36,borderRadius:10,background:C.surfaceHigh,border:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🔔</div>
            {unread>0&&<span style={{position:"absolute",top:-4,right:-4,background:C.red,color:"#fff",fontSize:10,fontWeight:900,padding:"1px 5px",borderRadius:8}}>{unread}</span>}
          </div>
          <Avatar initials="?" color={C.green}/>
          <Btn secondary small onClick={onLogout}>Déconnexion</Btn>
        </div>
        {showNotifs&&(
          <div style={{position:"absolute",top:64,right:28,width:340,background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,boxShadow:"0 16px 48px rgba(0,0,0,.5)",zIndex:100}}>
            <div style={{padding:"14px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`1px solid ${C.border}`}}>
              <span style={{fontWeight:700,fontSize:14}}>Notifications</span>
              <span style={{fontSize:12,color:C.green,cursor:"pointer"}} onClick={markRead}>Tout lire</span>
            </div>
            {notifs.map(n=>(
              <div key={n.id} style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",gap:10,background:n.read?"transparent":C.greenGlow}}>
                <span style={{fontSize:18}}>{n.type==="pay"?"💸":n.type==="new"?"✨":"💬"}</span>
                <div><div style={{fontSize:13,lineHeight:1.4}}>{n.text}</div><div style={{fontSize:11,color:C.muted,marginTop:3}}>{n.time}</div></div>
              </div>
            ))}
          </div>
        )}
      </header>

      <div style={{display:"flex",flex:1}}>
        <nav style={{width:210,borderRight:`1px solid ${C.border}`,padding:"20px 0",display:"flex",flexDirection:"column",gap:2,background:C.surface}}>
          {sideItems.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 18px",background:tab===t.id?C.greenGlow:"transparent",borderLeft:tab===t.id?`3px solid ${C.green}`:"3px solid transparent",border:"none",color:tab===t.id?C.green:C.muted,fontSize:13,fontWeight:tab===t.id?700:400,cursor:"pointer",textAlign:"left",transition:"all .15s",justifyContent:"space-between"}}>
              <span style={{display:"flex",gap:9,alignItems:"center"}}><span>{t.icon}</span>{t.label}</span>
              {t.badge>0&&<Badge n={t.badge} color={C.green}/>}
            </button>
          ))}
        </nav>

        <main style={{flex:1,padding:"28px 32px",overflowY:"auto",background:C.bg}}>

          {/* OVERVIEW */}
          {tab==="overview"&&(
            <div>
              <h1 style={{fontSize:22,fontWeight:800,marginBottom:4}}>Bonjour 👋</h1>
              <p style={{color:C.muted,fontSize:14,marginBottom:24}}>Voici votre tableau de bord participant.</p>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:28}}>
                {[
                  {l:"Études disponibles",v:studies.filter(s=>s.status==="available").length,c:C.accentLight,i:"🔍"},
                  {l:"En cours",v:studies.filter(s=>s.status==="joined").length,c:C.yellow,i:"⏳"},
                  {l:"Complétées",v:studies.filter(s=>s.status==="completed").length,c:C.green,i:"✅"},
                  {l:"Total gagné",v:totalEarned+"€",c:C.green,i:"💸"},
                ].map(s=>(
                  <Card key={s.l} style={{padding:"18px 20px"}}><div style={{fontSize:22,marginBottom:8}}>{s.i}</div><div style={{fontSize:24,fontWeight:900,color:s.c,marginBottom:2}}>{s.v}</div><div style={{fontSize:12,color:C.muted}}>{s.l}</div></Card>
                ))}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:20}}>
                <div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                    <h2 style={{fontSize:16,fontWeight:700}}>Études disponibles pour vous</h2>
                    <span style={{fontSize:13,color:C.green,cursor:"pointer"}} onClick={()=>setTab("studies")}>Voir tout →</span>
                  </div>
                  {studies.filter(s=>s.status==="available").slice(0,3).map(s=>(
                    <Card key={s.id} style={{padding:"16px 20px",marginBottom:10,cursor:"pointer"}} onClick={()=>setShowStudyDetail(s)}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div><div style={{fontWeight:700,marginBottom:4}}>{s.title}</div><div style={{fontSize:12,color:C.muted}}>⏱ {s.dur} · {s.researcher} · {s.mode==="IA"?"🤖 IA":"🔗 Lien"}</div></div>
                        <span style={{fontWeight:900,color:C.green,fontSize:20}}>{s.pay}€</span>
                      </div>
                    </Card>
                  ))}
                </div>
                <div>
                  <h2 style={{fontSize:16,fontWeight:700,marginBottom:12}}>Revenus</h2>
                  <Card style={{padding:"20px",marginBottom:12,background:"linear-gradient(135deg,#081a10,#0c1f14)",border:`1px solid ${C.green}33`}}>
                    <div style={{fontSize:12,color:C.muted,marginBottom:4}}>Disponibles</div>
                    <div style={{fontSize:30,fontWeight:900,color:C.green,letterSpacing:"-1px",marginBottom:10}}>{earnings.toFixed(2)}€</div>
                    <Btn small green full onClick={()=>{setShowWithdraw(true);setWithdrawDone(false);}}>Retirer sur PayPal</Btn>
                  </Card>
                  {pending>0&&<Card style={{padding:"16px",background:C.yellow+"11",border:`1px solid ${C.yellow}33`}}><div style={{fontSize:12,color:C.muted}}>En attente de validation</div><div style={{fontSize:22,fontWeight:800,color:C.yellow}}>{pending.toFixed(2)}€</div></Card>}
                </div>
              </div>
            </div>
          )}

          {/* AVAILABLE STUDIES */}
          {tab==="studies"&&(
            <div>
              <h1 style={{fontSize:22,fontWeight:800,marginBottom:4}}>Études disponibles</h1>
              <p style={{color:C.muted,fontSize:14,marginBottom:20}}>Participez et soyez payé directement sur PayPal.</p>
              <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap"}}>
                <select value={filterTheme} onChange={e=>setFilterTheme(e.target.value)} style={{padding:"8px 12px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:9,color:C.text,fontSize:13,outline:"none"}}>
                  <option value="">Tous les thèmes</option>
                  {THEMES.map(t=><option key={t.id} value={t.i}>{t.i} {t.l}</option>)}
                </select>
                <select value={filterDur} onChange={e=>setFilterDur(e.target.value)} style={{padding:"8px 12px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:9,color:C.text,fontSize:13,outline:"none"}}>
                  <option value="">Toutes les durées</option>
                  {DURATIONS.map(d=><option key={d.id} value={d.l}>{d.l}</option>)}
                </select>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {avail.map(s=>(
                  <Card key={s.id} style={{padding:"22px 24px",cursor:"pointer"}} onClick={()=>setShowStudyDetail(s)}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                      <div style={{flex:1}}>
                        <div style={{fontSize:16,fontWeight:700,marginBottom:6}}>{s.title}</div>
                        <div style={{display:"flex",gap:12,fontSize:12,color:C.muted,flexWrap:"wrap",marginBottom:8}}>
                          <span>👤 {s.researcher} · {s.company}</span><span>⏱ {s.dur}</span><span>📅 Avant le {s.deadline}</span><span>{s.mode==="IA"?"🤖 IA":"🔗 Lien"}</span>
                        </div>
                        <p style={{fontSize:13,color:C.muted,lineHeight:1.5}}>{s.desc}</p>
                      </div>
                      <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:10,marginLeft:16}}>
                        <span style={{fontSize:26,fontWeight:900,color:C.green}}>{s.pay}€</span>
                        <Btn small green onClick={e=>{e.stopPropagation();joinStudy(s.id);}}>Participer</Btn>
                      </div>
                    </div>
                  </Card>
                ))}
                {avail.length===0&&<div style={{textAlign:"center",padding:"48px",color:C.muted}}><div style={{fontSize:40,marginBottom:12}}>🎉</div><p>Aucune étude disponible avec ces filtres.</p></div>}
              </div>
            </div>
          )}

          {/* HISTORY */}
          {tab==="history"&&(
            <div>
              <h1 style={{fontSize:22,fontWeight:800,marginBottom:4}}>Mes participations</h1>
              <p style={{color:C.muted,fontSize:14,marginBottom:20}}>Études en cours et terminées.</p>
              {["joined","completed"].map(st=>(
                <div key={st} style={{marginBottom:24}}>
                  <h3 style={{fontSize:14,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:.8,marginBottom:10}}>{st==="joined"?"En cours":"Terminées"}</h3>
                  {studies.filter(s=>s.status===st).length===0?<p style={{color:C.dimmed,fontSize:14}}>Aucune.</p>:studies.filter(s=>s.status===st).map(s=>(
                    <Card key={s.id} style={{padding:"18px 22px",marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div><div style={{fontWeight:700,marginBottom:4}}>{s.title}</div><div style={{fontSize:12,color:C.muted}}>{s.dur} · {s.researcher} · {s.company}</div></div>
                      <div style={{display:"flex",gap:12,alignItems:"center"}}>
                        <span style={{fontWeight:800,color:C.green,fontSize:18}}>{s.pay}€</span>
                        <Tag color={st==="joined"?C.yellow:C.green}>{st==="joined"?"En cours":"Payée ✓"}</Tag>
                        {st==="joined"&&<Btn small green onClick={()=>completeStudy(s.id)}>Marquer terminée</Btn>}
                      </div>
                    </Card>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* EARNINGS */}
          {tab==="earnings"&&(
            <div style={{maxWidth:580}}>
              <h1 style={{fontSize:22,fontWeight:800,marginBottom:4}}>Mes revenus</h1>
              <p style={{color:C.muted,fontSize:14,marginBottom:24}}>Retraits automatiques sur votre PayPal.</p>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:24}}>
                <Card style={{padding:"22px",background:"linear-gradient(135deg,#081a10,#0c1f14)",border:`1px solid ${C.green}33`}}>
                  <div style={{fontSize:12,color:C.muted,marginBottom:4}}>Disponibles</div>
                  <div style={{fontSize:36,fontWeight:900,color:C.green,letterSpacing:"-1px"}}>{earnings.toFixed(2)}€</div>
                  <Btn small green style={{marginTop:12}} onClick={()=>{setShowWithdraw(true);setWithdrawDone(false);}}>Retirer sur PayPal</Btn>
                </Card>
                <Card style={{padding:"22px",background:C.yellow+"0a",border:`1px solid ${C.yellow}33`}}>
                  <div style={{fontSize:12,color:C.muted,marginBottom:4}}>En attente</div>
                  <div style={{fontSize:36,fontWeight:900,color:C.yellow,letterSpacing:"-1px"}}>{pending.toFixed(2)}€</div>
                  <p style={{fontSize:11,color:C.muted,marginTop:8}}>Versé après validation de l'étude</p>
                </Card>
              </div>
              <div style={{background:C.surface,border:`1px solid ${C.green}33`,borderRadius:12,padding:"14px 18px",marginBottom:20,display:"flex",gap:10,alignItems:"center"}}>
                <span style={{fontSize:20}}>💸</span>
                <div><div style={{fontWeight:700,fontSize:14}}>Compte PayPal lié</div><div style={{fontSize:13,color:C.muted}}>{profile.paypal}</div></div>
                <Btn secondary small style={{marginLeft:"auto"}} onClick={()=>setTab("settings")}>Modifier</Btn>
              </div>
              <h3 style={{fontWeight:700,fontSize:13,color:C.muted,textTransform:"uppercase",letterSpacing:.8,marginBottom:12}}>Historique des paiements</h3>
              <Card style={{overflow:"hidden"}}>
                {[
                ].map((t,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 20px",borderBottom:`1px solid ${C.border}`}}>
                    <div><div style={{fontSize:14,fontWeight:600}}>{t.l}</div><div style={{fontSize:12,color:C.muted}}>{t.d}</div></div>
                    <div style={{display:"flex",gap:10,alignItems:"center"}}>
                      <Tag color={C.green}>{t.s}</Tag>
                      <span style={{fontWeight:800,color:C.green,fontSize:15}}>{t.a}</span>
                    </div>
                  </div>
                ))}
              </Card>
            </div>
          )}

          {/* MESSAGES */}
          {tab==="messages"&&(
            <div style={{display:"grid",gridTemplateColumns:"260px 1fr",gap:0,height:"calc(100vh-140px)",border:`1px solid ${C.border}`,borderRadius:16,overflow:"hidden",minHeight:480}}>
              <div style={{borderRight:`1px solid ${C.border}`,background:C.surface,overflowY:"auto"}}>
                <div style={{padding:"14px 16px",fontWeight:700,fontSize:14,borderBottom:`1px solid ${C.border}`}}>Messages</div>
                {msgs.map(m=>(
                  <div key={m.id} onClick={()=>setActiveMsg(m.id)} style={{padding:"14px 16px",cursor:"pointer",background:activeMsg===m.id?C.greenGlow:undefined,borderLeft:activeMsg===m.id?`3px solid ${C.green}`:"3px solid transparent",display:"flex",gap:10,alignItems:"center"}}>
                    <Avatar initials={m.avatar} color={C.green} size={32}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontWeight:700,fontSize:13}}>{m.from}</span><span style={{fontSize:10,color:C.muted}}>{m.time}</span></div>
                      <div style={{fontSize:11,color:C.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.study}</div>
                    </div>
                    {m.unread>0&&<Badge n={m.unread} color={C.green}/>}
                  </div>
                ))}
              </div>
              {activeMsg?(()=>{const c=msgs.find(m=>m.id===activeMsg);return(
                <div style={{display:"flex",flexDirection:"column"}}>
                  <div style={{padding:"14px 20px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:10}}>
                    <Avatar initials={c.avatar} color={C.green} size={30}/>
                    <div><div style={{fontWeight:700,fontSize:14}}>{c.from}</div><div style={{fontSize:11,color:C.muted}}>{c.study}</div></div>
                  </div>
                  <div style={{flex:1,overflowY:"auto",padding:"16px 20px",display:"flex",flexDirection:"column",gap:10,minHeight:200}}>
                    {c.messages.map((m,i)=>(<div key={i} style={{display:"flex",justifyContent:m.mine?"flex-end":"flex-start"}}><div style={{maxWidth:"70%",padding:"10px 14px",borderRadius:12,background:m.mine?C.green:C.surfaceHigh,color:m.mine?"#fff":C.text,fontSize:14,lineHeight:1.5}}>{m.text}<div style={{fontSize:10,color:m.mine?"rgba(255,255,255,.6)":C.muted,marginTop:4,textAlign:"right"}}>{m.time}</div></div></div>))}
                  </div>
                  <div style={{padding:"12px 16px",borderTop:`1px solid ${C.border}`,display:"flex",gap:10}}>
                    <input value={newMsg} onChange={e=>setNewMsg(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendMsg()} placeholder="Écrire un message…" style={{flex:1,padding:"9px 13px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:9,color:C.text,fontSize:14,outline:"none"}}/>
                    <Btn small green onClick={sendMsg}>Envoyer</Btn>
                  </div>
                </div>
              );})():(
                <div style={{display:"flex",alignItems:"center",justifyContent:"center",color:C.muted,fontSize:14}}>Sélectionnez une conversation</div>
              )}
            </div>
          )}

          {/* PROFILE */}
          {tab==="profile"&&(
            <div style={{maxWidth:560}}>
              <h1 style={{fontSize:22,fontWeight:800,marginBottom:4}}>Mon profil</h1>
              <p style={{color:C.muted,fontSize:14,marginBottom:24}}>Votre profil est utilisé pour vous matcher aux études pertinentes.</p>
              <Card style={{padding:24,marginBottom:16}}>
                <div style={{display:"flex",gap:16,alignItems:"center",marginBottom:20}}>
                  <Avatar initials={profile.first?profile.first[0].toUpperCase()+"?":"?"} color={C.green} size={52}/>
                  <div><div style={{fontSize:18,fontWeight:800}}>{profile.first} {profile.last}</div><div style={{color:C.muted,fontSize:13}}>{profile.prof}</div><div style={{color:C.muted,fontSize:12,marginTop:2}}>{profile.email}</div></div>
                </div>
                <div style={{marginBottom:12,fontSize:13,color:C.muted,lineHeight:1.6,background:C.surfaceHigh,borderRadius:10,padding:"12px 14px"}}>{profile.bio}</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,fontSize:13}}>
                  {[["Profession",profile.prof],["Tranche d'âge",profile.age],["Région",profile.region],["PayPal",profile.paypal]].map(([k,v])=>(
                    <div key={k} style={{background:C.surfaceHigh,borderRadius:10,padding:"10px 12px"}}><div style={{color:C.muted,fontSize:11,marginBottom:2}}>{k}</div><div style={{fontWeight:600}}>{v}</div></div>
                  ))}
                </div>
              </Card>
              <Card style={{padding:24}}>
                <h3 style={{fontWeight:700,marginBottom:14,fontSize:15}}>Thèmes d'intérêt</h3>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {["🎨 UX","📣 Marketing","🤖 Tech","🛒 Conso"].map(t=>(<Tag key={t} color={C.green} style={{padding:"5px 12px",fontSize:12}}>{t}</Tag>))}
                </div>
              </Card>
            </div>
          )}

          {/* SETTINGS */}
          {tab==="settings"&&(
            <div style={{maxWidth:560}}>
              <h1 style={{fontSize:22,fontWeight:800,marginBottom:4}}>Paramètres</h1>
              <p style={{color:C.muted,fontSize:14,marginBottom:24}}>Gérez votre compte participant.</p>
              <Card style={{padding:24,marginBottom:16}}>
                <h3 style={{fontWeight:700,marginBottom:16,fontSize:15}}>Informations personnelles</h3>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><Inp label="Prénom" value={profile.first} onChange={e=>setProfile({...profile,first:e.target.value})}/><Inp label="Nom" value={profile.last} onChange={e=>setProfile({...profile,last:e.target.value})}/></div>
                <Inp label="E-mail" type="email" value={profile.email} onChange={e=>setProfile({...profile,email:e.target.value})}/>
                <Sel label="Profession" options={PROFESSIONS} value={profile.prof} onChange={e=>setProfile({...profile,prof:e.target.value})}/>
                <Btn green>Enregistrer</Btn>
              </Card>
              <Card style={{padding:24,marginBottom:16}}>
                <h3 style={{fontWeight:700,marginBottom:14,fontSize:15}}>Compte PayPal</h3>
                <Inp label="Adresse PayPal" type="email" value={profile.paypal} onChange={e=>setProfile({...profile,paypal:e.target.value})} hint="💸 Vos paiements sont envoyés automatiquement sur cette adresse PayPal après chaque étude validée."/>
                <Btn green>Mettre à jour PayPal</Btn>
              </Card>
              <Card style={{padding:24}}>
                <h3 style={{fontWeight:700,marginBottom:14,fontSize:15}}>Sécurité</h3>
                <Inp label="Nouveau mot de passe" type="password" placeholder="••••••••"/>
                <Inp label="Confirmer" type="password" placeholder="••••••••"/>
                <Btn green>Changer le mot de passe</Btn>
              </Card>
            </div>
          )}
        </main>
      </div>

      {/* MODAL: Study detail */}
      {showStudyDetail&&(
        <Modal onClose={()=>setShowStudyDetail(null)} title={showStudyDetail.title} wide>
          <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
            <Tag color={C.accent}>{showStudyDetail.theme}</Tag>
            <Tag color={C.muted}>⏱ {showStudyDetail.dur}</Tag>
            <Tag color={showStudyDetail.mode==="IA"?C.accentLight:C.muted}>{showStudyDetail.mode==="IA"?"🤖 IA":"🔗 Lien"}</Tag>
          </div>
          <p style={{fontSize:14,lineHeight:1.7,color:C.muted,marginBottom:20}}>{showStudyDetail.desc}</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
            {[["Chercheur",showStudyDetail.researcher],["Entreprise",showStudyDetail.company],["Date limite",showStudyDetail.deadline],["Rémunération",showStudyDetail.pay+"€"]].map(([k,v])=>(
              <div key={k} style={{background:C.surfaceHigh,borderRadius:10,padding:"10px 14px"}}><div style={{color:C.muted,fontSize:11,marginBottom:2}}>{k}</div><div style={{fontWeight:700,fontSize:k==="Rémunération"?18:14,color:k==="Rémunération"?C.green:C.text}}>{v}</div></div>
            ))}
          </div>
          <div style={{display:"flex",gap:10}}>
            <Btn green full onClick={()=>joinStudy(showStudyDetail.id)}>Participer à cette étude — {showStudyDetail.pay}€</Btn>
          </div>
        </Modal>
      )}

      {/* MODAL: Withdraw */}
      {showWithdraw&&(
        <Modal onClose={()=>setShowWithdraw(false)} title={withdrawDone?"":"Retirer mes gains"}>
          {!withdrawDone?(
            <>
              <p style={{color:C.muted,fontSize:13,marginBottom:16}}>Le virement sera effectué sur votre PayPal sous 24–48h.</p>
              <Card style={{padding:"16px",marginBottom:16,border:`1px solid ${C.green}44`}}>
                <div style={{fontSize:12,color:C.muted}}>Compte PayPal de destination</div>
                <div style={{fontWeight:700,marginTop:2,fontSize:15}}>{profile.paypal}</div>
              </Card>
              <div style={{display:"flex",justifyContent:"space-between",padding:"14px 0",borderTop:`1px solid ${C.border}`,borderBottom:`1px solid ${C.border}`,marginBottom:16}}>
                <span style={{color:C.muted}}>Montant à retirer</span>
                <strong style={{color:C.green,fontSize:20}}>{earnings.toFixed(2)}€</strong>
              </div>
              <Btn full green disabled={!profile.paypal||earnings<=0} onClick={()=>{if(!profile.paypal){alert("Veuillez renseigner votre adresse PayPal dans Paramètres.");return;}if(earnings<=0){alert("Aucun gain à retirer.");return;}setWithdrawDone(true);}}>Confirmer le retrait → PayPal</Btn>
              <p style={{fontSize:11,color:C.muted,marginTop:8,textAlign:"center"}}>🔒 Transfert sécurisé via PayPal Payouts API</p>
            </>
          ):(
            <div style={{textAlign:"center",padding:"16px 0"}}>
              <div style={{width:60,height:60,borderRadius:"50%",background:C.greenGlow,border:`2px solid ${C.green}`,color:C.green,fontSize:26,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px"}}>✓</div>
              <h3 style={{fontSize:20,fontWeight:800,marginBottom:6}}>Virement initié !</h3>
              <p style={{color:C.muted,marginBottom:4}}>Vous recevrez <strong style={{color:C.green}}>{earnings.toFixed(2)}€</strong> sur PayPal.</p>
              <p style={{fontSize:12,color:C.muted,marginBottom:20}}>{profile.paypal} · Délai 24–48h</p>
              <Btn green onClick={()=>setShowWithdraw(false)}>Fermer</Btn>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  ADMIN PANEL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function AdminPanel({onLogout}){
  const [tab,setTab]=useState("dashboard");
  const [users]=useState([
  
    {id:3,name:"Lucas Petit",email:"lucas@foodinsights.fr",role:"Researcher",joined:"20 mars 2026",studies:5,status:"active"},
    {id:4,name:"Amira Kadi",email:"amira@bnp.com",role:"Researcher",joined:"10 fév 2026",studies:8,status:"suspended"},
  ]);
  const sideItems=[{id:"dashboard",icon:"⬡",label:"Dashboard"},{id:"users",icon:"👥",label:"Utilisateurs"},{id:"studies",icon:"📋",label:"Études"},{id:"transactions",icon:"💳",label:"Transactions"},{id:"settings",icon:"⚙️",label:"Paramètres"}];
  return(
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",fontFamily:FONT}}>
      <header style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 28px",borderBottom:`1px solid ${C.border}`,background:C.surface}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}><Logo/><Tag color={C.orange} style={{marginLeft:4}}>Admin</Tag></div>
        <Btn secondary small onClick={onLogout}>Déconnexion</Btn>
      </header>
      <div style={{display:"flex",flex:1}}>
        <nav style={{width:210,borderRight:`1px solid ${C.border}`,padding:"20px 0",display:"flex",flexDirection:"column",gap:2,background:C.surface}}>
          {sideItems.map(t=>(<button key={t.id} onClick={()=>setTab(t.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 18px",background:tab===t.id?"rgba(248,124,58,.12)":"transparent",borderLeft:tab===t.id?`3px solid ${C.orange}`:"3px solid transparent",border:"none",color:tab===t.id?C.orange:C.muted,fontSize:13,fontWeight:tab===t.id?700:400,cursor:"pointer",textAlign:"left"}}><span>{t.icon}</span>{t.label}</button>))}
        </nav>
        <main style={{flex:1,padding:"28px 32px",overflowY:"auto",background:C.bg}}>
          {tab==="dashboard"&&(
            <div>
              <h1 style={{fontSize:22,fontWeight:800,marginBottom:20}}>Administration</h1>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:28}}>
                {[
                  {l:"Utilisateurs total",v:ADMIN_STATS.users,c:C.accentLight,i:"👥"},
                  {l:"Chercheurs",v:ADMIN_STATS.researchers,c:C.accent,i:"🔬"},
                  {l:"Participants",v:ADMIN_STATS.participants,c:C.green,i:"🙋"},
                  {l:"Études publiées",v:ADMIN_STATS.studies,c:C.yellow,i:"📋"},
                  {l:"Revenus plateforme",v:ADMIN_STATS.revenue+"€",c:C.green,i:"💰"},
                  {l:"Paiements en attente",v:ADMIN_STATS.pending,c:C.red,i:"⏳"},
                ].map(s=>(<Card key={s.l} style={{padding:"18px 20px"}}><div style={{fontSize:20,marginBottom:8}}>{s.i}</div><div style={{fontSize:24,fontWeight:900,color:s.c,marginBottom:2}}>{s.v}</div><div style={{fontSize:12,color:C.muted}}>{s.l}</div></Card>))}
              </div>
            </div>
          )}
          {tab==="users"&&(
            <div>
              <h1 style={{fontSize:22,fontWeight:800,marginBottom:20}}>Utilisateurs</h1>
              <Card style={{overflow:"hidden"}}>
                <div style={{display:"grid",gridTemplateColumns:"2fr 2fr 1fr 1fr 1fr 1fr",padding:"10px 20px",borderBottom:`1px solid ${C.border}`,fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:.6}}>
                  <span>Nom</span><span>Email</span><span>Rôle</span><span>Inscrit</span><span>Statut</span><span>Action</span>
                </div>
                {users.map(u=>(
                  <div key={u.id} style={{display:"grid",gridTemplateColumns:"2fr 2fr 1fr 1fr 1fr 1fr",padding:"14px 20px",borderBottom:`1px solid ${C.border}`,alignItems:"center",fontSize:13}}>
                    <span style={{fontWeight:700}}>{u.name}</span>
                    <span style={{color:C.muted}}>{u.email}</span>
                    <Tag color={u.role==="Researcher"?C.accent:C.green}>{u.role}</Tag>
                    <span style={{color:C.muted}}>{u.joined}</span>
                    <Tag color={u.status==="active"?C.green:C.red}>{u.status}</Tag>
                    <Btn secondary small>{u.status==="active"?"Suspendre":"Réactiver"}</Btn>
                  </div>
                ))}
              </Card>
            </div>
          )}
          {tab==="transactions"&&(
            <div>
              <h1 style={{fontSize:22,fontWeight:800,marginBottom:20}}>Transactions</h1>
              <Card style={{overflow:"hidden"}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",padding:"10px 20px",borderBottom:`1px solid ${C.border}`,fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:.6}}>
                  <span>Description</span><span>Utilisateur</span><span>Date</span><span>Montant</span>
                </div>
                {[
                  {d:"Commission plateforme",u:"StudyReach",date:"03 juin 2026",a:"+3€",c:C.accent},
                  {d:"Recharge portefeuille",u:"Lucas Petit",date:"01 juin 2026",a:"+100€",c:C.green},
                  {d:"Paiement participant",u:"Paul Durand",date:"01 juin 2026",a:"-40€",c:C.red},
                ].map((t,i)=>(
                  <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",padding:"13px 20px",borderBottom:`1px solid ${C.border}`,fontSize:13,alignItems:"center"}}>
                    <span style={{fontWeight:600}}>{t.d}</span><span style={{color:C.muted}}>{t.u}</span><span style={{color:C.muted}}>{t.date}</span><span style={{fontWeight:800,color:t.c}}>{t.a}</span>
                  </div>
                ))}
              </Card>
            </div>
          )}
          {tab==="settings"&&(
            <div style={{maxWidth:500}}>
              <h1 style={{fontSize:22,fontWeight:800,marginBottom:20}}>Paramètres plateforme</h1>
              <Card style={{padding:24,marginBottom:16}}>
                <h3 style={{fontWeight:700,marginBottom:14,fontSize:15}}>Commission plateforme</h3>
                <Inp label="Commission par transaction (%)" defaultValue="10"/>
                <Inp label="Délai de paiement participant (heures)" defaultValue="48"/>
                <Btn>Enregistrer</Btn>
              </Card>
              <Card style={{padding:24}}>
                <h3 style={{fontWeight:700,marginBottom:14,fontSize:15}}>Clés API</h3>
                <Inp label="PayPal Client ID" defaultValue="AZert…"/>
                <Inp label="PayPal Secret" type="password" defaultValue="••••••••••"/>
                <Inp label="Stripe Publishable Key" defaultValue="pk_live_…"/>
                <Btn>Mettre à jour</Btn>
              </Card>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  LEGAL PAGES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function LegalPage({type,onBack}){
  const content={
    terms:{title:"Conditions Générales d'Utilisation",sections:[{t:"1. Objet",c:"Les présentes CGU régissent l'utilisation de la plateforme StudyReach, accessible depuis studyreach.io. En créant un compte, vous acceptez sans réserve les présentes conditions."},  {t:"2. Inscription",c:"L'inscription est gratuite. Vous devez fournir des informations exactes. Vous êtes responsable de la confidentialité de vos identifiants."},{t:"3. Services",c:"StudyReach permet à des chercheurs de recruter des participants pour des études qualitatives. Les chercheurs paient par participant recruté. Les participants reçoivent une rémunération via PayPal."},{t:"4. Tarification",c:"Les tarifs sont de 20€ pour 10 min, 30€ pour 20 min et 40€ pour 45 min par participant. Une option entretiens IA est disponible pour +10€ par étude. StudyReach prélève 10% de frais de service sur la rémunération de chaque participant. Le client paie un prix fixe, les participants reçoivent 90% de ce montant. Ces tarifs peuvent évoluer."},{t:"5. Paiements",c:"Les paiements des chercheurs sont effectués par carte bancaire. Les paiements aux participants sont effectués via l'API PayPal Payouts dans un délai de 24 à 48h après validation."},{t:"6. Résiliation",c:"Vous pouvez supprimer votre compte à tout moment depuis vos paramètres. StudyReach se réserve le droit de suspendre tout compte en cas de non-respect des présentes CGU."}]},
    privacy:{title:"Politique de Confidentialité",sections:[{t:"1. Données collectées",c:"Nous collectons : nom, prénom, adresse e-mail, profession, adresse PayPal (participants), données de paiement (chercheurs), et données d'utilisation anonymisées."},{t:"2. Utilisation",c:"Ces données sont utilisées pour fournir le service, effectuer les paiements, améliorer la plateforme et, avec votre consentement, vous envoyer des communications."},{t:"3. RGPD",c:"Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, d'effacement, de portabilité et d'opposition. Exercez vos droits via votre espace paramètres ou à privacy@studyreach.io."},{t:"4. Conservation",c:"Vos données sont conservées pendant la durée de votre compte + 3 ans (obligations légales). Les données de paiement sont conservées 10 ans."},{t:"5. Sécurité",c:"Nous utilisons le chiffrement SSL, le hachage des mots de passe et des audits de sécurité réguliers pour protéger vos données."}]},
  };
  const page=content[type]||content.terms;
  return(
    <div style={{minHeight:"100vh"}}>
      <header style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"18px 56px",borderBottom:`1px solid ${C.border}`}}>
        <Logo/><Btn secondary small onClick={onBack}>← Retour</Btn>
      </header>
      <div style={{maxWidth:720,margin:"40px auto",padding:"0 24px"}}>
        <h1 style={{fontSize:30,fontWeight:900,marginBottom:8}}>{page.title}</h1>
        <p style={{color:C.muted,fontSize:13,marginBottom:36}}>Dernière mise à jour : 1er juin 2026</p>
        {page.sections.map(s=>(<div key={s.t} style={{marginBottom:28}}><h2 style={{fontSize:17,fontWeight:700,marginBottom:8,color:C.accentLight}}>{s.t}</h2><p style={{color:C.muted,fontSize:14,lineHeight:1.8}}>{s.c}</p></div>))}
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  ROOT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export default function App(){
  const [view,setView]=useState("landing");
  const [role,setRole]=useState(null);

  const nav=(v)=>{
    if(v==="landing"){setRole(null);}
    setView(v);
  };
  const authDone=(r)=>{setRole(r);setView(r);};

  return(
    <div style={{background:C.bg,minHeight:"100vh",color:C.text,fontFamily:FONT}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:5px;height:5px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px;}
        button{font-family:inherit;}
        input,select{font-family:inherit;}
        a{transition:opacity .15s;}
        a:hover{opacity:.7;}
        button:not(:disabled):hover{filter:brightness(1.08);}
      `}</style>

      {view==="landing"&&<Landing onNav={nav}/>}
      {(view==="signup-researcher"||view==="login-researcher")&&<AuthPage type={view} onDone={authDone} onNav={nav}/>}
      {(view==="signup-participant"||view==="login-participant")&&<AuthPage type={view} onDone={authDone} onNav={nav}/>}
      {view==="researcher"&&<ResearcherDashboard onLogout={()=>nav("landing")}/>}
      {view==="participant"&&<ParticipantDashboard onLogout={()=>nav("landing")}/>}
      {view==="admin"&&<AdminPanel onLogout={()=>nav("landing")}/>}
      {view==="terms"&&<LegalPage type="terms" onBack={()=>nav("landing")}/>}
      {view==="privacy"&&<LegalPage type="privacy" onBack={()=>nav("landing")}/>}

      {/* Admin shortcut */}
      {view==="landing"&&(
        <div style={{position:"fixed",bottom:16,right:16}}>
          <Btn secondary small onClick={()=>nav("admin")} style={{fontSize:11,opacity:.5}}>Admin ⚙️</Btn>
        </div>
      )}
    </div>
  );
}
