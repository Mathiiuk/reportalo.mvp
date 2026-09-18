import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload(true);
  };

  render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message?.toLowerCase() || '';
      const isChunkError = errorMsg.includes('fetch') || errorMsg.includes('import') || errorMsg.includes('load');

      return (
        <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center bg-[#F4F7FB] p-6 font-manrope">
          <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-6 shadow-sm">
            <WifiOff className="w-8 h-8" />
          </div>
          <h1 className="text-[22px] font-extrabold text-[#263249] mb-3 text-center leading-tight">
            Oops, hubo un problema
          </h1>
          <p className="text-[15px] text-[#5B6A7A] mb-8 text-center max-w-[280px]">
            {isChunkError 
              ? 'Parece que la aplicación se actualizó y algunos archivos no están disponibles sin conexión. Por favor, recargá la página.'
              : 'Ocurrió un error inesperado al cargar la pantalla. Por favor, volvé a intentarlo.'}
          </p>
          <button
            onClick={this.handleReload}
            className="flex items-center gap-2 bg-[#1E6FCB] text-white px-6 py-3.5 rounded-[14px] font-bold shadow-[0_8px_18px_rgba(30,111,203,0.3)] active:scale-95 transition-all cursor-pointer"
          >
            <RefreshCw className="w-5 h-5" />
            Recargar aplicación
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
