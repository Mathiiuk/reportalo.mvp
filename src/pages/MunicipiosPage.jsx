import React, { useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export const MunicipiosPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Scroll automático a la sección correspondiente si la URL contiene hash (ej: #planes o #como-funciona)
  useEffect(() => {
    if (location.hash) {
      const element = document.querySelector(location.hash);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [location.hash]);

  const scrollToPlanes = () => {
    const element = document.getElementById('planes');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-[100dvh] w-full font-manrope select-none flex flex-col bg-white">
      
      {/* Header superior: Proporciones idénticas a WelcomePage */}
      <header className="flex-shrink-0 border-b border-[#EEF1F5] px-6 md:px-12 py-4 flex items-center gap-6 bg-white sticky top-0 z-30">
        <Link to="/" className="flex items-center gap-2.5 text-inherit no-underline">
          <img
            src="/logo-icon.webp"
            alt="Reportalo"
            className="w-[20px] h-[26px] object-contain"
          />
          <span className="font-extrabold text-[19px] text-[#263249] tracking-[-0.4px]">
            Reportalo
          </span>
          <span className="font-bold text-[9px] text-[#1E6FCB] bg-[#EEF5FC] px-2 py-1 rounded-[7px] ml-1 uppercase tracking-wide">
            MUNICIPIOS
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 ml-4">
          <a href="#como-funciona" className="font-semibold text-[13px] text-[#7A8696] hover:text-[#1E6FCB] transition-colors no-underline">
            Cómo funciona
          </a>
          <a href="#planes" className="font-semibold text-[13px] text-[#7A8696] hover:text-[#1E6FCB] transition-colors no-underline">
            Planes
          </a>
          <Link to="/" className="font-semibold text-[13px] text-[#1E6FCB] hover:text-[#15539E] transition-colors no-underline">
            Portal Ciudadanos →
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={() => navigate('/login')}
            type="button"
            className="font-bold text-[13px] text-[#1E6FCB] hover:text-[#15539E] px-3 py-2 cursor-pointer bg-transparent border-0"
          >
            Ingresar
          </button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={scrollToPlanes}
            className="bg-[#1E6FCB] text-white px-4 py-2.5 rounded-[10px] font-bold text-[13px] hover:bg-[#15539E] cursor-pointer border-0 shadow-sm"
          >
            Ver planes
          </motion.button>
        </div>
      </header>

      {/* Contenedor principal de 2 columnas responsive */}
      <div className="flex flex-col md:flex-row overflow-hidden border-b border-[#EEF1F5]">
        
        {/* Columna Izquierda: Mensaje institucional & Métricas */}
        <main className="flex-1 flex flex-col justify-between px-6 md:px-12 lg:px-16 pt-8 md:pt-12 pb-8 text-slate-800">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="flex-1 flex flex-col justify-center items-start text-left max-w-[560px]"
          >
            {/* Logo oficial de Reportalo sin fondo */}
            <img
              src="/logo-icon.webp"
              alt="Reportalo Logo"
              className="w-[48px] h-[62px] md:w-[56px] md:h-[72px] object-contain mb-4 md:mb-5"
            />

            {/* Título principal */}
            <h1 className="font-extrabold text-[32px] md:text-[38px] lg:text-[42px] leading-tight md:leading-[1.18] text-[#1F2C3D] tracking-[-0.6px] md:tracking-[-1px]">
              Los reclamos de tus vecinos, con evidencia y encuadre legal
            </h1>

            {/* Bajada explicativa */}
            <p className="font-medium text-[14px] md:text-[15.5px] leading-[1.55] md:leading-[1.6] text-[#6A7888] mt-[11px] md:mt-3 max-w-[480px]">
              Recibí reportes georreferenciados, con fotos ya anonimizadas y la norma que aplica identificada. Tus inspectores trabajan casos, no capturas de pantalla.
            </p>

            {/* Acciones para municipios */}
            <div className="flex flex-wrap items-center gap-3 mt-7 w-full">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={scrollToPlanes}
                className="bg-[#1E6FCB] text-white px-6 py-3.5 rounded-[12px] font-extrabold text-[14px] shadow-[0px_8px_18px_rgba(30,111,203,0.28)] hover:bg-[#15539E] cursor-pointer border-0"
              >
                Contratar Reportalo
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={() => navigate('/login')}
                className="border-[1.5px] border-[#DDE4EC] text-[#56657A] px-6 py-3.5 rounded-[12px] font-bold text-[14px] hover:bg-slate-50 transition-colors cursor-pointer bg-white"
              >
                Solicitar una demo
              </motion.button>
            </div>
          </motion.div>

          {/* Fila de Métricas y Cumplimiento Normativo */}
          <div className="flex items-center gap-8 lg:gap-12 pt-8 border-t border-slate-100 mt-8">
            <div>
              <div className="font-extrabold text-[24px] leading-none text-[#1E6FCB]">
                100%
              </div>
              <div className="font-bold text-[10.5px] tracking-wider text-[#8593A2] mt-1.5 uppercase">
                Fotos Anonimizadas
              </div>
            </div>

            <div>
              <div className="font-extrabold text-[24px] leading-none text-[#1E6FCB]">
                Ley 25.326
              </div>
              <div className="font-bold text-[10.5px] tracking-wider text-[#8593A2] mt-1.5 uppercase">
                Datos Personales
              </div>
            </div>

            <div>
              <div className="font-extrabold text-[24px] leading-none text-[#1E6FCB]">
                4
              </div>
              <div className="font-bold text-[10.5px] tracking-wider text-[#8593A2] mt-1.5 uppercase">
                Categorías Configurables
              </div>
            </div>
          </div>
        </main>

        {/* Columna Derecha / Sidebar "Cómo Funciona" */}
        <aside id="como-funciona" className="w-full md:w-[380px] lg:w-[420px] flex-shrink-0 bg-[#F4F7FB] border-t md:border-t-0 md:border-l border-[#EEF1F5] p-8 flex flex-col justify-between gap-4">
          <div>
            <div className="font-extrabold text-[11px] text-[#8593A2] tracking-[0.5px] mb-4 uppercase">
              CÓMO FUNCIONA
            </div>

            <div className="flex flex-col gap-3">
              {/* Paso 1 */}
              <motion.div whileHover={{ y: -2 }} className="bg-white border border-[#E6ECF3] rounded-[13px] p-3.5 flex gap-3 shadow-sm">
                <span className="w-[28px] h-[28px] rounded-[8px] bg-[#EEF5FC] text-[#1E6FCB] font-extrabold text-[12px] flex items-center justify-center flex-shrink-0">
                  1
                </span>
                <div>
                  <div className="font-bold text-[13px] text-[#263249]">
                    El vecino reporta
                  </div>
                  <div className="font-medium text-[11px] leading-[1.45] text-[#7A8696] mt-0.5">
                    Foto anonimizada y ubicación exacta, sin exponer su identidad.
                  </div>
                </div>
              </motion.div>

              {/* Paso 2 */}
              <motion.div whileHover={{ y: -2 }} className="bg-white border border-[#E6ECF3] rounded-[13px] p-3.5 flex gap-3 shadow-sm">
                <span className="w-[28px] h-[28px] rounded-[8px] bg-[#EEF5FC] text-[#1E6FCB] font-extrabold text-[12px] flex items-center justify-center flex-shrink-0">
                  2
                </span>
                <div>
                  <div className="font-bold text-[13px] text-[#263249]">
                    La IA encuadra el caso
                  </div>
                  <div className="font-medium text-[11px] leading-[1.45] text-[#7A8696] mt-0.5">
                    Detecta la norma aplicable y el organismo competente.
                  </div>
                </div>
              </motion.div>

              {/* Paso 3 */}
              <motion.div whileHover={{ y: -2 }} className="bg-white border border-[#E6ECF3] rounded-[13px] p-3.5 flex gap-3 shadow-sm">
                <span className="w-[28px] h-[28px] rounded-[8px] bg-[#EEF5FC] text-[#1E6FCB] font-extrabold text-[12px] flex items-center justify-center flex-shrink-0">
                  3
                </span>
                <div>
                  <div className="font-bold text-[13px] text-[#263249]">
                    Tu oficial resuelve
                  </div>
                  <div className="font-medium text-[11px] leading-[1.45] text-[#7A8696] mt-0.5">
                    Cambia el estado con nota y el vecino ve el avance.
                  </div>
                </div>
              </motion.div>
            </div>
          </div>

          {/* Nota de validación institucional al pie */}
          <div className="flex items-start gap-2 pt-3 border-t border-[#EEF1F5]">
            <span className="material-symbols-rounded text-[17px] text-[#2E9E6B] flex-shrink-0 mt-0.5">
              verified_user
            </span>
            <span className="font-semibold text-[11px] leading-[1.5] text-[#56657A]">
              Solo se habilitan cuentas con correo oficial del municipio.
            </span>
          </div>
        </aside>

      </div>

      {/* SECCIÓN DE PLANES: /municipios#planes */}
      <section id="planes" className="w-full bg-[#F4F7FB] py-12 md:py-16 px-6 md:px-12 lg:px-16 border-t border-[#EEF1F5]">
        <div className="max-w-6xl mx-auto flex flex-col">
          
          <div className="text-center md:text-left mb-8">
            <span className="font-extrabold text-[11px] text-[#1E6FCB] bg-[#EEF5FC] px-3 py-1 rounded-full uppercase tracking-wider">
              CONTRATACIÓN INSTITUCIONAL
            </span>
            <h2 className="font-extrabold text-[28px] md:text-[34px] text-[#243447] tracking-[-0.6px] mt-2 mb-1">
              Elegí el alcance de tu municipio
            </h2>
            <p className="font-medium text-[14px] md:text-[15px] text-[#7A8696] m-0">
              Las licencias son por oficial. Podés sumar más en cualquier momento.
            </p>
          </div>

          {/* Tarjetas de Precios y Planes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            
            {/* Card 1: Localidad */}
            <div className="bg-white border border-[#E6ECF3] rounded-[18px] p-6 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow">
              <div>
                <h3 className="font-extrabold text-[16px] text-[#263249] m-0">Localidad</h3>
                <div className="font-medium text-[12px] text-[#8593A2] mt-1">Hasta 50.000 habitantes</div>
                <div className="flex items-baseline gap-1.5 my-5">
                  <span className="font-extrabold text-[32px] text-[#243447]">3</span>
                  <span className="font-semibold text-[13px] text-[#8593A2]">licencias de oficial</span>
                </div>
                <div className="h-[1px] bg-[#F2F5F9] mb-4"></div>
                <div className="flex flex-col gap-3">
                  <div className="flex gap-2.5 items-center">
                    <span className="material-symbols-rounded text-[18px] text-[#2E9E6B]">check</span>
                    <span className="font-semibold text-[12.5px] text-[#46566B]">1 jurisdicción</span>
                  </div>
                  <div className="flex gap-2.5 items-center">
                    <span className="material-symbols-rounded text-[18px] text-[#2E9E6B]">check</span>
                    <span className="font-semibold text-[12.5px] text-[#46566B]">Las 4 categorías</span>
                  </div>
                  <div className="flex gap-2.5 items-center">
                    <span className="material-symbols-rounded text-[18px] text-[#C3CED9]">remove</span>
                    <span className="font-semibold text-[12.5px] text-[#9AA7B5]">Sin exportación de datos</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate('/login')}
                className="mt-6 w-full py-3 bg-[#EEF5FC] hover:bg-[#E1EFFD] text-[#1E6FCB] font-bold text-[13px] rounded-xl border-none cursor-pointer transition-colors"
              >
                Seleccionar plan
              </button>
            </div>

            {/* Card 2: Partido (Recomendado) */}
            <div className="relative bg-white border-[2.5px] border-[#1E6FCB] rounded-[18px] p-6 flex flex-col justify-between shadow-[0_10px_30px_rgba(30,111,203,0.16)] -translate-y-1">
              <span className="absolute -top-[12px] left-6 font-extrabold text-[10px] text-white bg-[#1E6FCB] px-3 py-1 rounded-full tracking-wider shadow-xs">
                RECOMENDADO
              </span>
              <div>
                <h3 className="font-extrabold text-[16px] text-[#263249] m-0 mt-1">Partido</h3>
                <div className="font-medium text-[12px] text-[#8593A2] mt-1">Hasta 400.000 habitantes</div>
                <div className="flex items-baseline gap-1.5 my-5">
                  <span className="font-extrabold text-[32px] text-[#1E6FCB]">10</span>
                  <span className="font-semibold text-[13px] text-[#8593A2]">licencias de oficial</span>
                </div>
                <div className="h-[1px] bg-[#F2F5F9] mb-4"></div>
                <div className="flex flex-col gap-3">
                  <div className="flex gap-2.5 items-center">
                    <span className="material-symbols-rounded text-[18px] text-[#2E9E6B]">check</span>
                    <span className="font-semibold text-[12.5px] text-[#46566B]">Hasta 5 jurisdicciones</span>
                  </div>
                  <div className="flex gap-2.5 items-center">
                    <span className="material-symbols-rounded text-[18px] text-[#2E9E6B]">check</span>
                    <span className="font-semibold text-[12.5px] text-[#46566B]">Categorías configurables</span>
                  </div>
                  <div className="flex gap-2.5 items-center">
                    <span className="material-symbols-rounded text-[18px] text-[#2E9E6B]">check</span>
                    <span className="font-semibold text-[12.5px] text-[#46566B]">Exportación de datos</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate('/login')}
                className="mt-6 w-full py-3 bg-[#1E6FCB] hover:bg-[#15539E] text-white font-extrabold text-[13px] rounded-xl border-none cursor-pointer transition-colors shadow-xs"
              >
                Seleccionar plan
              </button>
            </div>

            {/* Card 3: Provincial */}
            <div className="bg-white border border-[#E6ECF3] rounded-[18px] p-6 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow">
              <div>
                <h3 className="font-extrabold text-[16px] text-[#263249] m-0">Provincial</h3>
                <div className="font-medium text-[12px] text-[#8593A2] mt-1">Sin límite de habitantes</div>
                <div className="flex items-baseline gap-1.5 my-5">
                  <span className="font-extrabold text-[32px] text-[#243447]">A medida</span>
                </div>
                <div className="h-[1px] bg-[#F2F5F9] mb-4"></div>
                <div className="flex flex-col gap-3">
                  <div className="flex gap-2.5 items-center">
                    <span className="material-symbols-rounded text-[18px] text-[#2E9E6B]">check</span>
                    <span className="font-semibold text-[12.5px] text-[#46566B]">Jurisdicciones ilimitadas</span>
                  </div>
                  <div className="flex gap-2.5 items-center">
                    <span className="material-symbols-rounded text-[18px] text-[#2E9E6B]">check</span>
                    <span className="font-semibold text-[12.5px] text-[#46566B]">Integración con expedientes</span>
                  </div>
                  <div className="flex gap-2.5 items-center">
                    <span className="material-symbols-rounded text-[18px] text-[#2E9E6B]">check</span>
                    <span className="font-semibold text-[12.5px] text-[#46566B]">Soporte dedicado</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate('/login')}
                className="mt-6 w-full py-3 bg-[#EEF5FC] hover:bg-[#E1EFFD] text-[#1E6FCB] font-bold text-[13px] rounded-xl border-none cursor-pointer transition-colors"
              >
                Contactar soporte
              </button>
            </div>

          </div>

          {/* Aviso Legal / Facturación por orden de compra */}
          <div className="mt-8 flex flex-col md:flex-row items-start md:items-center gap-3 bg-white border border-[#E6ECF3] rounded-[16px] p-4 md:p-5 shadow-xs">
            <span className="material-symbols-rounded text-[22px] text-[#8593A2] shrink-0">
              receipt_long
            </span>
            <span className="font-medium text-[12.5px] leading-[1.5] text-[#6A7888]">
              La facturación a organismos públicos se cierra por orden de compra. El precio no se muestra en pantalla: se emite presupuesto institucional a medida según cantidad de oficiales.
            </span>
          </div>

        </div>
      </section>

    </div>
  );
};
