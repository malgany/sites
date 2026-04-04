import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter/wght.css'
import './index.css'
import { PaymentSuccessPage } from './PaymentSuccessPage'
import { initializeMetaPixel } from './lib/metaPixel'

initializeMetaPixel()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PaymentSuccessPage />
  </StrictMode>,
)
