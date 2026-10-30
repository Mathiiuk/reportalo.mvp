import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
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
  shortReference,
  caseLabel,
  coordLabel,
  dayWord,
  ddmm,
  hasHiddenContact,
  hhmm,
} from './panelFormat';
import { changePanelReportState, getPanelReportDetail, takeReport } from '../../services/panelService';
import { signEvidenceImages } from '../../services/reportDetailService';

/*
 * REP-3749 / REP-3001 · Detalle del caso con el diseño de Iván (LEEME §5.2 y §5.3), sobre el contrato de la base:
 * lo que se muestra y lo que se puede hacer lo decide la base (get_panel_report_detail y su `actions`).
 */

// Textos del PO (Hernán, 24/10)
const SANCTION_NOTICE = 'Sanción prevista por la norma; Reportalo no aplica sanciones.';
const NO_SANCTION = 'La norma no registra sanción.';
const NOT_AVAILABLE = 'Este reporte no está disponible para tu organismo.';
const REASON_MAX = 500;

// Opciones de «Rechazar» (reglas §5), en el orden del diseño
const REJECT = {
  ESCALADO: { title: 'Corresponde a otro organismo o área', submit: 'Escalar el reporte', icon: 'alt_route' },
  DESESTIMADO: { title: 'No hay reclamo o está mal formulado', submit: 'Desestimar', icon: 'block' },
  EN_DISCREPANCIA: { title: 'Lo reportado no coincide con lo que se constata', submit: 'Registrar discrepancia', icon: 'difference' },
};
const REASON_PLACEHOLDER = {
  RESUELTO: 'Ej.: Se reparó el 28/10.',
  ESCALADO: 'Ej.: Corresponde a la concesionaria de la autopista.',
  DESESTIMADO: 'Ej.: La foto no muestra un problema en la vía pública.',
  EN_DISCREPANCIA: 'Ej.: En la inspección del 28/10 la vereda estaba en buen estado.',
};
// Rechazos de la base que significan que el caso cambió mientras el operador miraba
const STALE_CODES = ['transicion_no_definida', 'mismo_estado', 'estado_no_permite'];

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
  const [open, setOpen] = useState(false);
  const textId = useId();
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
      {/* Diseño D41: una línea por norma. El texto, la fuente y las sanciones (con la leyenda del PO), al desplegar */}
      {norms.map((c, i) => (
        <div key={`r-${i}`} className="txt">
          <b title={c.reference}>{shortReference(c.reference)}</b>
        </div>
      ))}
      <div className="hint">Análisis automático · lo valida el operador</div>
      <button type="button" className="link-btn" aria-expanded={open} aria-controls={textId} onClick={() => setOpen((v) => !v)}>
        {open ? 'Ocultar el texto de las normas' : 'Ver el texto de las normas'}
      </button>
      {open && (
        <div id={textId} className="legal-text">
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
        </div>
      )}
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

/** Diálogo de «Marcar resuelto» o «Rechazar»: motivo obligatorio y, si se escala, a quién (contacto opcional). */
const ActionDialog = ({ dialog, report, onChange, onClose, onSubmit }) => {
  const ref = useRef(null);
  const { type, option, options, form, sending, error } = dialog;
  const valid = form.reason.trim().length > 0 && (option !== 'ESCALADO' || form.to.trim().length > 0);

  useEffect(() => {
    ref.current?.querySelector('[data-field]')?.focus();
  }, [type]);

  // Foco atrapado en el diálogo
  const onKeyDown = (event) => {
    if (event.key !== 'Tab') return;
    const focusables = [...ref.current.querySelectorAll('button:not([disabled]), input, textarea')];
    if (!focusables.length) return;
    const [first, last] = [focusables[0], focusables[focusables.length - 1]];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const reasonField = (
    <div className="field">
      <label className="field-l" htmlFor="f-reason">
        Motivo <span className="req">OBLIGATORIO</span>
        <span className="count">{`${form.reason.length}/${REASON_MAX}`}</span>
      </label>
      <textarea
        id="f-reason"
        className="textarea"
        data-field="reason"
        maxLength={REASON_MAX}
        placeholder={REASON_PLACEHOLDER[option]}
        aria-describedby="h-reason"
        value={form.reason}
        onChange={(e) => onChange({ reason: e.target.value })}
      />
      <div className="hint" id="h-reason">
        {form.reason.trim() ? 'El vecino lee este motivo en «Mis reportes».' : 'Sin motivo no se puede guardar: es la respuesta que lee el vecino.'}
      </div>
    </div>
  );

  const submitLabel = type === 'resolve' ? 'Marcar resuelto' : REJECT[option].submit;
  const submitIcon = type === 'resolve' ? 'task_alt' : REJECT[option].icon;

  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && !sending && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="m-h" ref={ref} onKeyDown={onKeyDown}>
        <div className="modal-h">
          <div>
            <h2 id="m-h">{type === 'resolve' ? 'Marcar como resuelto' : 'Rechazar el reporte'}</h2>
            <p>{`${caseLabel(report.case_number)} · ${report.category || 'Sin categoría'}`}</p>
          </div>
          <button type="button" className="icon-btn" aria-label="Cerrar" onClick={onClose} disabled={sending}>
            <Ms name="close" />
          </button>
        </div>

        {type === 'resolve' ? (
          <>
            <div className="trans" aria-label="Cambio de estado">
              <StateBadge code={report.state_code} label={report.state_label} />
              <Ms name="arrow_forward" />
              <StateBadge code="RESUELTO" />
            </div>
            {reasonField}
            <div className="warn">
              <Ms name="lock" />
              <span>Un reporte resuelto no se puede revertir desde el panel.</span>
            </div>
          </>
        ) : (
          <>
            <p className="txt" style={{ margin: 0 }}>
              Elegí qué pasa con el reporte. El motivo es obligatorio y lo lee el vecino.
            </p>
            <fieldset className="options">
              <legend className="sr-only">Qué pasa con el reporte</legend>
              {options.map((key) => (
                <div key={key} className="option">
                  <label>
                    <input type="radio" name="rj" value={key} checked={option === key} onChange={() => onChange({}, key)} />
                    <span>{REJECT[key].title}</span>
                    <StateBadge code={key} />
                  </label>
                  {option === key && (
                    <div className="option-body">
                      {key === 'ESCALADO' && (
                        <>
                          <div className="field">
                            <label className="field-l" htmlFor="f-to">
                              ¿A quién corresponde? <span className="req">OBLIGATORIO</span>
                            </label>
                            <input
                              id="f-to"
                              className="input"
                              data-field="to"
                              autoComplete="off"
                              maxLength={200}
                              placeholder="Ej.: Concesionaria de la autopista"
                              value={form.to}
                              onChange={(e) => onChange({ to: e.target.value })}
                            />
                          </div>
                          <div className="field">
                            <label className="field-l" htmlFor="f-contact">
                              Contacto del destino <span className="opt">OPCIONAL</span>
                            </label>
                            <input
                              id="f-contact"
                              className="input"
                              autoComplete="off"
                              maxLength={200}
                              placeholder="Correo, teléfono o web"
                              aria-describedby="h-contact"
                              value={form.contact}
                              onChange={(e) => onChange({ contact: e.target.value })}
                            />
                            <div className="hint" id="h-contact">
                              El vecino lo ve junto al destino, para seguir el reclamo.
                            </div>
                          </div>
                        </>
                      )}
                      {reasonField}
                      {key === 'DESESTIMADO' && (
                        <div className="warn">
                          <Ms name="lock" />
                          <span>Un reporte desestimado no se puede revertir desde el panel.</span>
                        </div>
                      )}
                      {key !== 'DESESTIMADO' && (
                        <div className="inline-note">
                          <Ms name="info" />
                          <span>
                            {key === 'EN_DISCREPANCIA'
                              ? 'El caso sigue en curso: después lo podés resolver, desestimar o escalar.'
                              : 'El caso sigue en curso hasta que se resuelva.'}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </fieldset>
          </>
        )}

        {error && (
          <div className="field-err" role="alert">
            <Ms name="error" />
            <span>{error}</span>
          </div>
        )}
        <div className="modal-f">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={sending}>
            Cancelar
          </button>
          <button
            type="button"
            className={`btn ${type === 'resolve' ? 'btn-success' : 'btn-danger'}`}
            disabled={!valid || sending}
            onClick={onSubmit}
          >
            {sending ? (
              <>
                <span className="spin" aria-hidden="true" />
                <span>Guardando…</span>
              </>
            ) : (
              <>
                <Ms name={submitIcon} />
                <span>{submitLabel}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

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
 * @param {{ id: string, agencyName: string, inboxHref: string, toast: Function, onChanged: Function,
 *   onLoaded?: (report: object) => void }} props
 */
export const PanelCase = ({ id, agencyName, inboxHref, toast, onChanged, onLoaded }) => {
  const [state, setState] = useState({ status: 'loading', report: null });
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const triggerRef = useRef(null);

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
    setDialog(null);
    setLightbox(null);
    load();
  }, [load]);

  // Teclado: visor (← → Esc) y Esc para cerrar el diálogo
  useEffect(() => {
    if (!lightbox && !dialog) return undefined;
    const onKey = (event) => {
      if (lightbox) {
        if (event.key === 'Escape') setLightbox(null);
        if (event.key === 'ArrowRight') setLightbox((lb) => ({ i: Math.min(photos.length - 1, lb.i + 1) }));
        if (event.key === 'ArrowLeft') setLightbox((lb) => ({ i: Math.max(0, lb.i - 1) }));
        return;
      }
      if (event.key === 'Escape' && !dialog.sending) closeDialog();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const report = state.report;

  const closeDialog = () => {
    setDialog(null);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const openDialog = (type, event) => {
    triggerRef.current = event.currentTarget;
    const options = ['ESCALADO', 'DESESTIMADO', 'EN_DISCREPANCIA'].filter((s) => report.actions?.includes(s));
    setDialog({
      type,
      option: type === 'resolve' ? 'RESUELTO' : options[0],
      options,
      form: { reason: '', to: '', contact: '' },
      sending: false,
      error: null,
    });
  };

  const take = async () => {
    if (busy || report.taken) return;
    setBusy(true);
    const result = await takeReport(report.report_id);
    if (result.ok) {
      await load({ silent: true });
      onChanged();
      toast('Tomaste el caso. Sigue Derivado y el vecino ve «El organismo tomó tu reporte».');
    } else {
      toast(result.message || 'No pudimos tomar el caso. Probá de nuevo.', 'err');
    }
    setBusy(false);
  };

  const submit = async () => {
    const d = dialog;
    if (!d || d.sending) return;
    setDialog({ ...d, sending: true, error: null });
    const escalating = d.option === 'ESCALADO';
    const result = await changePanelReportState(report.report_id, {
      toState: d.option,
      reason: d.form.reason.trim(),
      escalatedTo: escalating ? d.form.to.trim() : null,
      escalatedContact: escalating && d.form.contact.trim() ? d.form.contact.trim() : null,
    });
    if (!result.ok) {
      setDialog({ ...d, sending: false, error: result.message });
      // El caso cambió mientras se miraba: se relee sin cerrar el diálogo
      if (STALE_CODES.includes(result.code)) load({ silent: true });
      return;
    }
    setDialog(null);
    await load({ silent: true });
    onChanged();
    toast(
      {
        RESUELTO: `${caseLabel(report.case_number)} marcado como resuelto. El vecino ya ve el motivo.`,
        DESESTIMADO: 'Reporte desestimado. El vecino ve el motivo en «Mis reportes».',
        ESCALADO: `Reporte escalado a ${d.form.to.trim()}. El vecino ve el destino y el motivo.`,
        EN_DISCREPANCIA: 'Discrepancia registrada. El caso sigue en curso.',
      }[d.option]
    );
  };

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

  const actions = report.actions ?? [];
  const final = FINAL_STATES.includes(report.state_code);
  const canReject = actions.some((s) => s !== 'RESUELTO');
  const canResolve = actions.includes('RESUELTO');
  const canTake = report.state_code === 'DERIVADO';
  const timeline = buildPanelTimeline({ history: report.history, taken: report.taken, agencyName, createdAt: report.created_at });
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
                {canTake && report.taken && <StateBadge code="TOMADO" />}
              </div>
              <div className="dtitle">{report.category || 'Sin categoría'}</div>
              <div className="dmeta">{`${report.report_code} · ${meta}`}</div>
            </div>
            {final ? (
              <span className="final-chip">
                <Ms name="lock" />
                <span>Estado final</span>
              </span>
            ) : (
              <div className="actions">
                {canReject && (
                  <button type="button" className="btn btn-danger" onClick={(e) => openDialog('reject', e)}>
                    <Ms name="block" />
                    <span>Rechazar</span>
                  </button>
                )}
                {canResolve && (
                  <button type="button" className="btn btn-success" onClick={(e) => openDialog('resolve', e)}>
                    <Ms name="task_alt" />
                    <span>Marcar resuelto</span>
                  </button>
                )}
                {canTake &&
                  (report.taken ? (
                    <button type="button" className="btn btn-done" disabled>
                      <Ms name="check" />
                      <span>Caso tomado</span>
                    </button>
                  ) : (
                    <button type="button" className={`btn btn-primary${busy ? ' is-busy' : ''}`} onClick={take} aria-busy={busy}>
                      {busy ? <span className="spin" aria-hidden="true" /> : <Ms name="front_hand" />}
                      <span>{busy ? 'Tomando…' : 'Tomar el caso'}</span>
                    </button>
                  ))}
              </div>
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

      {dialog && (
        <ActionDialog
          dialog={dialog}
          report={report}
          onChange={(fields, option) =>
            setDialog((d) => ({ ...d, option: option ?? d.option, error: option ? null : d.error, form: { ...d.form, ...fields } }))
          }
          onClose={closeDialog}
          onSubmit={submit}
        />
      )}
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
