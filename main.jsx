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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <Analytics beforeSend={(event) => (isDevVisitor ? null : event)} />
  </React.StrictMode>
)
