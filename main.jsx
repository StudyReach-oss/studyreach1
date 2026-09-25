import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { Analytics } from '@vercel/analytics/react'

// Exclut tes propres visites des statistiques Vercel Analytics.
// Ouvre une fois l'URL avec ?sr_dev=1 sur chaque appareil/navigateur que tu utilises
// (ex: https://www.getstudyreach.com/?sr_dev=1) : le flag reste posé ensuite (localStorage),
// pas besoin de répéter à chaque visite. Les vrais visiteurs ne voient jamais ce paramètre.
try {
  if (new URLSearchParams(window.location.search).get('sr_dev') === '1') {
    localStorage.setItem('sr_dev', '1')
  }
} catch (e) {}

const isDevVisitor = (() => {
  try { return localStorage.getItem('sr_dev') === '1' } catch (e) { return false }
})()

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  TRACKING DES VISITES → table Supabase "page_visits"
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Une ligne par page vue (chargement + navigation interne).
// Échoue toujours en silence : ne doit jamais casser le site.
const SR_SUPA_URL = 'https://bwaoxwfkqqpqvtpynwzh.supabase.co'
const SR_SUPA_KEY = 'sb_publishable_SsnkELg6dLx--AjHaW0ShA_N1ISmMKg'

function srSessionId() {
  try {
    let id = sessionStorage.getItem('sr_visit_session')
    if (!id) {
      id = crypto.randomUUID
        ? crypto.randomUUID()
        : 'sid-' + Date.now() + '-' + Math.random().toString(36).slice(2)
      sessionStorage.setItem('sr_visit_session', id)
    }
    return id
  } catch (e) { return null }
}

let srLastPath = null
let srFirstHit = true
function trackPageVisit() {
  try {
    const path = window.location.pathname
    if (path === srLastPath) return
    srLastPath = path
    const p = new URLSearchParams(window.location.search)
    const first = srFirstHit
    srFirstHit = false
    fetch(SR_SUPA_URL + '/rest/v1/page_visits', {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        'apikey': SR_SUPA_KEY,
        'Authorization': 'Bearer ' + SR_SUPA_KEY,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        session_id: srSessionId(),
        path,
        referrer: first ? (document.referrer || null) : null,
        utm_source: p.get('utm_source'),
        utm_medium: p.get('utm_medium'),
        utm_campaign: p.get('utm_campaign'),
        user_agent: navigator.userAgent,
        is_dev: isDevVisitor,
      }),
    }).catch(() => {})
  } catch (e) {}
}

try {
  const origPush = window.history.pushState
  window.history.pushState = function () {
    const r = origPush.apply(this, arguments)
    setTimeout(trackPageVisit, 0)
    return r
  }
  window.addEventListener('popstate', () => setTimeout(trackPageVisit, 0))
  trackPageVisit()
} catch (e) {}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  TRANSITION EN FONDU AU MONTAGE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Le contenu de #root est remplacé de façon synchrone au montage de React
// (le vrai texte pré-rendu disparaît, remplacé par le rendu React — voir
// scripts/prerender.mjs). Pour que ce remplacement se voie comme un fondu
// plutôt qu'un saut : on passe l'opacité à 0 juste avant .render(), puis à 1
// juste après, dans un double requestAnimationFrame. Le double rAF garantit
// que le navigateur a bien peint l'état opacity:0 avant qu'on ne redemande
// opacity:1, sinon les deux changements sont fusionnés dans la même frame et
// la transition CSS (définie sur #root dans index.html) ne se déclenche pas.
const rootEl = document.getElementById('root')
rootEl.style.opacity = '0'

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <App />
    <Analytics beforeSend={(event) => (isDevVisitor ? null : event)} />
  </React.StrictMode>
)

requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    rootEl.style.opacity = '1'
  })
})
