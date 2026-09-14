import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AppLayout } from '../components/layout/AppLayout';
import { useAuth } from '../hooks/useAuth';
import { getUserInitials } from '../utils/userUtils';
import {
  CURRENT_TERMS_VERSION,
  getTermsRecord,
  formatAcceptedDate,
} from '../services/termsService';
import {
  getNotificationPermission,
  requestNotificationPermission,
  sendLocalNotification,
  isNotificationPermissionBlocked,
  openSystemNotificationSettings,
  isNotificationsEnabled,
  setNotificationPreference,
} from '../services/notificationService';
import { BadgeCheck, ChevronRight, Bell, Newspaper, ShieldCheck, Download, BellOff, Trash2 } from 'lucide-react';

/**
 * Pantalla de Perfil de Usuario Ciudadano.
 * Presenta información de la cuenta, métricas de reportes, control propio de notificaciones
 * sincronizado con los permisos del SO/PWA, acceso a novedades, permisos y términos vigentes.
 */
export const ProfilePage = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  // Consentimiento y términos
  const termsRecord = getTermsRecord(user?.id);
  const acceptedVersion = termsRecord?.terms_version || CURRENT_TERMS_VERSION;
  const acceptedDate = formatAcceptedDate(termsRecord?.accepted_at);
  const userInitials = getUserInitials(user) || 'LF';
  const userName = user?.user_metadata?.full_name || 'Lucía F.';
  const userEmail = user?.email || 'lucia.f@mail.com';

  // Estados de Notificaciones PWA
  const [notificationsActive, setNotificationsActive] = useState(() => isNotificationsEnabled());
  const [isBlocked, setIsBlocked] = useState(() => isNotificationPermissionBlocked());
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Sincronizar estado con el navegador al cargar
  useEffect(() => {
    const currentPermission = getNotificationPermission();
    setIsBlocked(currentPermission === 'denied');
    setNotificationsActive(isNotificationsEnabled());
  }, []);

  // Manejador del toggle de notificaciones
  const handleToggleNotifications = async () => {
    const currentPermission = getNotificationPermission();

    // Caso A: El usuario o sistema bloqueó las notificaciones
    if (currentPermission === 'denied') {
      setIsBlocked(true);
      setNotificationsActive(false);
      openSystemNotificationSettings();
      setShowBlockedModal(true);
      toast.error('Notificaciones bloqueadas en el sistema', {
        description: 'Abrí los ajustes de tu navegador o dispositivo para habilitar los avisos.',
      });
      return;
    }

    // Caso B: Permiso por defecto (aún no solicitado al SO)
    if (currentPermission === 'default') {
      const result = await requestNotificationPermission();
      if (result === 'granted') {
        setNotificationsActive(true);
        setNotificationPreference(true);
        setIsBlocked(false);
        toast.success('Notificaciones activadas', {
          description: 'Recibirás avisos del estado de tus reportes.',
        });
        await sendLocalNotification({
          title: 'Reportalo',
          body: 'Notificaciones activadas desde tu perfil.',
        });
      } else if (result === 'denied') {
        setNotificationsActive(false);
        setNotificationPreference(false);
        setIsBlocked(true);
        openSystemNotificationSettings();
        setShowBlockedModal(true);
      }
      return;
    }

    // Caso C: Permiso ya concedido a nivel SO, alternamos la preferencia en la app
    if (notificationsActive) {
      setNotificationsActive(false);
      setNotificationPreference(false);
      toast.info('Notificaciones pausadas en Reportalo');
    } else {
      setNotificationsActive(true);
      setNotificationPreference(true);
      toast.success('Notificaciones activadas');
      await sendLocalNotification({
        title: 'Reportalo',
        body: 'Avisos de reportes reanudados.',
      });
    }
  };

  // Descarga de datos del ciudadano (GDPR / Portabilidad)
  const handleDownloadData = () => {
    try {
      const dataPayload = {
        usuario: {
          id: user?.id || 'demo-user',
          nombre: userName,
          email: userEmail,
        },
        consentimiento_terminos: termsRecord || {
          terms_version: acceptedVersion,
          accepted_at: new Date().toISOString(),
        },
        estadisticas: {
          reportes_totales: 7,
          resueltos: 3,
          sin_enviar: 1,
        },
        exportado_el: new Date().toISOString(),
      };

      const blob = new Blob([JSON.stringify(dataPayload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reportalo_mis_datos_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Descarga iniciada', {
        description: 'Se exportó un archivo JSON con tu historial de usuario y consentimientos.',
      });
    } catch (err) {
      toast.error('Error al exportar datos');
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const handleDeleteAccount = () => {
    setShowDeleteModal(false);
    toast.info('Solicitud enviada', {
      description: 'Tu cuenta y datos serán eliminados de conformidad con la Ley 25.326.',
    });
  };

  return (
    <AppLayout activeTab="perfil">
      <div className="flex-1 overflow-y-auto bg-[#F4F7FB] px-4 sm:px-6 md:px-10 py-4 md:py-6">
        <div className="max-w-5xl mx-auto flex flex-col gap-4 md:gap-6">
          
          {/* Header de Sección */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-extrabold text-[24px] sm:text-[28px] text-[#243447] tracking-[-0.4px] m-0">
                Mi perfil
              </h1>
              <p className="text-[12px] md:text-[13px] text-[#7A8696] font-medium mt-0.5 md:mt-1 mb-0">
                Gestión de cuenta, notificaciones y consentimientos legales
              </p>
            </div>
          </div>

          {/* Grid Responsivo: 1 columna en móvil, 2 columnas en Desktop */}
          <div className="w-full max-w-[340px] md:max-w-none mx-auto grid grid-cols-1 md:grid-cols-12 gap-3.5 md:gap-6">
            
            {/* Columna Izquierda: Identidad + Métricas + Términos (md:col-span-5) */}
            <div className="md:col-span-5 flex flex-col gap-3.5 md:gap-4">
              
              {/* Tarjeta de Identidad de Usuario */}
              <div className="bg-white border border-[#E6ECF3] rounded-[16px] md:rounded-[18px] p-4 md:p-5 flex items-center gap-3.5 md:gap-4 shadow-2xs md:shadow-xs">
                <div className="w-[52px] h-[52px] md:w-[56px] md:h-[56px] rounded-full bg-[#E8F1FB] flex items-center justify-center font-extrabold text-[19px] md:text-[20px] text-[#1E6FCB] flex-shrink-0 select-none shadow-2xs">
                  {userInitials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-extrabold text-[15.5px] md:text-[16px] text-[#243447] truncate leading-tight">
                    {userName}
                  </div>
                  <div className="font-medium text-[11px] text-[#8593A2] mt-0.5 truncate">
                    {userEmail}
                  </div>
                  <span className="font-extrabold text-[9.5px] md:text-[10px] text-[#2E9E6B] bg-[#E3F5EC] px-2 py-0.5 rounded-[6px] uppercase tracking-wider inline-block mt-1.5">
                    Cuenta Verificada
                  </span>
                </div>
              </div>

              {/* 3 Métricas de Reportes */}
              <div className="grid grid-cols-3 gap-2 md:gap-2.5">
                <div className="bg-white border border-[#E6ECF3] rounded-[12px] md:rounded-[14px] p-[11px] md:p-3 text-center shadow-2xs md:shadow-xs">
                  <div className="font-extrabold text-[19px] md:text-[20px] leading-none text-[#1E6FCB]">
                    7
                  </div>
                  <div className="font-bold text-[8.5px] text-[#8593A2] mt-1 md:mt-1.5 tracking-[0.3px] uppercase">
                    REPORTES
                  </div>
                </div>

                <div className="bg-white border border-[#E6ECF3] rounded-[12px] md:rounded-[14px] p-[11px] md:p-3 text-center shadow-2xs md:shadow-xs">
                  <div className="font-extrabold text-[19px] md:text-[20px] leading-none text-[#2E9E6B]">
                    3
                  </div>
                  <div className="font-bold text-[8.5px] text-[#8593A2] mt-1 md:mt-1.5 tracking-[0.3px] uppercase">
                    RESUELTOS
                  </div>
                </div>

                <div className="bg-white border border-[#E6ECF3] rounded-[12px] md:rounded-[14px] p-[11px] md:p-3 text-center shadow-2xs md:shadow-xs">
                  <div className="font-extrabold text-[19px] md:text-[20px] leading-none text-[#F78E35]">
                    1
                  </div>
                  <div className="font-bold text-[8.5px] text-[#8593A2] mt-1 md:mt-1.5 tracking-[0.3px] uppercase">
                    SIN ENVIAR
                  </div>
                </div>
              </div>

              {/* Términos aceptados */}
              <div className="bg-white border border-[#E6ECF3] rounded-[13px] md:rounded-[16px] p-[12px_13px] md:p-5 shadow-2xs md:shadow-xs flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <BadgeCheck className="w-[18px] h-[18px] text-[#2E9E6B] select-none" strokeWidth={2} />
                  <span className="font-bold text-[11.5px] md:text-[12.5px] text-[#263249]">
                    Términos aceptados
                  </span>
                </div>
                <div className="font-medium text-[10.5px] md:text-[11.5px] leading-[1.45] text-[#8593A2] mt-0.5">
                  Versión v{acceptedVersion} · {acceptedDate} a las 14:32, aceptada al enviar el reporte #RP-2048.
                </div>
                <button
                  type="button"
                  data-testid="profile-terms-btn"
                  onClick={() => navigate('/terminos', { state: { consultaDesde: 'perfil' } })}
                  className="font-bold text-[10.5px] md:text-[11.5px] text-[#1E6FCB] hover:text-[#15539E] cursor-pointer bg-transparent border-0 p-0 mt-1 block text-left"
                >
                  Ver el texto aceptado →
                </button>
              </div>

            </div>

            {/* Columna Derecha: Menú de Acciones y Seguridad (md:col-span-7) */}
            <div className="md:col-span-7 flex flex-col gap-3.5 md:gap-4">
              
              {/* Menú de Configuración y Navegación */}
              <div className="bg-white border border-[#E6ECF3] rounded-[13px] md:rounded-[18px] overflow-hidden shadow-2xs md:shadow-xs">
                
                {/* Control Propio: Notificaciones con Toggle */}
                <div className="flex items-center gap-[10px] md:gap-3 p-[11px_13px] md:p-4 border-b border-[#F2F5F9]">
                  <Bell className="w-[19px] h-[19px] md:w-[21px] md:h-[21px] text-[#1E6FCB] select-none" strokeWidth={2} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold md:font-bold text-[12px] md:text-[13px] text-[#34435A]">
                      Notificaciones
                    </div>
                    <div className="font-medium text-[9.5px] md:text-[10.5px] text-[#9AA7B5] mt-0.5">
                      Avisos del estado de tus reportes
                    </div>
                  </div>

                  {/* Toggle switch iOS-style */}
                  <button
                    type="button"
                    role="switch"
                    aria-label="Notificaciones"
                    aria-checked={notificationsActive}
                    onClick={handleToggleNotifications}
                    className={`w-[40px] md:w-[42px] h-[24px] md:h-[25px] rounded-[12px] md:rounded-[13px] flex-shrink-0 relative cursor-pointer border-0 transition-colors p-0 ${
                      notificationsActive ? 'bg-[#1E6FCB]' : 'bg-[#D1D9E2]'
                    }`}
                  >
                    <span
                      className={`absolute top-[2.5px] w-[19px] md:w-[20px] h-[19px] md:h-[20px] rounded-full bg-white transition-all shadow-xs ${
                        notificationsActive ? 'right-[2.5px]' : 'left-[2.5px]'
                      }`}
                    />
                  </button>
                </div>

                {/* Novedades (con ícono newspaper) */}
                <button
                  type="button"
                  data-testid="profile-news-btn"
                  onClick={() => navigate('/alertas')}
                  className="w-full flex items-center gap-[10px] md:gap-3 p-[11px_13px] md:p-4 border-b border-[#F2F5F9] cursor-pointer hover:bg-slate-50 transition-colors text-left bg-transparent border-0"
                >
                  <Newspaper className="w-[19px] h-[19px] md:w-[21px] md:h-[21px] text-[#1E6FCB] select-none" strokeWidth={2} />
                  <span className="font-semibold md:font-bold text-[12px] md:text-[13px] text-[#34435A] flex-1">
                    Novedades
                  </span>
                  <ChevronRight className="w-[18px] h-[18px] text-[#C3CED9] select-none" strokeWidth={2.25} />
                </button>

                {/* Permisos de la app */}
                <button
                  type="button"
                  data-testid="profile-permissions-btn"
                  onClick={() => navigate('/permisos')}
                  className="w-full flex items-center gap-[10px] md:gap-3 p-[11px_13px] md:p-4 border-b border-[#F2F5F9] cursor-pointer hover:bg-slate-50 transition-colors text-left bg-transparent border-0"
                >
                  <ShieldCheck className="w-[19px] h-[19px] md:w-[21px] md:h-[21px] text-[#1E6FCB] select-none" strokeWidth={2} />
                  <span className="font-semibold md:font-bold text-[12px] md:text-[13px] text-[#34435A] flex-1">
                    Permisos de la app
                  </span>
                  <ChevronRight className="w-[18px] h-[18px] text-[#C3CED9] select-none" strokeWidth={2.25} />
                </button>

                {/* Descargar mis datos */}
                <button
                  type="button"
                  data-testid="profile-download-btn"
                  onClick={handleDownloadData}
                  className="w-full flex items-center gap-[10px] md:gap-3 p-[11px_13px] md:p-4 cursor-pointer hover:bg-slate-50 transition-colors text-left bg-transparent border-0"
                >
                  <Download className="w-[19px] h-[19px] md:w-[21px] md:h-[21px] text-[#1E6FCB] select-none" strokeWidth={2} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold md:font-bold text-[12px] md:text-[13px] text-[#34435A]">
                      Descargar mis datos
                    </div>
                  </div>
                  <ChevronRight className="w-[18px] h-[18px] text-[#C3CED9] select-none" strokeWidth={2.25} />
                </button>
              </div>

              {/* Acciones de Sesión y Cuenta */}
              <div className="bg-transparent md:bg-white md:border md:border-[#E6ECF3] rounded-[18px] md:p-5 md:shadow-xs flex flex-col gap-2 md:gap-3 mt-auto md:mt-0 pt-1 pb-3 md:py-5">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full text-center p-[11px] md:p-3 border-[1.5px] border-[#DDE4EC] rounded-[12px] font-bold text-[12.5px] md:text-[13px] text-[#56657A] hover:bg-slate-50 active:scale-98 transition-all cursor-pointer bg-white"
                >
                  Cerrar sesión
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(true)}
                  className="w-full text-center font-semibold text-[10.5px] md:text-[11px] text-[#C0392B] hover:underline cursor-pointer bg-transparent border-0 py-1"
                >
                  Eliminar mi cuenta y mis datos
                </button>
              </div>

            </div>
          </div>

        </div>
      </div>

      {/* Modal: Permiso de Notificaciones Bloqueado en el Sistema Operativo / Navegador */}
      {showBlockedModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-notif-blocked-title"
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-[20px] max-w-sm w-full p-5 shadow-xl border border-slate-100 flex flex-col gap-3 font-manrope">
            <div className="w-10 h-10 rounded-full bg-[#FFF1F0] text-[#E74C3C] flex items-center justify-center">
              <BellOff className="w-[22px] h-[22px]" strokeWidth={2.25} />
            </div>
            <h3 id="modal-notif-blocked-title" className="font-extrabold text-[15px] text-[#243447] m-0">
              Notificaciones bloqueadas en tu dispositivo
            </h3>
            <p className="text-[12px] leading-relaxed text-[#64748B] m-0">
              Las notificaciones se encuentran desactivadas a nivel de sistema operativo o navegador.
            </p>
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[10px] p-2.5 text-[11px] text-[#475569] space-y-1">
              <p className="m-0 font-bold text-[#1E293B]">Cómo habilitarlas:</p>
              <p className="m-0">1. Tocá <strong>Abrir ajustes del SO</strong> abajo.</p>
              <p className="m-0">2. O tocá el ícono de ajustes/candado en tu navegador y activá <strong>Permitir notificaciones</strong>.</p>
            </div>
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => {
                  openSystemNotificationSettings();
                  setShowBlockedModal(false);
                }}
                className="flex-1 py-2.5 px-3 bg-[#1E6FCB] text-white rounded-[10px] font-bold text-[12px] hover:bg-[#15539E] cursor-pointer border-0"
              >
                Abrir ajustes del SO
              </button>
              <button
                type="button"
                onClick={() => setShowBlockedModal(false)}
                className="py-2.5 px-3 bg-slate-100 text-[#475569] rounded-[10px] font-bold text-[12px] hover:bg-slate-200 cursor-pointer border-0"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmación para Eliminar Cuenta */}
      {showDeleteModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-delete-title"
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-[20px] max-w-sm w-full p-5 shadow-xl border border-slate-100 flex flex-col gap-3 font-manrope">
            <div className="w-10 h-10 rounded-full bg-[#FFF1F0] text-[#E74C3C] flex items-center justify-center">
              <Trash2 className="w-[22px] h-[22px]" strokeWidth={2.25} />
            </div>
            <h3 id="modal-delete-title" className="font-extrabold text-[15px] text-[#243447] m-0">
              ¿Eliminar cuenta y datos?
            </h3>
            <p className="text-[12px] leading-relaxed text-[#64748B] m-0">
              Esta acción eliminará tus datos personales y credenciales de conformidad con la Ley 25.326. Los reportes comunitarios anónimos ya enviados permanecerán disociados.
            </p>
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={handleDeleteAccount}
                className="flex-1 py-2.5 px-3 bg-[#E74C3C] text-white rounded-[10px] font-bold text-[12px] hover:bg-[#C0392B] cursor-pointer border-0"
              >
                Sí, eliminar
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="py-2.5 px-3 bg-slate-100 text-[#475569] rounded-[10px] font-bold text-[12px] hover:bg-slate-200 cursor-pointer border-0"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

