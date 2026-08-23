// ==============================================================================
// Punto de Entrada Principal (main.jsx)
// ==============================================================================

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from './context/AuthContext';
import { OnboardingProvider } from './context/OnboardingContext';
import App from './App';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <OnboardingProvider>
          <App />
          {/* Toaster de notificaciones modernas con Sonner */}
          <Toaster
            richColors
            position="top-right"
            closeButton
            duration={4000}
          />
        </OnboardingProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
