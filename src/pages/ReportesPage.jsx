import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ReporteCard } from '../components/reportes/ReporteCard';
import { ReporteDetailModal } from '../components/reportes/ReporteDetailModal';

// Reportes iniciales de demostración basados en el diseño oficial
const INITIAL_REPORTS = [
  {
    id: '',
    title: 'Contenedor desbordado',
    subtitle: 'Sin enviar · esperando conexión',
    category: 'Higiene',
    location: 'Sarmiento 450',
    date: 'Pendiente de sincronización',
    status: 'pending',
    icon: 'delete',
    description: 'Residuos acumulados fuera del contenedor principal en la esquina.',
  },
  {
    id: '#RP-2048',
    title: 'Tránsito',
    category: 'Tránsito',
    location: 'Av. Mitre 1240',
    date: 'hoy 14:32',
    status: 'reviewing',
    icon: 'traffic',
    description: 'Semáforo fuera de servicio generando congestión en intersección.',
  },
  {
    id: '#RP-1994',
    title: 'Vial',
    category: 'Vial',
    location: 'Belgrano y Alsina',
    date: '09/08',
    status: 'notified',
    icon: 'construction',
    description: 'Bache de gran tamaño en carril derecho.',
  },
  {
    id: '#RP-1871',
    title: 'Ambiente',
    category: 'Ambiente',
    location: 'Parque Dominico',
    date: '28/07',
    status: 'resolved',
    icon: 'eco',
    description: 'Poda preventiva y limpieza de ramas caídas finalizada.',
  },
  {
    id: '#RP-1802',
    title: 'Comercio',
    category: 'Comercio',
    location: 'Fuera de jurisdicción',
    date: '21/07',
    status: 'dismissed',
    icon: 'storefront',
    description: 'El reclamo corresponde a jurisdicción provincial.',
  },
];

export const ReportesPage = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState(() => {
    try {
      const saved = localStorage.getItem('reportalo_user_reports');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // fallback
    }
    return INITIAL_REPORTS;
  });

  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'in_progress' | 'resolved'
  const [selectedReport, setSelectedReport] = useState(null);

  // Guardar en localStorage
  const saveReports = (newReports) => {
    setReports(newReports);
    try {
      localStorage.setItem('reportalo_user_reports', JSON.stringify(newReports));
    } catch (e) {
      console.warn('Error al guardar reportes:', e);
    }
  };

  // Conteo por categorías
  const counts = useMemo(() => {
    const total = reports.length;
    const inProgress = reports.filter((r) =>
      ['pending', 'reviewing', 'notified'].includes(r.status)
    ).length;
    const resolved = reports.filter((r) =>
      ['resolved', 'dismissed'].includes(r.status)
    ).length;

    return { total, inProgress, resolved };
  }, [reports]);

  // Filtrado de reportes según la pestaña activa
  const filteredReports = useMemo(() => {
    if (activeTab === 'in_progress') {
      return reports.filter((r) =>
        ['pending', 'reviewing', 'notified'].includes(r.status)
      );
    }
    if (activeTab === 'resolved') {
      return reports.filter((r) =>
        ['resolved', 'dismissed'].includes(r.status)
      );
    }
    return reports;
  }, [reports, activeTab]);

  return (
    <div className="w-full min-h-[100dvh] bg-[#F4F7FB] flex flex-col pb-28">
      {/* Encabezado Fijo/Superior */}
      <header className="px-6 pt-6 pb-2 safe-top">
        <div className="flex items-center justify-between">
          <h1 className="text-[28px] font-extrabold text-[#1B365D] tracking-tight">
            Mis reportes
          </h1>

          {/* Toggle de demostración / limpiar para probar empty state */}
          {reports.length > 0 ? (
            <button
              type="button"
              onClick={() => saveReports([])}
              className="text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer py-1 px-2 rounded-lg"
              title="Probar estado vacío"
            >
              Vaciar
            </button>
          ) : (
            <button
              type="button"
              onClick={() => saveReports(INITIAL_REPORTS)}
              className="text-xs font-bold text-[#1E6FCB] hover:underline cursor-pointer py-1 px-2 rounded-lg"
            >
              Cargar demo
            </button>
          )}
        </div>

        {/* Pestañas / Filtros */}
        <div className="flex items-center gap-2 mt-4 overflow-x-auto no-scrollbar pb-1">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-2xl text-[13px] font-extrabold transition-all cursor-pointer select-none shrink-0 ${
              activeTab === 'all'
                ? 'bg-[#1E6FCB] text-white shadow-sm shadow-[#1E6FCB]/20'
                : 'bg-white text-[#64748B] hover:bg-slate-100/80 border border-slate-200/60'
            }`}
          >
            Todos · {counts.total}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('in_progress')}
            className={`px-4 py-2 rounded-2xl text-[13px] font-extrabold transition-all cursor-pointer select-none shrink-0 ${
              activeTab === 'in_progress'
                ? 'bg-[#1E6FCB] text-white shadow-sm shadow-[#1E6FCB]/20'
                : 'bg-white text-[#64748B] hover:bg-slate-100/80 border border-slate-200/60'
            }`}
          >
            En curso · {counts.inProgress}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('resolved')}
            className={`px-4 py-2 rounded-2xl text-[13px] font-extrabold transition-all cursor-pointer select-none shrink-0 ${
              activeTab === 'resolved'
                ? 'bg-[#1E6FCB] text-white shadow-sm shadow-[#1E6FCB]/20'
                : 'bg-white text-[#64748B] hover:bg-slate-100/80 border border-slate-200/60'
            }`}
          >
            Resueltos · {counts.resolved}
          </button>
        </div>
      </header>

      {/* Lista de Reportes o Estado Vacío */}
      <main className="flex-1 px-5 mt-3">
        {filteredReports.length > 0 ? (
          <div className="flex flex-col gap-3">
            <AnimatePresence>
              {filteredReports.map((report, index) => (
                <motion.div
                  key={report.id || `report-${index}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.2, delay: index * 0.04 }}
                >
                  <ReporteCard
                    report={report}
                    onClick={() => setSelectedReport(report)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          /* Estado Vacío Amigable */
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col items-center justify-center text-center px-4 py-8 mt-2"
          >
            {/* Imagen de fondo / ilustración */}
            <div className="w-full max-w-[280px] aspect-square rounded-3xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.06)] border border-slate-200/60 bg-white mb-6">
              <img
                src="/empty-reports.jpg"
                alt="Aún no has reportado incidentes"
                className="w-full h-full object-cover select-none"
              />
            </div>

            <h2 className="text-xl font-extrabold text-[#1B365D] tracking-tight">
              Aún no has reportado nada
            </h2>

            <p className="text-sm font-medium text-[#64748B] mt-2 max-w-[290px] leading-relaxed">
              ¡Eso es una buena noticia! Significa que todo está en calma. Si ves un incidente o problema en tu barrio, reportalo fácilmente.
            </p>

            <div className="flex flex-col w-full max-w-[280px] gap-2.5 mt-6">
              <button
                type="button"
                onClick={() => navigate('/map')}
                className="w-full py-3.5 px-4 bg-[#1E6FCB] hover:bg-[#1860B3] active:scale-[0.98] text-white font-extrabold text-sm rounded-2xl shadow-md shadow-[#1E6FCB]/20 transition-all cursor-pointer border-none"
              >
                Explorar mapa
              </button>

              <button
                type="button"
                onClick={() => saveReports(INITIAL_REPORTS)}
                className="w-full py-3 px-4 bg-white hover:bg-slate-50 active:scale-[0.98] text-[#1E6FCB] font-bold text-xs rounded-2xl border border-slate-200 transition-all cursor-pointer"
              >
                Ver reportes de ejemplo
              </button>
            </div>
          </motion.div>
        )}
      </main>

      {/* Modal de Detalle al hacer clic en un reporte */}
      <ReporteDetailModal
        report={selectedReport}
        isOpen={!!selectedReport}
        onClose={() => setSelectedReport(null)}
      />
    </div>
  );
};
