import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './providers/locale/i18n'
import './styles/index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
