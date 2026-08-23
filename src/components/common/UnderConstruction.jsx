import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Construction, Clock } from 'lucide-react';
import { Button } from './Button';
import { BottomNav } from '../navigation/BottomNav';
import { CameraReportButton } from '../navigation/CameraReportButton';

export const UnderConstruction = ({ title, description, icon: Icon = Construction }) => {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-[100dvh] w-full bg-white flex flex-col items-center safe-top safe-bottom">
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
          className="flex-1 flex flex-col items-center justify-center text-center pb-24"
        >
          <div className="w-20 h-20 rounded-3xl bg-amber-50 flex items-center justify-center mb-6">
            <Icon className="w-10 h-10 text-amber-500" strokeWidth={1.8} />
          </div>

          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            {title}
          </h1>

          <p className="text-sm text-slate-500 mt-2 max-w-xs leading-relaxed">
            {description}
          </p>

          <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-amber-600 bg-amber-50 px-4 py-2 rounded-full border border-amber-100">
            <Clock className="w-3.5 h-3.5" />
            <span>Próximamente</span>
          </div>
        </motion.div>

        <div className="w-full pb-4">
          <Button variant="outline" onClick={() => navigate('/map')}>
            Volver al mapa
          </Button>
        </div>
      </div>

      <CameraReportButton />
      <BottomNav />
    </div>
  );
};
