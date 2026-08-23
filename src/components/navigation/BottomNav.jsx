import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Map, FileText, Bell, User } from 'lucide-react';

const NAV_ITEMS = [
  { path: '/map', label: 'Mapa', icon: Map },
  { path: '/reports', label: 'Reportes', icon: FileText },
  { path: '/alerts', label: 'Alertas', icon: Bell },
  { path: '/profile', label: 'Perfil', icon: User },
];

export const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="absolute bottom-0 left-0 right-0 z-30 safe-bottom">
      <div className="mx-3 mb-2 bg-white/95 backdrop-blur-xl rounded-2xl shadow-lg border border-slate-200/60 px-2 py-1.5 flex items-center justify-around">
        {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
          const isActive = location.pathname === path;

          return (
            <button
              key={path}
              type="button"
              onClick={() => navigate(path)}
              className={`flex flex-col items-center justify-center gap-0.5 px-3 py-2 rounded-xl transition-all cursor-pointer min-w-[64px] ${
                isActive
                  ? 'text-primary bg-primary-light'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
              }`}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon
                className={`w-5 h-5 ${isActive ? 'stroke-[2.4]' : 'stroke-[1.8]'}`}
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
