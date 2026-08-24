// ==============================================================================
// Componente ErrorBoundary Global (ErrorBoundary.jsx)
// Captura errores de renderizado y muestra fallback en vez de pantalla blanca
// ==============================================================================

import React from 'react';
import { MapPinOff, RefreshCw } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary capturó un error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center bg-surface-muted px-6 text-center">
          <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mb-6">
            <MapPinOff className="w-10 h-10 text-red-400" strokeWidth={1.5} aria-hidden="true" />
          </div>

          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Algo salió mal
          </h1>

          <p className="text-sm text-slate-500 mt-2 max-w-xs leading-relaxed">
            La aplicación encontró un error inesperado. Probá recargar la página.
          </p>

          <button
            type="button"
            onClick={this.handleReload}
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-bold text-sm rounded-2xl shadow-sm hover:bg-primary-dark active:scale-[0.98] transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Recargar página
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
