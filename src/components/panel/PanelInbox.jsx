import React from 'react';
import { Link } from 'react-router-dom';
import { Ms } from './PanelShell';
import { FILTERS, STATE_LABEL, addressLabel, bucketOf, caseLabel, ddmm, hhmm, relativeAge } from './panelFormat';

/*
 * REP-3000 · Bandeja del diseño de Iván (LEEME §5.1). Qué reportes entran lo decide la base (get_panel_inbox);
 * acá solo se agrupan en los tres filtros y se ordenan.
 */

export const StateBadge = ({ code, label }) => <span className={`badge s-${code}`}>{label || STATE_LABEL[code] || code}</span>;

const EMPTY = {
  'por-tomar': {
    title: 'No hay reportes por tomar',
    text: 'Acá llegan los reportes de tu jurisdicción que ya tienen borrador generado. Los casos de vulnerabilidad social, los delitos y los reportes fuera del piloto no llegan a ninguna bandeja.',
    other: ['en-curso', 'Ver los casos en curso'],
  },
  'en-curso': {
    title: 'No hay casos en curso',
    text: 'Los casos que tomes, escales o marques en discrepancia aparecen acá hasta que los cierres.',
    other: ['por-tomar', 'Ver los reportes por tomar'],
  },
  cerrados: {
    title: 'Todavía no hay casos cerrados',
    text: 'Acá quedan los resueltos y los desestimados, con el motivo que lee el vecino.',
    other: null,
  },
};

const Row = ({ report, thumb, href, current }) => (
  <Link className="row" to={href} aria-current={current}>
    <span className="thumb" style={thumb ? { backgroundImage: `url('${thumb}')` } : undefined}>
      {!thumb && <Ms name="report" />}
      {report.image_count > 1 && (
        <span className="thumb-n" aria-label={`${report.image_count} fotos`}>
          <Ms name="photo_library" />
          {report.image_count}
        </span>
      )}
    </span>
    <span className="row-body">
      <span className="row-l1">
        <span className="case">{caseLabel(report.case_number)}</span>
        <span className="code">{report.report_code}</span>
        <span className="when">{relativeAge(report.created_at)}</span>
      </span>
      <span className="row-title" style={{ display: 'block' }}>
        {report.category || 'Sin categoría'}
      </span>
      <span className="row-sub" style={{ display: 'block' }}>
        {/* Como en D41: «Pasco 1150, Gerli» */}
        {[report.address_street?.trim() ? addressLabel(report) : null, report.zone].filter(Boolean).join(', ') || 'Zona no disponible'}
      </span>
      <span className="badges">
        <StateBadge code={report.state_code} label={report.state_label} />
        {report.state_code === 'DERIVADO' && report.taken && <StateBadge code="TOMADO" />}
      </span>
    </span>
  </Link>
);

/**
 * @param {{ inbox: { status: string, reports: object[], code?: string, at?: Date }, thumbs: Record<string,string>,
 *   filter: string, sort: 'desc'|'asc', currentId?: string, agency: object, onFilter: Function, onSort: Function,
 *   onRetry: Function, caseHref: (id: string) => string }} props
 */
export const PanelInbox = ({ inbox, thumbs, filter, sort, currentId, agency, onFilter, onSort, onRetry, caseHref }) => {
  const counts = { 'por-tomar': 0, 'en-curso': 0, cerrados: 0 };
  inbox.reports.forEach((r) => {
    counts[bucketOf(r)] += 1;
  });
  const rows = inbox.reports
    .filter((r) => bucketOf(r) === filter)
    .sort((a, b) => (sort === 'desc' ? 1 : -1) * (new Date(b.created_at) - new Date(a.created_at)));
  const ready = inbox.status === 'ready';

  let body;
  if (inbox.status === 'loading') {
    body = Array.from({ length: 4 }, (_, i) => (
      <div key={i} className="row" aria-hidden="true">
        <span className="thumb skel" />
        <div className="row-body">
          <div className="skel" style={{ height: 12, width: '60%' }} />
          <div className="skel" style={{ height: 12, width: '90%', marginTop: 7 }} />
        </div>
      </div>
    ));
  } else if (inbox.status === 'error') {
    body = (
      <div className="state err" role="alert">
        <div className="state-ic">
          <Ms name="cloud_off" />
        </div>
        <h2>No pudimos cargar la bandeja</h2>
        <p>
          Revisá la conexión y volvé a intentar. No mostramos la última lista guardada porque algunos reportes pueden haber
          cambiado de estado.
        </p>
        <button type="button" className="btn btn-primary" onClick={onRetry} style={{ marginTop: 8 }}>
          <Ms name="refresh" />
          <span>Reintentar</span>
        </button>
        <span className="meta">{`Error ${inbox.code || 'de red'} · ${ddmm(inbox.at)} · ${hhmm(inbox.at)}`}</span>
      </div>
    );
  } else if (rows.length === 0) {
    const empty = EMPTY[filter];
    body = (
      <div className="state">
        <div className="state-ic">
          <Ms name="inbox" />
        </div>
        <h2>{empty.title}</h2>
        <p>{empty.text}</p>
        {empty.other && counts[empty.other[0]] > 0 && (
          <button type="button" className="btn btn-soft" onClick={() => onFilter(empty.other[0])} style={{ marginTop: 8 }}>
            {`${empty.other[1]} · ${counts[empty.other[0]]}`}
          </button>
        )}
      </div>
    );
  } else {
    body = rows.map((r) => (
      <Row key={r.report_id} report={r} thumb={thumbs[r.report_id]} href={caseHref(r.report_id)} current={r.report_id === currentId} />
    ));
  }

  return (
    <section className="inbox" aria-labelledby="inbox-h">
      <div className="inbox-head">
        <div className="inbox-title">
          <h1 id="inbox-h">Bandeja</h1>
          <p>{agency?.name}</p>
        </div>
        {inbox.status !== 'error' && (
          <div className="chips" role="group" aria-label="Filtrar la bandeja">
            {FILTERS.map(([key, label]) => (
              <button key={key} type="button" className="chip" aria-pressed={filter === key} onClick={() => onFilter(key)}>
                {`${label} · ${ready ? counts[key] : '…'}`}
              </button>
            ))}
          </div>
        )}
        {ready && rows.length > 1 && (
          <button type="button" className="sort" onClick={onSort}>
            <Ms name="sort" />
            <span>{sort === 'desc' ? 'Más recientes primero' : 'Más antiguos primero'}</span>
          </button>
        )}
      </div>
      <div className="list" aria-busy={inbox.status === 'loading'}>
        {body}
      </div>
    </section>
  );
};
