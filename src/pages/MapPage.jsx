import React, { useState } from 'react';
import { AppLayout } from '../components/layout/AppLayout';
import { CitizenMap } from '../components/map/CitizenMap';
import { motion, AnimatePresence } from 'framer-motion';

export const MapPage = () => {
  const [selectedReport, setSelectedReport] = useState(null);

  return (
    <AppLayout activeTab="mapa">
      <div className="w-full h-full relative flex-1 flex flex-col overflow-hidden">
        
        {/* Mapa Interactivo con MapLibre GL JS */}
        <CitizenMap onReportClick={(report) => setSelectedReport(report)} />

        {/* Modal / Sheet inferior al hacer clic en un reporte del mapa */}
        <AnimatePresence>
          {selectedReport && (
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className="absolute bottom-16 left-4 right-4 md:left-auto md:right-6 md:bottom-20 md:w-[360px] bg-white rounded-[20px] p-4 shadow-[0px_10px_30px_rgba(20,40,80,0.18)] border border-[#E6ECF3] z-30"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-extrabold text-[10px] text-[#1E6FCB] bg-[#EEF5FC] px-2 py-0.5 rounded-[6px] uppercase tracking-wider">
                    {selectedReport.status}
                  </span>
                  <h3 className="font-extrabold text-[15px] text-[#243447] mt-1.5 m-0">
                    {selectedReport.title}
                  </h3>
                  <p className="font-medium text-[11.5px] text-[#8593A2] mt-0.5 mb-0">
                    Reclamo georreferenciado verificado
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedReport(null)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer border-0"
                >
                  ✕
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </AppLayout>
  );
};
