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
            
            /* Tarjeta de Empty State (Copia idéntica al diseño) */
            <div className="bg-white rounded-[28px] border border-[#E8EEF5] shadow-[0px_8px_24px_rgba(20,40,80,0.06)] p-6 sm:p-7 flex flex-col items-center text-center mt-2">
              
              {/* Ilustración de Parque y Calma */}
              <div className="w-full max-w-[280px] h-[190px] rounded-[22px] overflow-hidden bg-[#E9F5EF] flex items-center justify-center relative mb-4 shadow-inner">
                {/* SVG Ilustración Parque Pacífico */}
                <svg viewBox="0 0 320 220" className="w-full h-full object-cover">
                  <defs>
                    <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#C9E6FF" />
                      <stop offset="100%" stopColor="#EBF5FB" />
                    </linearGradient>
                    <linearGradient id="grassGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#A3E098" />
                      <stop offset="100%" stopColor="#6BC264" />
                    </linearGradient>
                  </defs>
                  
                  {/* Cielo */}
                  <rect width="320" height="220" fill="url(#skyGrad)" />
                  
                  {/* Sol */}
                  <circle cx="170" cy="55" r="22" fill="#FDE047" opacity="0.85" />
                  <circle cx="170" cy="55" r="30" fill="#FEF08A" opacity="0.35" />

                  {/* Nubes */}
                  <ellipse cx="100" cy="50" rx="35" ry="16" fill="#FFFFFF" opacity="0.85" />
                  <ellipse cx="120" cy="46" rx="25" ry="14" fill="#FFFFFF" opacity="0.85" />
                  <ellipse cx="230" cy="65" rx="30" ry="12" fill="#FFFFFF" opacity="0.85" />

                  {/* Colinas de fondo */}
                  <path d="M-20,180 Q80,120 180,150 T340,140 L340,220 L-20,220 Z" fill="#93C5FD" opacity="0.4" />

                  {/* Prado / Césped */}
                  <path d="M-10,155 Q80,140 160,150 T330,135 L330,220 L-10,220 Z" fill="url(#grassGrad)" />

                  {/* Árbol Grande Derecho */}
                  <rect x="230" y="125" width="14" height="60" fill="#8D6E63" rx="2" />
                  <circle cx="237" cy="110" r="38" fill="#4CAF50" />
                  <circle cx="215" cy="120" r="26" fill="#43A047" />
                  <circle cx="255" cy="115" r="24" fill="#388E3C" />
                  <circle cx="235" cy="95" r="28" fill="#66BB6A" />

                  {/* Árbol Izquierdo */}
                  <rect x="85" y="135" width="8" height="45" fill="#8D6E63" rx="2" />
                  <circle cx="89" cy="120" r="26" fill="#66BB6A" />
                  <circle cx="75" cy="128" r="18" fill="#4CAF50" />
                  <circle cx="102" cy="126" r="18" fill="#43A047" />

                  {/* Sendero */}
                  <path d="M-10,210 Q90,180 180,200 L330,215 L330,220 L-10,220 Z" fill="#E2E8F0" opacity="0.8" />

                  {/* Banco de Parque */}
                  <rect x="135" y="162" width="60" height="6" rx="2" fill="#D97706" />
                  <rect x="137" y="150" width="56" height="10" rx="2" fill="#B45309" />
                  <rect x="142" y="168" width="4" height="16" fill="#475569" />
                  <rect x="184" y="168" width="4" height="16" fill="#475569" />

                  {/* Persona sentada en el banco */}
                  <circle cx="165" cy="140" r="7" fill="#FBBF24" /> {/* Cabeza */}
                  <path d="M158,140 Q165,130 172,140 Q174,152 165,150 Z" fill="#78350F" /> {/* Pelo */}
                  <path d="M159,148 L171,148 L170,165 L160,165 Z" fill="#0D9488" rx="2" /> {/* Camisa */}
                  <path d="M160,165 L150,178 L154,180 L164,167 Z" fill="#3B82F6" /> {/* Piernas */}
                  <path d="M166,165 L168,178 L172,178 L170,165 Z" fill="#2563EB" />
                </svg>
              </div>

              {/* Título de estado */}
              <h2 className="font-extrabold text-[20px] text-[#1B365D] tracking-[-0.3px] m-0">
                Aún no has reportado nada
              </h2>

              {/* Mensaje tranquilizador */}
              <p className="font-medium text-[13px] leading-[1.5] text-[#64748B] mt-2 mb-0 max-w-[320px]">
                ¡Eso es una buena noticia! Significa que todo está en calma. Si ves un incidente o problema en tu barrio, reportalo fácilmente.
              </p>

              {/* Botón Principal: Explorar mapa */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/mapa')}
                type="button"
                className="w-full bg-[#1E6FCB] text-white rounded-full py-[14px] px-6 text-center font-extrabold text-[14px] shadow-[0px_6px_16px_rgba(30,111,203,0.28)] hover:bg-[#15539E] cursor-pointer border-0 mt-5 transition-colors"
              >
                Explorar mapa
              </motion.button>

              {/* Botón Secundario: Ver reportes de ejemplo */}
              <button
                onClick={() => setIsDemoActive(true)}
                type="button"
                className="w-full bg-white border border-[#E2E8F0] text-[#1E6FCB] hover:bg-slate-50 rounded-full py-[12px] px-6 text-center font-bold text-[13.5px] cursor-pointer mt-2.5 transition-colors"
              >
                Ver reportes de ejemplo
              </button>

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
