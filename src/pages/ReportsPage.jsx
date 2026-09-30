import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { motion } from 'framer-motion';
import { ImagePlus, MapPin, CloudOff, ChevronRight, Inbox } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getMyReports } from '../services/reportSubmissionService';
import { isClosedState } from '../components/report/reportStatus';
import { StatusPill } from '../components/report/StatusPill';
import { EmptyState } from '../components/common/EmptyState';
import { getAllPendingSyncReports } from '../services/offlineStorageService';

// Insignias del listado. El agrupamiento sale de reportStatus (fuente única de
// verdad, REP-3791 Bloque 3), que traduce los códigos reales de la base
// (RECIBIDO / EN_ANALISIS / DERIVADO / RESUELTO / DESESTIMADO) a las etiquetas
// del §10 del UJ v3.3. Antes salía de REPORT_STATE_META, que hacía lo mismo pero
// en paralelo: mantener dos taxonomías era pedir que divergieran, como ya había
// pasado antes en este archivo.
const CLOSED_BADGE = { status: 'Resueltos', statusColor: 'bg-[#E3F5EC] text-[#2E9E6B]' };
const OPEN_BADGE = { status: 'En curso', statusColor: 'bg-[#FFF6E9] text-[#E08A00]' };

const formatReportDate = (isoDate) => {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  const formatted = date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
  return formatted.replace('.', '').replace(/^\w/, (c) => c.toUpperCase());
};

// Adapta una fila real de citizen_reports al formato de tarjeta ya usado por el listado (REP-2500)
const mapReportRow = (row) => {
  const badge = isClosedState(row.current_state_code) ? CLOSED_BADGE : OPEN_BADGE;
  return {
    id: row.id,
    stateCode: row.current_state_code,
    title: row.description,
    category: row.services?.service_name || 'Sin categoría',
    status: badge.status,
    statusColor: badge.statusColor,
    date: formatReportDate(row.created_at),
    address: row.localities?.name || 'Localidad sin especificar',
  };
};

export const ReportsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = useState('todos');
  const [myReports, setMyReports] = useState([]);
  const [isLoadingReports, setIsLoadingReports] = useState(true);
  // UJ v3.3 · M17: los borradores sin enviar encabezan la lista (REP-3791 Bloque 6)
  const [pendingDrafts, setPendingDrafts] = useState([]);

  useEffect(() => {
    let isMounted = true;
    getAllPendingSyncReports()
      .then((drafts) => {
        if (isMounted) setPendingDrafts(drafts || []);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    if (!user?.id) {
      setIsLoadingReports(false);
      return undefined;
    }
    getMyReports(user.id).then((result) => {
      if (!isMounted) return;
      if (result.success) {
        setMyReports(result.reports.map(mapReportRow));
      }
      setIsLoadingReports(false);
    });
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const currentReports = myReports;

  const filteredReports = currentReports.filter((r) => {
    if (activeFilter === 'todos') return true;
    if (activeFilter === 'en curso') return r.status === 'En curso';
    if (activeFilter === 'resueltos') return r.status === 'Resueltos';
    return true;
  });

  const countTodos = currentReports.length;
  const countEnCurso = currentReports.filter((r) => r.status === 'En curso').length;
  const countResueltos = currentReports.filter((r) => r.status === 'Resueltos').length;

  const draftTitle = (draft) => {
    const text = String(draft.description || '').trim().split('\n')[0];
    if (!text) return 'Reporte sin descripción';
    return text.length > 48 ? `${text.slice(0, 47)}…` : text;
  };

  const showDrafts = pendingDrafts.length > 0 && activeFilter !== 'resueltos';

  return (
    <AppLayout activeTab="reportes">
      <div className="flex-1 overflow-y-auto bg-rep-bg px-4 pb-28 pt-5 sm:px-6 md:px-10 md:pb-10">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
          {/* Título */}
          <div>
            <h1 className="m-0 text-rep-title text-rep-ink md:text-rep-title-d">Mis reportes</h1>
            <p className="m-0 mt-1 text-rep-label text-rep-ink-muted md:text-rep-label-d">
              Seguimiento de lo que enviaste y de lo que todavía está en este dispositivo.
            </p>
          </div>

          {/* Filtros con recuento (M17 · D18) */}
          <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1">
            {[
              { key: 'todos', label: 'Todos', count: countTodos },
              { key: 'en curso', label: 'En curso', count: countEnCurso },
              { key: 'resueltos', label: 'Resueltos', count: countResueltos },
            ].map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => setActiveFilter(filter.key)}
                aria-pressed={activeFilter === filter.key}
                className={`rep-focus min-h-touch shrink-0 rounded-xl border px-3.5 text-rep-label font-bold transition-colors duration-120 ${
                  activeFilter === filter.key
                    ? 'border-rep-accent bg-rep-accent text-rep-on-accent'
                    : 'border-rep-border bg-rep-surface text-rep-ink-label'
                }`}
              >
                {filter.label} · {filter.count}
              </button>
            ))}
          </div>

          {/* Borradores sin enviar, arriba y con borde ámbar */}
          {showDrafts && (
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {pendingDrafts.map((draft) => (
                <li key={draft.client_side_id}>
                  <button
                    type="button"
                    onClick={() => navigate('/pendientes')}
                    data-testid="pending-draft-row"
                    className="rep-focus flex w-full items-center gap-3 rounded-2xl border-2 border-rep-warning/50 bg-rep-surface p-4 text-left shadow-rep-card transition-[filter] duration-120 hover:brightness-[.98] dark:hover:brightness-[1.04]"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rep-warning-soft text-rep-warning-ink">
                      <CloudOff aria-hidden="true" className="h-5 w-5" strokeWidth={2.25} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-rep-body font-bold text-rep-ink md:text-rep-body-d">{draftTitle(draft)}</span>
                      <span className="truncate text-rep-label text-rep-ink-muted">Sin enviar · esperando conexión</span>
                    </span>
                    <span className="shrink-0 rounded-lg bg-rep-warning-soft px-2.5 py-1 text-rep-pill uppercase tracking-wide text-rep-warning-ink">
                      Pendiente
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {isLoadingReports ? (
            <div className="py-10 text-center text-rep-body font-semibold text-rep-ink-muted">Cargando tus reportes…</div>
          ) : filteredReports.length === 0 && !showDrafts ? (
            /* Estado vacío (UJ v3.3 · M26 / D34 — REP-3791 Bloque 9).
               No se dibuja si hay borradores arriba: el ciudadano acaba de cargar un
               reporte y lo está viendo en pantalla, así que decirle «todavía no
               enviaste reportes» y ofrecerle «hacer mi primer reporte» lo contradice. */
            <EmptyState
              icon={Inbox}
              title="Todavía no enviaste reportes"
              description="Cuando envíes uno, acá vas a poder seguir su estado paso a paso hasta que se resuelva."
              primaryAction={{ label: 'Hacer mi primer reporte', icon: ImagePlus, onClick: () => navigate('/nuevo-reporte') }}
              secondaryAction={{ label: 'Ver el mapa de la zona', onClick: () => navigate('/mapa') }}
            />
          ) : filteredReports.length === 0 ? null : (
            /* Lista: tarjetas en teléfono, filas en escritorio (D18) */
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {filteredReports.map((report) => (
                <li key={report.id}>
                  <motion.button
                    type="button"
                    whileHover={{ y: -2 }}
                    onClick={() => navigate(`/reportes/${report.id}`)}
                    data-testid="report-row"
                    className="rep-focus flex w-full items-start gap-3 rounded-2xl border border-rep-border bg-rep-surface p-4 text-left shadow-rep-card transition-[filter] duration-120 hover:brightness-[.98] dark:hover:brightness-[1.04] md:items-center"
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-1 md:flex-row md:items-center md:gap-4">
                      <span className="min-w-0 md:w-[320px] md:shrink-0">
                        <span className="block truncate text-rep-body font-bold text-rep-ink md:text-rep-body-d">{report.title}</span>
                        <span className="block truncate text-rep-label text-rep-ink-muted">{report.category}</span>
                      </span>
                      <span className="flex min-w-0 flex-1 items-center gap-1 text-rep-label text-rep-ink-muted">
                        <MapPin aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-rep-accent" />
                        <span className="truncate">{report.address}</span>
                        <span className="shrink-0">· {report.date}</span>
                      </span>
                    </span>

                    {report.stateCode ? (
                      <StatusPill state={report.stateCode} short className="shrink-0" />
                    ) : (
                      <span className="shrink-0 rounded-lg bg-rep-accent-soft px-2.5 py-1 text-rep-pill uppercase tracking-wide text-rep-accent">
                        {report.status}
                      </span>
                    )}
                    <ChevronRight aria-hidden="true" className="hidden h-4 w-4 shrink-0 text-rep-ink-faint md:block" />
                  </motion.button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default ReportsPage;
