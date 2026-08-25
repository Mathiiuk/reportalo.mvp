import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export const ReporteDetailModal = ({ report, isOpen, onClose }) => {
  if (!report) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-xs"
          />

          {/* Modal / Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-lg bg-white rounded-t-[28px] sm:rounded-[28px] p-6 shadow-2xl z-10 max-h-[85vh] overflow-y-auto safe-bottom"
          >
            {/* Grab handle en mobile */}
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-4 sm:hidden" />

            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <span className="text-xs font-extrabold text-[#1E6FCB] uppercase tracking-wider">
                  {report.category || 'Incidente'}
                </span>
                <h2 className="text-xl font-extrabold text-[#1B365D] mt-0.5">
                  {report.id ? `${report.id} · ${report.title}` : report.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer"
                aria-label="Cerrar"
              >
                <span className="material-symbols-rounded text-xl">close</span>
              </button>
            </div>

            {report.image && (
              <div className="w-full h-48 rounded-2xl overflow-hidden mb-4 bg-slate-100 border border-slate-100">
                <img
                  src={report.image}
                  alt={report.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="space-y-3 bg-[#F8FAFC] p-4 rounded-2xl border border-slate-100 mb-5">
              <div className="flex items-center gap-2.5 text-sm text-slate-700">
                <span className="material-symbols-rounded text-[#1E6FCB] text-[20px]">
                  location_on
                </span>
                <span className="font-semibold">{report.location || 'Ubicación registrada'}</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-slate-700">
                <span className="material-symbols-rounded text-[#1E6FCB] text-[20px]">
                  calendar_today
                </span>
                <span>{report.date || 'Fecha reciente'}</span>
              </div>
              {report.description && (
                <p className="text-sm text-slate-600 pt-2 border-t border-slate-200/60 leading-relaxed">
                  {report.description}
                </p>
              )}
            </div>

            {/* Organismo y protección */}
            <div className="flex items-center gap-2.5 bg-[#EFF6FF] border border-[#DBEAFE] rounded-xl p-3 mb-5">
              <span className="material-symbols-rounded filled text-[#1E6FCB] text-lg shrink-0">
                shield
              </span>
              <span className="text-xs font-medium text-[#1E40AF]">
                Tu identidad permanece anónima ante el municipio/organismo asignado.
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-3.5 bg-[#1E6FCB] hover:bg-[#1860B3] text-white font-extrabold rounded-2xl transition-all cursor-pointer shadow-md shadow-[#1E6FCB]/20"
            >
              Cerrar
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
