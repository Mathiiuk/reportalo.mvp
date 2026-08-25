import React from 'react';

// Status badge styling map matching the design system
const STATUS_CONFIG = {
  pending: {
    label: 'PENDIENTE',
    badgeClass: 'bg-[#FFF7ED] text-[#D97706] border border-[#FDE68A]/60',
    cardBorder: 'border-[#FDE68A]/60 hover:border-[#F59E0B]/50',
    tab: 'in_progress',
  },
  reviewing: {
    label: 'EN REVISIÓN',
    badgeClass: 'bg-[#E0F2FE] text-[#0284C7] border border-[#BAE6FD]',
    cardBorder: 'border-slate-100 hover:border-slate-200',
    tab: 'in_progress',
  },
  notified: {
    label: 'NOTIFICADO',
    badgeClass: 'bg-[#F3E8FF] text-[#9333EA] border border-[#E9D5FF]',
    cardBorder: 'border-slate-100 hover:border-slate-200',
    tab: 'in_progress',
  },
  resolved: {
    label: 'RESUELTO',
    badgeClass: 'bg-[#DCFCE7] text-[#16A34A] border border-[#BBF7D0]',
    cardBorder: 'border-slate-100 hover:border-slate-200',
    tab: 'resolved',
  },
  dismissed: {
    label: 'DESCARTADO',
    badgeClass: 'bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0]',
    cardBorder: 'border-slate-100 hover:border-slate-200',
    tab: 'resolved',
  },
};

export const ReporteCard = ({ report, onClick }) => {
  const statusInfo = STATUS_CONFIG[report.status] || STATUS_CONFIG.reviewing;

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={`w-full bg-white rounded-[22px] p-4 flex items-center justify-between gap-3 shadow-[0_2px_12px_rgba(0,0,0,0.03)] border transition-all duration-200 cursor-pointer active:scale-[0.99] select-none ${statusInfo.cardBorder}`}
    >
      {/* Izquierda: Thumbnail o Icono + Textos */}
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        {/* Imagen o Contenedor de Icono */}
        {report.image ? (
          <img
            src={report.image}
            alt={report.title}
            className="w-14 h-14 rounded-2xl object-cover shrink-0 bg-slate-100 border border-slate-100"
          />
        ) : (
          <div className="w-14 h-14 rounded-2xl bg-[#E8EEF5] flex items-center justify-center shrink-0 text-[#64748B]">
            <span className="material-symbols-rounded text-[26px]">
              {report.icon || 'location_on'}
            </span>
          </div>
        )}

        {/* Textos */}
        <div className="flex flex-col min-w-0 flex-1">
          <h3 className="text-[15px] font-extrabold text-[#1B365D] truncate leading-tight">
            {report.id ? `${report.id} · ${report.category || report.title}` : report.title}
          </h3>
          <p className="text-[12px] font-medium text-[#7A8A9E] mt-1 truncate">
            {report.subtitle || `${report.location} · ${report.date}`}
          </p>
        </div>
      </div>

      {/* Derecha: Badge de estado */}
      <div className="shrink-0">
        <span
          className={`inline-block px-2.5 py-1 rounded-lg text-[10.5px] font-extrabold tracking-wide uppercase ${statusInfo.badgeClass}`}
        >
          {statusInfo.label}
        </span>
      </div>
    </div>
  );
};
