import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, ChevronRight, MapPin } from 'lucide-react';
import { useNoIndex } from '../../hooks/useNoIndex';
import { useOperator } from '../../components/panel/OperatorRoute';
import { getPanelInbox, formatCaseNumber } from '../../services/panelService';

// Fecha corta en hora argentina, igual para todos los operadores
const formatearFecha = (iso) =>
  new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' });

/**
 * REP-3747 / REP-3000 · Panel de organismos (escritorio): el organismo de prueba del operador y su bandeja.
 * Qué reportes entran lo decide la base; esta pantalla solo los muestra. Cada fila lleva al detalle (REP-3749).
 */
export const PanelPage = () => {
  useNoIndex();
  const operador = useOperator();
  const organismo = operador?.agency;
  const [estado, setEstado] = useState({ status: 'loading', reports: [] });

  const cargar = useCallback(async () => {
    setEstado({ status: 'loading', reports: [] });
    const resultado = await getPanelInbox();
    setEstado(resultado.success ? { status: 'ready', reports: resultado.reports } : { status: 'error', reports: [] });
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <div className="min-h-[100dvh] w-full bg-rep-bg font-manrope">
      <header className="flex items-center gap-3 border-b border-rep-divider bg-rep-surface px-6 py-4">
        <Building2 aria-hidden="true" className="h-6 w-6 text-rep-ink-label" strokeWidth={2.25} />
        <div className="min-w-0">
          <h1 className="m-0 text-rep-section-d text-rep-ink">Panel de organismos</h1>
          <p className="m-0 truncate text-rep-label font-semibold text-rep-ink-muted">{organismo?.name}</p>
        </div>
        {organismo?.is_test && (
          <span className="ml-auto rounded-full border border-rep-border px-3 py-1 text-rep-label font-bold text-rep-ink-label">
            Entorno de prueba
          </span>
        )}
      </header>

      <main className="mx-auto max-w-[960px] px-6 py-10">
        <h2 className="m-0 mb-4 text-rep-title text-rep-ink">Bandeja</h2>

        {estado.status === 'loading' && <p className="m-0 text-rep-body text-rep-ink-muted">Cargando la bandeja...</p>}

        {estado.status === 'error' && (
          <section className="rounded-xl border border-rep-border bg-rep-surface px-6 py-8 text-center">
            <p role="alert" className="m-0 text-rep-body text-rep-ink-muted">
              No pudimos cargar la bandeja. Revisá tu conexión y volvé a intentar.
            </p>
            <button
              type="button"
              onClick={cargar}
              className="rep-focus mt-4 min-h-touch rounded-[13px] border-0 bg-rep-accent px-6 text-rep-button text-rep-on-accent"
            >
              Reintentar
            </button>
          </section>
        )}

        {estado.status === 'ready' && estado.reports.length === 0 && (
          <section className="rounded-xl border border-rep-border bg-rep-surface px-6 py-10 text-center">
            <h3 className="m-0 text-rep-title text-rep-ink">Todavía no hay reportes en tu bandeja</h3>
            <p className="m-0 mt-2 text-rep-body text-rep-ink-muted">
              Acá vas a ver los reportes de tu jurisdicción que lleguen a este organismo de prueba. Ningún municipio real
              recibe estos reportes.
            </p>
          </section>
        )}

        {estado.status === 'ready' && estado.reports.length > 0 && (
          <ul className="m-0 list-none divide-y divide-rep-divider overflow-hidden rounded-xl border border-rep-border bg-rep-surface p-0">
            {estado.reports.map((reporte) => (
              <li key={reporte.report_id}>
                <Link
                  to={`/panel/reportes/${reporte.report_id}`}
                  className="rep-focus flex items-center gap-4 px-5 py-4 text-inherit no-underline hover:bg-rep-bg"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-rep-label font-bold text-rep-ink-label">{reporte.report_code}</span>
                      {reporte.case_number != null && (
                        <span className="text-rep-label font-semibold text-rep-ink-muted">{formatCaseNumber(reporte.case_number)}</span>
                      )}
                      <span className="text-rep-body font-bold text-rep-ink">{reporte.category || 'Sin categoría'}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-rep-label text-rep-ink-muted">
                      <span className="flex items-center gap-1">
                        <MapPin aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.25} />
                        <span>{reporte.zone || 'Zona no disponible'}</span>
                      </span>
                      <span>{formatearFecha(reporte.created_at)}</span>
                    </div>
                  </div>
                  <span className="rounded-full border border-rep-border px-3 py-1 text-rep-label font-bold text-rep-ink-label">
                    {reporte.state_label || reporte.state_code}
                  </span>
                  <ChevronRight aria-hidden="true" className="h-5 w-5 text-rep-ink-faint" strokeWidth={2.25} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
};

export default PanelPage;
