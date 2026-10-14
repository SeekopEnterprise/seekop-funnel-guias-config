import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ParentApp from './ParentApp.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ParentApp />
  </StrictMode>,
)
