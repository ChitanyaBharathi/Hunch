import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { InsightsApp } from './insights/InsightsApp.jsx'

const isInsights = window.location.pathname.startsWith('/insights');

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isInsights ? <InsightsApp /> : <App />}
  </StrictMode>,
)
