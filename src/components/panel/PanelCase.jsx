import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ms } from './PanelShell';
import { StateBadge } from './PanelInbox';
import { PanelCaseMap } from './PanelCaseMap';
import {
  CONTACT_MARK,
  FINAL_STATES,
  ROAD_TYPE,
  STATE_LABEL,
  addressLabel,
  buildPanelTimeline,
  caseLabel,
  coordLabel,
  dayWord,
  ddmm,
  hasHiddenContact,
  hhmm,
} from './panelFormat';
import { getPanelReportDetail } from '../../services/panelService';
import { signEvidenceImages } from '../../services/reportDetailService';

/*
 * REP-3749 · Detalle del caso con el diseño de Iván (LEEME §5.2): lo que se muestra lo decide la base
 * (get_panel_report_detail). Las acciones (tomar, rechazar, marcar resuelto) llegan con REP-3001.
 */

// Textos del PO (Hernán, 24/10)
const SANCTION_NOTICE = 'Sanción prevista por la norma; Reportalo no aplica sanciones.';
const NO_SANCTION = 'La norma no registra sanción.';
const NOT_AVAILABLE = 'Este reporte no está disponible para tu organismo.';

/** Descripción con las marcas de REP-3874 como etiquetas. */
const Description = ({ text }) => {
  if (!text) return 'Sin descripción adicional';
  const parts = text.split(new RegExp(CONTACT_MARK.source, 'gi'));
  // split con grupo de captura: los índices impares son las marcas
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <span key={i} className="mask">
        {part}
      </span>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );
};

/** Fundamento tal como lo verificó la base: citas y sanciones con la leyenda del PO, o el estado si no hay. */
const Foundation = ({ foundation }) => {
  const citations = foundation?.citations ?? [];
  if (foundation?.status !== 'fundamento_preliminar' || citations.length === 0) {
    const text =
      foundation?.status === 'pendiente'
        ? 'Fundamento pendiente: el análisis todavía no terminó.'
        : `Sin fundamento verificado. ${foundation?.abstention_reason ?? ''}`.trim();
    return <div className="txt">{text}</div>;
  }
  const norms = citations.filter((c) => c.foundation_type !== 'sancion');
  const sanctions = citations.filter((c) => c.foundation_type === 'sancion');
  return (
    <>
      {norms.map((c, i) => (
        <div key={`n-${i}`} className="txt">
          <b>{c.reference}</b>
          {c.quoted_text && <div>«{c.quoted_text}»</div>}
          {c.source_url && (
            <a href={c.source_url} target="_blank" rel="noopener noreferrer">
              Fuente oficial
            </a>
          )}
        </div>
      ))}
      {sanctions.length > 0 ? (
        <div className="txt">
          <div className="hint">{SANCTION_NOTICE}</div>
          {sanctions.map((c, i) => (
            <div key={`s-${i}`}>
              <b>{c.reference}</b>
              {c.quoted_text && <div>«{c.quoted_text}»</div>}
            </div>
          ))}
        </div>
      ) : (
        norms.length > 0 && <div className="hint">{NO_SANCTION}</div>
      )}
      <div className="hint">Análisis automático · lo valida el operador</div>
    </>
  );
};

const TimelineItem = ({ item }) => (
  <li className={`s-${item.code}`}>
    <div className="tl-date">
      <b>{ddmm(item.at)}</b>
      <span>{hhmm(item.at)}</span>
    </div>
    <div className="tl-rail">
      <span className={`dot${item.kind === 'event' ? ' ev' : ''}`} />
      <span className="line" />
    </div>
    <div className="tl-body">
      <div className="tl-l1">
        <strong>{item.label}</strong>
        <StateBadge code={item.code} />
      </div>
      {item.actor && (
        <div className="tl-by">
          <Ms name="account_balance" />
          <span>{item.actor}</span>
        </div>
      )}
      {(item.reason || item.escalatedTo) && (
        <div className="tl-why">
          {item.escalatedTo && (
            <dl>
              <dt>Corresponde a</dt>
              <dd>{item.escalatedTo}</dd>
              {item.contact && (
                <>
                  <dt>Contacto</dt>
                  <dd>{item.contact}</dd>
                </>
              )}
            </dl>
          )}
          {item.reason && (
            <span>
              <span className="lbl">Motivo</span>«{item.reason}»
            </span>
          )}
        </div>
      )}
    </div>
  </li>
);

/** Visor de fotos: flechas, miniaturas y teclado (← → Esc). */
const Lightbox = ({ photos, index, onStep, onGo, onClose }) => {
  const closeRef = useRef(null);
  useEffect(() => {
    closeRef.current?.focus();
  }, []);
  const n = photos.length;
  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={`Foto ${index + 1} de ${n}`}>
      <div className="lb-top">
        <b>{`Foto ${index + 1} de ${n}`}</b>
        <span className="shield">
          <Ms name="shield" fill />
          PROTEGIDA
        </span>
        <button type="button" className="icon-btn" aria-label="Cerrar" ref={closeRef} onClick={onClose}>
          <Ms name="close" />
        </button>
      </div>
      <div className="lb-stage">
        {n > 1 && (
          <button type="button" className="lb-nav" aria-label="Foto anterior" disabled={index === 0} onClick={() => onStep(-1)}>
            <Ms name="chevron_left" />
          </button>
        )}
        <img src={photos[index].image_url} alt={`Foto ${index + 1} del reporte, con rostros y patentes difuminados`} />
        {n > 1 && (
          <button type="button" className="lb-nav" aria-label="Foto siguiente" disabled={index === n - 1} onClick={() => onStep(1)}>
            <Ms name="chevron_right" />
          </button>
        )}
      </div>
      {n > 1 && (
        <div className="lb-thumbs">
          {photos.map((p, k) => (
            <button
              key={p.id}
              type="button"
              style={{ backgroundImage: `url('${p.image_url}')` }}
              aria-current={k === index}
              aria-label={`Foto ${k + 1}`}
              onClick={() => onGo(k)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * @param {{ id: string, agencyName: string, inboxHref: string, onLoaded?: (report: object) => void }} props
 */
export const PanelCase = ({ id, agencyName, inboxHref, onLoaded }) => {
  const [state, setState] = useState({ status: 'loading', report: null });
  const [photos, setPhotos] = useState([]);
  const [lightbox, setLightbox] = useState(null);
  const [showMap, setShowMap] = useState(false);

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setState({ status: 'loading', report: null });
      const result = await getPanelReportDetail(id);
      if (silent && result.status === 'error') return;
      setState(result);
      if (result.status === 'ok') {
        onLoaded?.(result.report);
        // Al releer después de una acción las fotos no cambian: no se vuelven a firmar (evita el parpadeo)
        if (!silent) setPhotos(await signEvidenceImages(result.report.images ?? []));
      }
    },
    [id, onLoaded]
  );

  useEffect(() => {
    setLightbox(null);
    load();
  }, [load]);

  // Teclado del visor: ← → y Esc
  useEffect(() => {
    if (!lightbox) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setLightbox(null);
      if (event.key === 'ArrowRight') setLightbox((lb) => ({ i: Math.min(photos.length - 1, lb.i + 1) }));
      if (event.key === 'ArrowLeft') setLightbox((lb) => ({ i: Math.max(0, lb.i - 1) }));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const report = state.report;

  if (state.status === 'loading') {
    return (
      <section className="detail" aria-busy="true">
        <div className="detail-scroll">
          <div className="detail-inner">
            <div className="skel" style={{ height: 22, width: 220 }} />
            <div className="skel" style={{ height: 14, width: 320 }} />
            <div className="skel" style={{ height: 70 }} />
            <div className="skel" style={{ height: 190 }} />
          </div>
        </div>
      </section>
    );
  }

  if (state.status !== 'ok') {
    const notAvailable = state.status === 'not_available';
    return (
      <section className="detail">
        <div className="placeholder">
          <div className="state err" role="alert">
            <div className="state-ic">
              <Ms name={notAvailable ? 'search_off' : 'cloud_off'} />
            </div>
            <h2>{notAvailable ? 'Caso no disponible' : 'No pudimos cargar el caso'}</h2>
            <p>{notAvailable ? NOT_AVAILABLE : 'Revisá la conexión y volvé a intentar.'}</p>
            {notAvailable ? (
              <Link className="btn btn-soft" to={inboxHref} style={{ marginTop: 8 }}>
                Volver a la bandeja
              </Link>
            ) : (
              <button type="button" className="btn btn-primary" onClick={() => load()} style={{ marginTop: 8 }}>
                <Ms name="refresh" />
                <span>Reintentar</span>
              </button>
            )}
          </div>
        </div>
      </section>
    );
  }

  const final = FINAL_STATES.includes(report.state_code);
  const timeline = buildPanelTimeline({ history: report.history, taken: report.taken, agencyName });
  const lastFinal = [...(report.history ?? [])].reverse().find((h) => h.state_code === report.state_code);
  const meta =
    final && lastFinal
      ? `${STATE_LABEL[report.state_code]} ${dayWord(lastFinal.changed_at)} · ${hhmm(lastFinal.changed_at)}`
      : `Reportado ${dayWord(report.created_at)} · ${hhmm(report.created_at)}`;
  const hasCoords = typeof report.latitud === 'number' && typeof report.longitud === 'number';

  const descBlock = (
    <div>
      <div className="lbl">Descripción</div>
      <div className="txt">
        <Description text={report.description} />
      </div>
      {hasHiddenContact(report.description) && <div className="hint">Se ocultaron datos de contacto escritos por el vecino.</div>}
    </div>
  );
  const legalBlock = (
    <div>
      <div className="lbl">Fundamento preliminar</div>
      <Foundation foundation={report.foundation} />
    </div>
  );

  return (
    <section className="detail" aria-labelledby="case-h">
      <div className="detail-scroll">
        <div className="detail-inner">
          <div className="dhead">
            <div style={{ minWidth: 0 }}>
              <div className="dhead-id">
                <h1 id="case-h">{caseLabel(report.case_number)}</h1>
                <StateBadge code={report.state_code} label={report.state_label} />
                {report.state_code === 'DERIVADO' && report.taken && <StateBadge code="TOMADO" />}
              </div>
              <div className="dtitle">{report.category || 'Sin categoría'}</div>
              <div className="dmeta">{`${report.report_code} · ${report.category || 'Sin categoría'} · ${meta}`}</div>
            </div>
            {final && (
              <span className="final-chip">
                <Ms name="lock" />
                <span>Estado final</span>
              </span>
            )}
          </div>

          <section className="card loc-card" aria-label="Ubicación">
            <div className="loc">
              <span className="loc-pin">
                <Ms name="location_on" fill />
              </span>
              <div className="loc-main">
                <div className="lbl">Ubicación</div>
                <div className="loc-l">
                  <b>{[addressLabel(report), report.locality].filter(Boolean).join(' · ')}</b>
                  <span>
                    {[ROAD_TYPE[report.address_road_type], report.subdivision, hasCoords ? `${coordLabel(report.latitud)}, ${coordLabel(report.longitud)}` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
              </div>
              {/* Matías, 29/10: el mapa se abre dentro del panel, con solo este caso */}
              {hasCoords && (
                <button
                  type="button"
                  className="map-btn"
                  data-tip={showMap ? 'Ocultar el mapa' : 'Ver en el mapa'}
                  aria-label={showMap ? 'Ocultar el mapa' : 'Ver en el mapa'}
                  aria-expanded={showMap}
                  aria-controls="case-map"
                  onClick={() => setShowMap((v) => !v)}
                >
                  <Ms name={showMap ? 'close_fullscreen' : 'map'} />
                </button>
              )}
            </div>
            {showMap && hasCoords && (
              <div id="case-map">
                <PanelCaseMap latitud={report.latitud} longitud={report.longitud} label={[addressLabel(report), report.locality].filter(Boolean).join(' · ')} />
              </div>
            )}
          </section>

          {photos.length > 1 ? (
            <>
              <section className="card gallery-card" aria-label="Fotos del reporte">
                <div className="gallery-h">
                  <span className="lbl">{`Fotos · ${photos.length}`}</span>
                  <span className="shield">
                    <Ms name="shield" fill />
                    PROTEGIDAS
                  </span>
                  <span className="hint">Rostros y patentes difuminados. Las originales no se guardan.</span>
                </div>
                <div className="gallery">
                  {photos.map((p, i) => (
                    <button
                      key={p.id}
                      type="button"
                      className="photo"
                      style={{ backgroundImage: `url('${p.image_url}')` }}
                      aria-label={`Abrir foto ${i + 1} de ${photos.length}`}
                      onClick={() => setLightbox({ i })}
                    >
                      <span className="ph-n" aria-hidden="true">
                        {i + 1}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
              <section className="card desc-2col">
                {descBlock}
                {legalBlock}
              </section>
            </>
          ) : (
            <div className="media-one">
              {photos.length === 1 && (
                <div className="ph-wrap">
                  <button
                    type="button"
                    className="photo"
                    style={{ backgroundImage: `url('${photos[0].image_url}')` }}
                    aria-label="Ampliar la foto"
                    onClick={() => setLightbox({ i: 0 })}
                  >
                    <span className="shield">
                      <Ms name="shield" fill />
                      FOTO PROTEGIDA
                    </span>
                  </button>
                  <div className="ph-cap">Rostros y patentes difuminados. La foto original no se guarda.</div>
                </div>
              )}
              <section className="card desc" style={photos.length === 0 ? { gridColumn: '1 / -1' } : undefined}>
                {descBlock}
                {legalBlock}
              </section>
            </div>
          )}

          <section className="card tl-card is-open" aria-labelledby="tl-h">
            <div className="tl-h">
              <Ms name="history" />
              <h2 id="tl-h">{final ? 'Historial completo' : 'Historial'}</h2>
            </div>
            <ol className="tl" aria-labelledby="tl-h">
              {timeline.map((item, i) => (
                <TimelineItem key={`${item.code}-${item.at}-${i}`} item={item} />
              ))}
            </ol>
          </section>

          {final && (
            <div className="note">
              <Ms name="history_edu" />
              <span>
                Resuelto y Desestimado no se revierten desde el panel. Si hubo un error, el equipo de Reportalo lo corrige con
                un registro nuevo; los anteriores no se editan.
              </span>
            </div>
          )}
          <div className="privacy">
            <Ms name="lock" />
            <span>No se muestran la identidad ni los datos de contacto de quien reporta.</span>
          </div>
        </div>
      </div>

      {lightbox && photos.length > 0 && (
        <Lightbox
          photos={photos}
          index={lightbox.i}
          onStep={(d) => setLightbox((lb) => ({ i: Math.max(0, Math.min(photos.length - 1, lb.i + d)) }))}
          onGo={(i) => setLightbox({ i })}
          onClose={() => setLightbox(null)}
        />
      )}
    </section>
  );
};
