import React from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';

export const NotFoundPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="w-full h-[100dvh] bg-rep-surface flex flex-col font-manrope overflow-hidden">
      {/* Header */}
      <div className="flex-none bg-rep-surface px-6 pt-[max(16px,env(safe-area-inset-top,16px))] pb-3 border-b border-rep-divider flex items-center">
        <Link to="/" className="flex items-center gap-2 no-underline text-inherit">
          <img src="/logo-icon.webp" alt="Reportalo" className="w-[19px] h-[25px] object-contain" />
          <span className="font-extrabold text-[18px] text-rep-ink tracking-[-0.4px]">
            Reportalo
          </span>
        </Link>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center text-center px-10 bg-rep-surface">
        <svg width="168" height="130" viewBox="0 0 140 108" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="66" y="16" width="7" height="82" rx="3" fill="#b8c3cf"></rect>
          <path d="M16 28h52v18H16l-9-9 9-9Z" fill="#fff" stroke="#c9d4e0" strokeWidth="2.5" strokeLinejoin="round"></path>
          <line x1="26" y1="37" x2="56" y2="37" stroke="#dde4ec" strokeWidth="4" strokeLinecap="round"></line>
          <g transform="rotate(19 106 66)">
            <path d="M71 58h52l9 9-9 9H71V58Z" fill="#fff" stroke="#c0392b" strokeWidth="2.5" strokeLinejoin="round"></path>
            <path d="M88 67h20" stroke="#c0392b" strokeWidth="4" strokeLinecap="round"></path>
            <path d="M96 61l-6 12" stroke="#c0392b" strokeWidth="2.5" strokeLinecap="round"></path>
          </g>
          <path d="M10 98h34" stroke="#cfd8e2" strokeWidth="5" strokeLinecap="round"></path>
          <path d="M56 98h16M84 98h14M110 98h20" stroke="#e2e8ef" strokeWidth="5" strokeLinecap="round"></path>
        </svg>

        <h1 className="font-extrabold text-[22px] text-rep-ink mt-3.5 mb-0 tracking-[-0.3px]">
          No encontramos esta página
        </h1>
        
        <p className="font-medium text-[13px] leading-[1.6] text-rep-ink-muted mt-2 mb-0 max-w-[450px] text-pretty">
          La dirección no corresponde a ninguna sección de Reportalo. Puede estar mal escrita o ser de una versión anterior del sitio.
        </p>

        <div className="mt-3.5 bg-rep-bg border border-rep-border rounded-[11px] px-4 py-2.5 text-left max-w-full overflow-hidden">
          <div className="font-bold text-[9px] text-rep-ink-faint tracking-[0.5px] mb-1">DIRECCIÓN</div>
          <div className="font-semibold text-[11px] font-mono text-rep-ink-label truncate">
            reportalo.ar{location.pathname}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3.5 mt-[18px]">
          <Link 
            to="/" 
            className="rep-focus inline-flex min-h-touch items-center rounded-[11px] bg-rep-accent px-6 text-[12.5px] font-extrabold text-rep-on-accent no-underline transition-colors hover:bg-rep-accent-strong"
          >
            Volver al inicio
          </Link>
          {/* UJ v3.3 · M31: la única salida es volver al inicio; no se le pide al usuario que
              reporte el error ni que copie la dirección (REP-3791 Bloque 9) */}
        </div>

        <div className="mt-5 flex items-center gap-1.5">
          <AlertCircle className="w-[14px] h-[14px] text-rep-ink-faint" strokeWidth={2.25} />
          <span className="font-semibold text-[10px] text-rep-ink-faint">Error 404 · ruta desconocida</span>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
