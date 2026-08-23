import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Map, FileText, Camera, Bell, User } from 'lucide-react';

const NAV_ITEMS = [
  { path: '/map', label: 'Mapa', icon: Map },
  { path: '/reports', label: 'Reportes', icon: FileText },
  null, // placeholder para el FAB de cámara
  { path: '/alerts', label: 'Alertas', icon: Bell },
  { path: '/profile', label: 'Perfil', icon: User },
];

export const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleReport = () => {
    // TODO: Abrir flujo de reporte con cámara
  };

  return (
    <nav className="absolute bottom-0 left-0 right-0 z-30 safe-bottom" role="navigation" aria-label="Navegación principal">
      <div className="relative mx-3 mb-2 bg-white/95 backdrop-blur-xl rounded-2xl shadow-lg border border-slate-200/60 px-1 py-1 flex items-center justify-around">
        {NAV_ITEMS.map((item, index) => {
          if (item === null) {
            return (
              <button
                key="report-fab"
                type="button"
                onClick={handleReport}
                className="flex items-center justify-center -mt-6 w-14 h-14 rounded-full bg-accent hover:bg-accent-hover active:scale-95 text-white shadow-lg shadow-accent/30 border-2 border-white transition-all cursor-pointer"
                aria-label="Reportar con foto"
              >
                <Camera className="w-6 h-6" strokeWidth={2.2} aria-hidden="true" />
              </button>
            );
          }

          const { path, label, icon: Icon } = item;
          const isActive = location.pathname === path;

          return (
            <button
              key={path}
              type="button"
              onClick={() => navigate(path)}
              className={`flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all cursor-pointer min-h-[48px] min-w-[56px] px-2 py-2 ${
                isActive
                  ? 'text-primary bg-primary-light'
                  : 'text-slate-400 active:bg-slate-100'
              }`}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon
                className={`w-5 h-5 ${isActive ? 'stroke-[2.4]' : 'stroke-[1.8]'}`}
                aria-hidden="true"
              />
              <span className={`text-[10px] leading-tight ${isActive ? 'font-bold' : 'font-semibold'}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
