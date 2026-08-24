import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  ShieldCheck,
  Download,
  ChevronRight,
  CheckCircle,
  Moon,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useDarkMode } from '../hooks/useDarkMode';
import { toast } from 'sonner';

const MENU_ITEMS = [
  { icon: Bell, label: 'Novedades', action: 'novedades' },
  { icon: ShieldCheck, label: 'Permisos de la app', action: 'permisos' },
  { icon: Download, label: 'Descargar mis datos', action: 'descargar' },
];

export const PerfilPage = () => {
  const { user, signOut } = useAuth();
  const { isDark, toggleDark } = useDarkMode();
  const navigate = useNavigate();

  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'Usuario';

  const email = user?.email || '';

  const initials = displayName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success('Sesión cerrada');
      navigate('/', { replace: true });
    } catch {
      toast.error('No se pudo cerrar sesión');
    }
  };

  const handleDeleteAccount = () => {
    toast.info('Función disponible próximamente');
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col" style={{ background: 'var(--color-bg)' }}>
      <div className="flex-1 overflow-y-auto pb-28 px-4 pt-6 safe-top">
        {/* Avatar + Saludo */}
        <div className="flex items-center gap-3 mb-5">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-[17px] font-extrabold flex-shrink-0"
            style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}
            aria-hidden="true"
          >
            {initials}
          </div>
          <div>
            <p className="text-[15px] font-extrabold" style={{ color: 'var(--color-text-primary)' }}>
              Hola {displayName.split(' ')[0]}
            </p>
            <p className="text-[11px] font-medium mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
              {email}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-2 mb-4">
          <StatCard value="7" label="REPORTES" color="var(--color-primary)" />
          <StatCard value="3" label="RESUELTOS" color="var(--color-success)" />
          <StatCard value="1" label="SIN ENVIAR" color="var(--color-accent)" />
        </div>

        {/* Menú */}
        <div className="rounded-[13px] overflow-hidden mb-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          {MENU_ITEMS.map((item, i) => (
            <button
              key={item.action}
              type="button"
              className="w-full flex items-center gap-2.5 px-3 py-3.5 text-left transition-colors active:opacity-70 cursor-pointer touch-target"
              style={{ borderBottom: i < MENU_ITEMS.length - 1 ? '1px solid var(--color-border)' : undefined }}
            >
              <item.icon
                className="w-5 h-5 flex-shrink-0"
                style={{ color: 'var(--color-primary)' }}
                strokeWidth={1.8}
                aria-hidden="true"
              />
              <span className="flex-1 text-[12px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {item.label}
              </span>
              <ChevronRight className="w-[18px] h-[18px] flex-shrink-0" style={{ color: 'var(--color-text-secondary)' }} aria-hidden="true" />
            </button>
          ))}

          {/* Dark mode toggle */}
          <div
            className="flex items-center gap-2.5 px-3 py-3.5 touch-target"
          >
            <Moon
              className="w-5 h-5 flex-shrink-0"
              style={{ color: 'var(--color-primary)' }}
              strokeWidth={1.8}
              aria-hidden="true"
            />
            <span className="flex-1 text-[12px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              Modo oscuro
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={isDark}
              onClick={toggleDark}
              className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                isDark ? 'bg-primary' : 'bg-slate-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  isDark ? 'translate-x-5' : 'translate-x-0.5'
                } mt-0.5`}
              />
            </button>
          </div>
        </div>

        {/* Términos aceptados */}
        <div className="rounded-[13px] px-3 py-3 mb-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <div className="flex items-center gap-2">
            <CheckCircle
              className="w-[18px] h-[18px] flex-shrink-0"
              style={{ color: 'var(--color-success)' }}
              strokeWidth={2}
              aria-hidden="true"
            />
            <span className="text-[11.5px] font-bold" style={{ color: 'var(--color-text-primary)' }}>
              Términos aceptados
            </span>
          </div>
          <p className="text-[10.5px] leading-[1.45] mt-1.5" style={{ color: 'var(--color-text-secondary)' }}>
            Versión 1.2 · 14/08/2026 a las 14:28. Incluye el tratamiento de
            imágenes en servidor.
          </p>
          <button
            type="button"
            className="text-[10.5px] font-bold mt-2 cursor-pointer touch-target"
            style={{ color: 'var(--color-primary)' }}
          >
            Ver el texto aceptado
          </button>
        </div>

        {/* Logout + Delete */}
        <div className="flex flex-col gap-2 mt-4">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full py-3 rounded-xl text-[12.5px] font-bold transition-colors active:opacity-70 cursor-pointer touch-target"
            style={{ border: '1.5px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
          >
            Cerrar sesión
          </button>
          <button
            type="button"
            onClick={handleDeleteAccount}
            className="text-center text-[10.5px] font-semibold cursor-pointer touch-target py-2"
            style={{ color: 'var(--color-danger)' }}
          >
            Eliminar mi cuenta y mis datos
          </button>
        </div>
      </div>
    </div>
  );
};

function StatCard({ value, label, color }) {
  return (
    <div
      className="flex-1 rounded-xl py-2.5 text-center"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <div
        className="text-[19px] font-extrabold leading-none"
        style={{ color }}
      >
        {value}
      </div>
      <div className="text-[8.5px] font-bold mt-1 tracking-[0.3px]" style={{ color: 'var(--color-text-secondary)' }}>
        {label}
      </div>
    </div>
  );
}
