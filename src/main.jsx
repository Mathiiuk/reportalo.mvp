import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
// Manrope local: se empaqueta con la app y el service worker la precachea, así el primer
// pintado no depende de la red (antes venía de Google Fonts y bloqueaba el arranque)
import '@fontsource-variable/manrope';
import './index.css';

// Limpieza automática de Service Workers antiguos en entorno de desarrollo para evitar conflictos con Vite ESM/HMR
if (typeof window !== 'undefined' && 'serviceWorker' in navigator && import.meta.env.DEV) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
    }
  });
}

// Punto de entrada principal de la aplicación
const rootElement = document.getElementById('root');

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
