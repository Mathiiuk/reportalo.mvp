import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
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
