import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, MapPinOff } from 'lucide-react';
import { Button } from '../components/common/Button';

export const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-[100dvh] w-full bg-white flex flex-col items-center safe-top safe-bottom">
      <div className="w-full max-w-md mx-auto min-h-[100dvh] flex flex-col px-6 pt-6 pb-6">
        <header className="w-full flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 active:bg-slate-300 flex items-center justify-center text-slate-700 transition-all cursor-pointer"
            aria-label="Volver"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <img
            src="/logo-icon.webp"
            alt="Reportalo"
            className="w-7 h-8 object-contain select-none"
          />

          <div className="w-10" />
        </header>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="flex-1 flex flex-col items-center justify-center text-center"
        >
          <div className="relative mb-6">
            <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center">
              <MapPinOff className="w-12 h-12 text-slate-300" strokeWidth={1.5} />
            </div>
            <span className="absolute -top-1 -right-1 text-5xl font-black text-slate-200 select-none">
              404
            </span>
          </div>

          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Página no encontrada
          </h1>

          <p className="text-sm text-slate-500 mt-2 max-w-xs leading-relaxed">
            Parece que esta dirección no existe o fue movida a otro lugar.
          </p>

          <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-slate-500 bg-slate-50 px-4 py-2 rounded-full border border-slate-100">
            <span>La ruta no coincide con ningún reporte conocido</span>
          </div>
        </motion.div>

        <div className="w-full pb-4 flex flex-col gap-3">
          <Button onClick={() => navigate('/map')}>
            Volver al mapa
          </Button>
          <Button variant="ghost" onClick={() => navigate('/')}>
            Ir al inicio
          </Button>
        </div>
      </div>
    </div>
  );
};
