import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter/wght.css'
import './index.css'
import { PaymentSuccessPage } from './PaymentSuccessPage'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PaymentSuccessPage />
  </StrictMode>,
)
