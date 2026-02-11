import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import config from './config'
import './index.css'
import App from './App.jsx'

const rootElement = document.getElementById('root');
const clientId = config.auth.googleClientId;

createRoot(rootElement).render(
  <StrictMode>
    {clientId ? (
      <GoogleOAuthProvider clientId={clientId}>
        <App />
      </GoogleOAuthProvider>
    ) : (
      <App />
    )}
  </StrictMode>,
)
