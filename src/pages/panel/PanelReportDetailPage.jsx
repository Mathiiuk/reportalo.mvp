import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, MapPin, Scale } from 'lucide-react';
import { useNoIndex } from '../../hooks/useNoIndex';
import { useOperator } from '../../components/panel/OperatorRoute';
import { getPanelReportDetail, formatCaseNumber } from '../../services/panelService';
import { signEvidenceImages } from '../../services/reportDetailService';

// Calle y altura si existen (REP-3843); el operador ve las dos (REP-3876 §8)
const formatAddress = ({ street, number }) =>
  street?.trim() ? [street.trim(), number?.trim()].filter(Boolean).join(' ') : 'Dirección no disponible';

// Textos del PO (Hernán, 24/10)
const SANCTION_NOTICE = 'Sanción prevista por la norma; Reportalo no aplica sanciones.';
const NO_SANCTION = 'La norma no registra sanción.';
const NOT_AVAILABLE = 'Este reporte no está disponible para tu organismo.';

const formatearFecha = (iso) =>
  new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Argentina/Buenos_Aires' });

const CARD = 'rounded-xl border border-rep-border bg-rep-surface px-5 py-4';

/** Fundamento tal como lo verificó la base: citas, sanciones con la leyenda del PO, o el estado si no hay. */
const Fundamento = ({ foundation }) => {
  const citas = foundation?.citations ?? [];
  if (foundation?.status !== 'fundamento_preliminar' || citas.length === 0) {
    const texto =
      foundation?.status === 'pendiente'
        ? 'Fundamento pendiente: el análisis todavía no terminó.'
        : `Sin fundamento verificado. ${foundation?.abstention_reason ?? ''}`.trim();
    return <p className="m-0 text-rep-body text-rep-ink-muted">{texto}</p>;
  }
  const hayNorma = citas.some((c) => c.foundation_type !== 'sancion');
  const sanciones = citas.filter((c) => c.foundation_type === 'sancion');
  return (
    <div className="flex flex-col gap-3">
      {citas
        .filter((c) => c.foundation_type !== 'sancion')
        .map((c, i) => (
          <div key={`n-${i}`}>
            <p className="m-0 text-rep-body font-bold text-rep-ink">{c.reference}</p>
            {c.quoted_text && <p className="m-0 mt-1 text-rep-body text-rep-ink-body">«{c.quoted_text}»</p>}
            {c.source_url && (
              <a href={c.source_url} target="_blank" rel="noreferrer" className="text-rep-label text-rep-accent">
                Fuente oficial
              </a>
            )}
          </div>
        ))}
      {sanciones.length > 0 ? (
        <div className="rounded-lg border border-rep-border px-3 py-2">
          <p className="m-0 text-rep-label font-bold text-rep-ink-label">{SANCTION_NOTICE}</p>
          {sanciones.map((c, i) => (
            <div key={`s-${i}`} className="mt-2">
              <p className="m-0 text-rep-body font-bold text-rep-ink">{c.reference}</p>
              {c.quoted_text && <p className="m-0 mt-1 text-rep-body text-rep-ink-body">«{c.quoted_text}»</p>}
            </div>
          ))}
        </div>
      ) : (
        hayNorma && <p className="m-0 text-rep-label text-rep-ink-muted">{NO_SANCTION}</p>
      )}
      {foundation.disclaimer && <p className="m-0 text-[11px] text-rep-ink-faint">{foundation.disclaimer}</p>}
    </div>
  );
};

/**
 * REP-3749 · Detalle de un reporte para el operador del organismo de prueba (escritorio).
 * Todo lo que se muestra lo decide la base (get_panel_report_detail): sin identidad, sin contactos, sin foto original.
 */
export const PanelReportDetailPage = () => {
  useNoIndex();
  const { id } = useParams();
  const operador = useOperator();
  const [estado, setEstado] = useState({ status: 'loading' });
  const [fotos, setFotos] = useState([]);

  const cargar = useCallback(async () => {
    setEstado({ status: 'loading' });
    const resultado = await getPanelReportDetail(id);
    setEstado(resultado);
    if (resultado.status === 'ok') setFotos(await signEvidenceImages(resultado.report.images));
  }, [id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const reporte = estado.report;

  return (
    <div className="min-h-[100dvh] w-full bg-rep-bg font-manrope">
      <header className="flex items-center gap-3 border-b border-rep-divider bg-rep-surface px-6 py-4">
        <Link to="/panel" aria-label="Volver a la bandeja" className="rep-focus flex items-center text-rep-ink-label">
          <ArrowLeft aria-hidden="true" className="h-5 w-5" strokeWidth={2.25} />
        </Link>
        <Building2 aria-hidden="true" className="h-6 w-6 text-rep-ink-label" strokeWidth={2.25} />
        <p className="m-0 truncate text-rep-label font-semibold text-rep-ink-muted">{operador?.agency?.name}</p>
      </header>

      <main className="mx-auto max-w-[960px] px-6 py-8">
        {estado.status === 'loading' && <p className="m-0 text-rep-body text-rep-ink-muted">Cargando el reporte...</p>}

        {estado.status === 'not_available' && (
          <section className={`${CARD} text-center`}>
            <p className="m-0 text-rep-body text-rep-ink">{NOT_AVAILABLE}</p>
            <Link to="/panel" className="mt-3 inline-block text-rep-body font-bold text-rep-accent">
              Volver a la bandeja
            </Link>
          </section>
        )}

        {estado.status === 'error' && (
          <section className={`${CARD} text-center`}>
            <p role="alert" className="m-0 text-rep-body text-rep-ink-muted">
              No pudimos cargar el reporte. Revisá tu conexión y volvé a intentar.
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

        {estado.status === 'ok' && reporte && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="m-0 text-rep-title text-rep-ink">{formatCaseNumber(reporte.case_number) ?? reporte.report_code}</h1>
              <span className="font-mono text-rep-label font-bold text-rep-ink-label">{reporte.report_code}</span>
              <span className="rounded-full border border-rep-border px-3 py-1 text-rep-label font-bold text-rep-ink-label">
                {reporte.state_label || reporte.state_code}
              </span>
            </div>

            <section className={CARD}>
              <p className="m-0 text-rep-label font-semibold text-rep-ink-muted">
                {formatearFecha(reporte.created_at)}
              </p>
              <p className="m-0 mt-1 text-rep-body font-bold text-rep-ink">{reporte.category || 'Sin categoría'}</p>
              <p className="m-0 mt-2 text-rep-body text-rep-ink-body">{reporte.description || 'Sin descripción adicional'}</p>
            </section>

            <section className={`${CARD} flex items-start gap-2.5`}>
              <MapPin aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rep-accent" strokeWidth={2.25} />
              <div className="min-w-0">
                {/* El operador ve calle y altura (REP-3876 §8) */}
                <p className="m-0 text-rep-body font-bold text-rep-ink">
                  {formatAddress({ street: reporte.address_street, number: reporte.address_number })}
                </p>
                <p className="m-0 text-rep-label text-rep-ink-muted">
                  {[reporte.locality, reporte.subdivision].filter(Boolean).join(', ')}
                  {typeof reporte.latitud === 'number' && ` · ${reporte.latitud.toFixed(5)}, ${reporte.longitud.toFixed(5)}`}
                </p>
              </div>
            </section>

            {fotos.length > 0 && (
              <section className={CARD}>
                <p className="m-0 mb-2 text-rep-label font-semibold text-rep-ink-muted">Fotos (anonimizadas)</p>
                <div className="grid grid-cols-2 gap-2 desktop:grid-cols-3">
                  {fotos.map((foto, i) => (
                    <img key={foto.id} src={foto.image_url} alt={`Foto anonimizada ${i + 1}`} className="w-full rounded-lg object-cover" />
                  ))}
                </div>
              </section>
            )}

            <section className={CARD}>
              <p className="m-0 mb-2 flex items-center gap-2 text-rep-label font-semibold text-rep-ink-muted">
                <Scale aria-hidden="true" className="h-4 w-4" strokeWidth={2.25} />
                Fundamento legal preliminar
              </p>
              <Fundamento foundation={reporte.foundation} />
            </section>

            {/* REP-3001: acá van las acciones del operador (tomar, rechazar, marcar resuelto) */}
          </div>
        )}
      </main>
    </div>
  );
};

export default PanelReportDetailPage;
