// ==============================================================================
// Componente Raíz de la Aplicación (App.jsx)
// ==============================================================================

import React from 'react';
import { AppRoutes } from './routes';

export const App = () => {
  return (
    <div className="w-full min-h-screen bg-surface-muted text-content-primary font-sans">
      <AppRoutes />
    </div>
  );
};

export default App;
