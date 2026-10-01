import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { useIsDesktopLayout } from '../hooks/useMediaQuery';
import { BrandBar } from '../components/layout/BrandBar';
import { HeroMap } from '../components/common/HeroMap';
import { AlertCircle, Shield, Sparkles, Map as MapIcon } from 'lucide-react';

// Las tres promesas de la portada (M01 en columna, D01 en fila)
const PROMISES = [
  { icon: Shield, label: 'Anónimo ante el organismo receptor' },
  { icon: Sparkles, label: 'La IA encuentra a quién corresponde' },
  { icon: MapIcon, label: 'Seguimiento hasta resolverse' },
];

const HERO_GRADIENT = 'linear-gradient(165deg, rgb(42, 123, 214), rgb(21, 83, 158))';

const AuthErrorAlert = ({ message, onClose }) => (
  <div
    role="alert"
    className="mt-4 flex w-full max-w-[480px] items-center gap-2 rounded-xl border border-white/30 bg-red-500/20 p-3 text-xs font-medium text-white"
  >
    <AlertCircle className="h-4 w-4 flex-shrink-0 text-white" strokeWidth={2.25} />
    <span className="flex-1 text-left">{message}</span>
    <button onClick={onClose} type="button" className="ml-1 cursor-pointer border-0 bg-transparent font-bold text-white hover:opacity-80">
      ✕
    </button>
  </div>
);

export const WelcomePage = () => {
  const navigate = useNavigate();
  const { authError, clearError } = useAuth();
  const isDesktop = useIsDesktopLayout();

  // Transición a la pantalla de acceso
  const handleStart = () => {
    navigate('/login');
  };

  // D01 · Landing en navegador (UJ v3.3, REP-3791 Bloque 11-C): barra blanca con la marca e
  // «Ingresar»; héroe azul con el isotipo, el titular, un solo CTA y las tres promesas en fila.
  if (isDesktop) {
    return (
      <div className="flex min-h-[100dvh] w-full select-none flex-col bg-rep-surface font-manrope">
        <BrandBar>
          {/* No está en D01: se conserva para no dejar sin entrada la portada de municipios (ver README 11-C) */}
          <Link
            to="/municipios"
            className="rep-focus flex min-h-touch items-center rounded px-2 text-rep-label-d font-semibold text-rep-ink-muted no-underline transition-colors hover:text-rep-accent"
          >
            Para municipios
          </Link>
          <button
            onClick={handleStart}
            type="button"
            className="rep-focus min-h-touch cursor-pointer rounded border-0 bg-transparent px-3 text-rep-body-d font-bold text-rep-accent transition-colors hover:text-rep-accent-strong"
          >
            Ingresar
          </button>
        </BrandBar>

        <main
          className="relative flex flex-1 items-center justify-center overflow-hidden px-10 py-16 text-center text-white"
          style={{ background: HERO_GRADIENT }}
        >
          {/* D01: «el fondo es el mapa de la ciudad con velo azul». REP-3802: mapa real y en movimiento */}
          <HeroMap />
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="relative flex max-w-[760px] flex-col items-center"
          >
            <span className="flex h-[84px] w-[84px] items-center justify-center rounded-[24px] bg-white shadow-[0_12px_30px_rgba(10,40,90,0.25)]">
              <img src="/logo-icon.webp" alt="Reportalo" className="h-[54px] w-[42px] object-contain" />
            </span>

            <h1 className="m-0 mt-7 text-[44px] font-extrabold leading-[1.1] tracking-[-1px] text-white">
              Reportá lo que ves en tu ciudad
            </h1>
            <p className="m-0 mt-4 max-w-[540px] text-[17px] font-medium leading-[1.55] text-white/85">
              Con evidencia verificada y tu identidad protegida. Entrás con tu correo, sin crear contraseña.
            </p>

            {authError && <AuthErrorAlert message={authError} onClose={clearError} />}

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleStart}
              type="button"
              className="rep-focus mt-8 min-h-touch cursor-pointer rounded-[14px] border-0 bg-white px-12 py-4 text-rep-button text-rep-accent shadow-[0px_8px_18px_rgba(0,0,0,0.14)] hover:opacity-95"
            >
              Comenzar
            </motion.button>

            <ul className="m-0 mt-14 grid list-none grid-cols-3 gap-12 p-0">
              {PROMISES.map(({ icon: Icon, label }) => (
                <li key={label} className="flex flex-col items-center gap-2.5">
                  <Icon aria-hidden="true" className="h-[22px] w-[22px] text-[#9FD0FF]" strokeWidth={2.25} />
                  <span className="max-w-[180px] text-rep-body-d font-semibold leading-snug text-white/95">{label}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </main>
      </div>
    );
  }

  // M01 · Bienvenida en el teléfono (sin cambios de diseño en este bloque)
  return (
    <div className="flex min-h-[100dvh] w-full select-none flex-col bg-rep-surface font-manrope">
      <main
        className="flex min-h-[100dvh] flex-1 flex-col justify-between px-6 pt-[max(env(safe-area-inset-top),24px)] pb-[max(env(safe-area-inset-bottom),28px)] text-white"
        style={{ background: HERO_GRADIENT }}
      >
        {/* Zona superior / Hero con animación Framer Motion */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="flex max-w-[560px] flex-1 flex-col items-center justify-center py-4 text-center"
        >
          {/* Logo oficial de Reportalo sin fondo */}
          <img src="/logo-icon.webp" alt="Reportalo Logo" className="mb-4 h-[62px] w-[48px] object-contain" />

          {/* Título principal */}
          <h1 className="text-[32px] font-extrabold leading-tight tracking-[-0.6px] text-white">Reportalo</h1>

          {/* Bajada explicativa */}
          <p className="mt-[11px] max-w-[280px] text-[14px] font-medium leading-[1.55] text-white/90">
            Reportá lo que ves en tu ciudad, con evidencia verificada y tu identidad protegida.
          </p>

          {/* Mensaje de error si la autenticación con OAuth falla */}
          {authError && <AuthErrorAlert message={authError} onClose={clearError} />}

          {/* Lista de beneficios diferenciales */}
          <div className="mt-[26px] flex w-full max-w-[300px] flex-col gap-[12px]">
            {PROMISES.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-[10px]">
                <Icon className="h-[19px] w-[19px] flex-shrink-0 text-[#9FD0FF]" strokeWidth={2.25} />
                <span className="text-left text-[12.5px] font-semibold leading-snug text-white/95">{label}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Zona inferior de acción */}
        <div className="mx-auto flex w-full max-w-[320px] flex-col gap-[10px] pt-4">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleStart}
            type="button"
            className="w-full cursor-pointer rounded-[14px] border-0 bg-rep-surface px-6 py-[16px] text-center text-[15px] font-extrabold text-rep-accent shadow-[0px_8px_18px_rgba(0,0,0,0.14)] hover:opacity-95"
          >
            Comenzar
          </motion.button>
          <p className="m-0 px-[10px] text-center text-[11px] font-medium leading-[1.4] text-white/75">
            Entrás con tu correo, sin crear contraseña.
          </p>
        </div>
      </main>
    </div>
  );
};
