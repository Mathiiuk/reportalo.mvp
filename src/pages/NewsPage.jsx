import React from 'react';
import { AppLayout } from '../components/layout/AppLayout';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

export const NewsPage = () => {
  const newsItems = [];

  return (
    <AppLayout activeTab="novedades">
      <div className="flex-1 overflow-y-auto bg-[#F4F7FB] px-4 sm:px-6 md:px-12 py-5">
        <div className="max-w-[620px] mx-auto flex flex-col gap-4">
          
          {/* Título de Sección */}
          <div>
            <h1 className="font-extrabold text-[22px] sm:text-[24px] text-[#243447] tracking-[-0.4px] m-0">
              Novedades
            </h1>
            <p className="font-medium text-[12px] sm:text-[13px] text-[#8593A2] mt-0.5 mb-0">
              Avisos oficiales y resoluciones de tu municipio
            </p>
          </div>

          {newsItems.length > 0 ? (
            <>
              {/* Listado de Noticias y Alertas */}
              <div className="flex flex-col gap-3">
                {newsItems.map((item) => (
                  <motion.div
                    key={item.id}
                    whileHover={{ y: -2 }}
                    className="bg-white border border-[#E6ECF3] rounded-[16px] p-4 flex flex-col gap-2 shadow-xs cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className={`font-extrabold text-[10px] px-2 py-0.5 rounded-[6px] uppercase tracking-wider ${item.tagColor}`}>
                        {item.tag}
                      </span>
                      <span className="font-semibold text-[11px] text-[#9AA7B5]">
                        {item.date}
                      </span>
                    </div>

                    <div className="flex gap-3 items-start mt-1">
                      <div className="w-9 h-9 rounded-[10px] bg-[#EEF5FC] flex items-center justify-center flex-shrink-0 text-[#1E6FCB]">
                        <span className="material-symbols-rounded text-[20px] filled">
                          {item.icon}
                        </span>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-[14px] text-[#263249] m-0">
                          {item.title}
                        </h3>
                        <p className="font-medium text-[12px] leading-[1.45] text-[#7A8696] mt-1 mb-0">
                          {item.summary}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8 mt-[10vh]">
              <div className="flex items-center justify-center">
                <svg width="132" height="104" viewBox="0 0 132 104" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M34 42h14l40-22v58L48 56H34a8 8 0 0 1-8-8v-6a8 8 0 0 1 8-8Z" fill="#fff" stroke="#c9d4e0" strokeWidth="2.5" strokeLinejoin="round"></path>
                  <path d="M44 56h14l4 30a7 7 0 0 1-7 8h-4a7 7 0 0 1-7-6l-4-32Z" fill="#eef2f7" stroke="#c9d4e0" strokeWidth="2.5" strokeLinejoin="round"></path>
                  <path d="M100 34c6 5 6 25 0 30" stroke="#dbe3ec" strokeWidth="4" strokeLinecap="round" strokeDasharray="3 8"></path>
                  <path d="M112 26c11 9 11 41 0 50" stroke="#e6ecf3" strokeWidth="4" strokeLinecap="round" strokeDasharray="3 9"></path>
                </svg>
              </div>
              <div className="font-extrabold text-[17px] text-[#243447] mt-4 tracking-[-0.2px]">
                Sin novedades por ahora
              </div>
              <div className="font-medium text-[12px] leading-[1.6] text-[#7A8696] mt-[7px] text-pretty">
                Te avisamos acá cuando un reporte tuyo cambie de estado o el organismo deje una nota.
              </div>
              
              <Link 
                to="/mapa"
                className="mt-3 font-bold text-[12px] text-[#8593A2] bg-transparent border-none cursor-pointer no-underline"
              >
                Ver el mapa
              </Link>
            </div>
          )}

        </div>
      </div>
    </AppLayout>
  );
};
