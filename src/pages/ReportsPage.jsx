import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { motion } from 'framer-motion';

export const ReportsPage = () => {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState('todos');
  const [isDemoActive, setIsDemoActive] = useState(false);

  // Reportes demo para exploración
  const demoReports = [
    {
      id: 'REP-101',
      title: 'Bache en calzada principal',
      category: 'Infraestructura vial',
      status: 'En curso',
      statusColor: 'bg-[#FFF6E9] text-[#E08A00]',
      date: '24 Ago 2026',
      address: 'Av. Corrientes 1420',
    },
    {
      id: 'REP-102',
      title: 'Luminaria apagada en esquina',
      category: 'Alumbrado público',
      status: 'En curso',
      statusColor: 'bg-[#FFF6E9] text-[#E08A00]',
      date: '20 Ago 2026',
      address: 'Calle San Martín 850',
    },
    {
      id: 'REP-103',
      title: 'Contenedor de residuos desbordado',
      category: 'Higiene urbana',
      status: 'Resueltos',
      statusColor: 'bg-[#E3F5EC] text-[#2E9E6B]',
      date: '15 Ago 2026',
      address: 'Pje. Los Sauces 312',
    },
  ];

  const currentReports = isDemoActive ? demoReports : [];

  const filteredReports = currentReports.filter((r) => {
    if (activeFilter === 'todos') return true;
    if (activeFilter === 'en curso') return r.status === 'En curso';
    if (activeFilter === 'resueltos') return r.status === 'Resueltos';
    return true;
  });

  const countTodos = currentReports.length;
  const countEnCurso = currentReports.filter((r) => r.status === 'En curso').length;
  const countResueltos = currentReports.filter((r) => r.status === 'Resueltos').length;

  return (
    <AppLayout activeTab="reportes">
      <div className="flex-1 overflow-y-auto bg-[#F4F7FB] px-4 sm:px-6 md:px-8 py-5">
        <div className="max-w-[440px] md:max-w-[560px] mx-auto flex flex-col gap-4">
          
          {/* Header Superior: Título y Cargar demo */}
          <div className="flex items-center justify-between">
            <h1 className="font-extrabold text-[24px] sm:text-[26px] text-[#1B365D] tracking-[-0.4px] m-0">
              Mis reportes
            </h1>
            
            <button
              onClick={() => setIsDemoActive((prev) => !prev)}
              type="button"
              className="font-bold text-[13px] text-[#1E6FCB] hover:text-[#15539E] cursor-pointer bg-transparent border-0 p-1 transition-colors"
            >
              {isDemoActive ? 'Limpiar demo' : 'Cargar demo'}
            </button>
          </div>

          {/* Filtros en Píldora */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            
            {/* Todos */}
            <button
              onClick={() => setActiveFilter('todos')}
              type="button"
              className={`px-4 py-1.5 rounded-full font-bold text-[12.5px] cursor-pointer transition-all border ${
                activeFilter === 'todos'
                  ? 'bg-[#1E6FCB] text-white border-[#1E6FCB] shadow-xs'
                  : 'bg-white text-[#475569] border-[#E2E8F0] hover:bg-slate-50'
              }`}
            >
              Todos · {countTodos}
            </button>

            {/* En curso */}
            <button
              onClick={() => setActiveFilter('en curso')}
              type="button"
              className={`px-4 py-1.5 rounded-full font-bold text-[12.5px] cursor-pointer transition-all border ${
                activeFilter === 'en curso'
                  ? 'bg-[#1E6FCB] text-white border-[#1E6FCB] shadow-xs'
                  : 'bg-white text-[#475569] border-[#E2E8F0] hover:bg-slate-50'
              }`}
            >
              En curso · {countEnCurso}
            </button>

            {/* Resueltos */}
            <button
              onClick={() => setActiveFilter('resueltos')}
              type="button"
              className={`px-4 py-1.5 rounded-full font-bold text-[12.5px] cursor-pointer transition-all border ${
                activeFilter === 'resueltos'
                  ? 'bg-[#1E6FCB] text-white border-[#1E6FCB] shadow-xs'
                  : 'bg-white text-[#475569] border-[#E2E8F0] hover:bg-slate-50'
              }`}
            >
              Resueltos · {countResueltos}
            </button>
          </div>

          {/* Cuerpo: Empty State o Listado de Reportes */}
          {filteredReports.length === 0 ? (
            
            /* Tarjeta de Empty State (Responsiva) */
            <div className="bg-white md:bg-white rounded-[28px] md:rounded-[16px] border border-[#E8EEF5] md:border-[#E6ECF3] shadow-[0px_8px_24px_rgba(20,40,80,0.06)] md:shadow-[0_2px_12px_rgba(20,40,80,0.05)] p-6 sm:p-7 md:p-7 flex flex-col md:flex-row items-center md:items-start text-center md:text-left mt-2 md:mt-10 md:max-w-[580px] md:mx-auto md:gap-[30px]">
              
              {/* Ilustración Clipboard */}
              <div className="flex-none mb-4 md:mb-0 flex items-center justify-center w-[132px] md:mt-1">
                <svg width="132" height="104" viewBox="0 0 132 104" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="30" y="8" width="72" height="88" rx="8" fill="#fff" stroke="#c9d4e0" strokeWidth="2"></rect>
                  <rect x="52" y="2" width="28" height="12" rx="5" fill="#dde4ec" stroke="#c9d4e0" strokeWidth="2"></rect>
                  <line x1="42" y1="34" x2="90" y2="34" stroke="#e2e8ef" strokeWidth="4" strokeLinecap="round" strokeDasharray="8 7"></line>
                  <line x1="42" y1="48" x2="78" y2="48" stroke="#e2e8ef" strokeWidth="4" strokeLinecap="round" strokeDasharray="8 7"></line>
                  <line x1="42" y1="62" x2="86" y2="62" stroke="#e2e8ef" strokeWidth="4" strokeLinecap="round" strokeDasharray="8 7"></line>
                  <rect x="16" y="62" width="40" height="30" rx="7" fill="#1E6FCB"></rect>
                  <rect x="27" y="56" width="14" height="8" rx="3" fill="#1E6FCB"></rect>
                  <circle cx="36" cy="77" r="9" fill="#fff"></circle>
                  <circle cx="36" cy="77" r="4.5" fill="#1E6FCB"></circle>
                </svg>
              </div>

              {/* Contenido */}
              <div className="flex-1 flex flex-col items-center md:items-start">
                {/* Título de estado */}
                <h2 className="font-extrabold text-[17px] text-[#243447] tracking-[-0.2px] m-0">
                  Todavía no enviaste reportes
                </h2>

                {/* Mensaje */}
                <p className="font-medium text-[12.5px] leading-[1.6] text-[#7A8696] mt-[7px] mb-0 text-pretty">
                  Cuando envíes uno, acá vas a poder seguir su estado paso a paso hasta que se resuelva, y descargar la constancia de cierre.
                </p>

                {/* Botones */}
                <div className="flex flex-col md:flex-row items-center gap-3 md:gap-3.5 mt-4 md:mt-4 w-full md:w-auto">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate('/nuevo-reporte')}
                    type="button"
                    className="w-full md:w-auto bg-[#1E6FCB] text-white rounded-[11px] py-2.5 px-4 md:px-[18px] flex items-center justify-center gap-1.5 font-extrabold text-[12.5px] cursor-pointer border-0 transition-colors hover:bg-[#15539E]"
                  >
                    <span className="material-symbols-rounded text-[17px]">
                      add_a_photo
                    </span>
                    Hacer mi primer reporte
                  </motion.button>
                  
                  <button
                    onClick={() => navigate('/mapa')}
                    type="button"
                    className="w-full md:w-auto bg-transparent border-none text-[#8593A2] hover:text-[#5B6A7A] font-bold text-[12px] cursor-pointer transition-colors"
                  >
                    Ver el mapa de la zona
                  </button>
                </div>
                
                {/* Botón oculto para demo */}
                <button onClick={() => setIsDemoActive(true)} className="opacity-0 w-0 h-0 p-0 m-0 absolute">demo</button>
              </div>
            </div>
          ) : (
            
            /* Listado de tarjetas de reportes activos */
            <div className="flex flex-col gap-3">
              {filteredReports.map((report) => (
                <motion.div
                  key={report.id}
                  whileHover={{ y: -2 }}
                  className="bg-white border border-[#E6ECF3] rounded-[18px] p-4 flex flex-col gap-2 shadow-xs cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-extrabold text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider ${report.statusColor}`}>
                      {report.status}
                    </span>
                    <span className="font-semibold text-[11px] text-[#9AA7B5]">
                      {report.date}
                    </span>
                  </div>

                  <h3 className="font-bold text-[15px] text-[#1B365D] m-0">
                    {report.title}
                  </h3>

                  <div className="flex items-center justify-between text-[11.5px] text-[#64748B] pt-2 border-t border-[#EEF1F5] mt-1">
                    <div className="flex items-center gap-1">
                      <span className="material-symbols-rounded text-[14px] text-[#1E6FCB]">
                        location_on
                      </span>
                      <span>{report.address}</span>
                    </div>
                    <span className="font-bold text-[#1E6FCB]">
                      Ver seguimiento →
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

        </div>
      </div>
    </AppLayout>
  );
};
