import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Ms, PanelTopBar, TestBanner, ToastRegion, useMaterialSymbols, usePanelTheme, useToasts } from '../../components/panel/PanelShell';
import { PanelInbox } from '../../components/panel/PanelInbox';
import { PanelCase } from '../../components/panel/PanelCase';
import { bucketOf, isFilter } from '../../components/panel/panelFormat';
import { useNoIndex } from '../../hooks/useNoIndex';
import { useAuth } from '../../hooks/useAuth';
import { useOperator } from '../../components/panel/OperatorRoute';
import { getPanelInbox } from '../../services/panelService';
import { signEvidenceImages } from '../../services/reportDetailService';

/**
 * REP-3747 / REP-3000 / REP-3749 / REP-3001 · Panel de organismos, con el diseño de Iván (29/10):
 * bandeja a la izquierda y caso a la derecha. Sirve /panel y /panel/reportes/:id; el filtro va en ?f=.
 * Qué reportes entran y qué se puede hacer con cada uno lo decide la base; esta pantalla solo lo muestra.
 */
export const PanelPage = () => {
  useNoIndex();
  useMaterialSymbols();
  const [theme, toggleTheme] = usePanelTheme();
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const operador = useOperator();
  const agency = operador?.agency;
  const { user, signOut } = useAuth() ?? {};
  const { toasts, toast, dismiss } = useToasts();

  const fromUrl = params.get('f');
  const [filter, setFilter] = useState(isFilter(fromUrl) ? fromUrl : 'por-tomar');
  const [sort, setSort] = useState('desc');
  const [inbox, setInbox] = useState({ status: 'loading', reports: [] });
  const [thumbs, setThumbs] = useState({});

  const loadInbox = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setInbox({ status: 'loading', reports: [] });
    const result = await getPanelInbox();
    if (!result.success) {
      // Sin lista ni recuentos viejos: algunos reportes pueden haber cambiado de estado
      setInbox({ status: 'error', reports: [], code: result.code, at: new Date() });
      return;
    }
    setInbox({ status: 'ready', reports: result.reports });
    // Miniatura: la primera foto anonimizada de cada fila, firmada
    const conFoto = result.reports.filter((r) => r.first_image_url).map((r) => ({ id: r.report_id, image_url: r.first_image_url }));
    const firmadas = await signEvidenceImages(conFoto);
    setThumbs(Object.fromEntries(firmadas.map((f) => [f.id, f.image_url])));
  }, []);

  useEffect(() => {
    loadInbox();
  }, [loadInbox]);

  const changeFilter = (next) => {
    setFilter(next);
    setParams({ f: next }, { replace: true });
  };

  // Al abrir un caso sin filtro en la dirección, la bandeja se ubica en el filtro del caso
  const onCaseLoaded = useCallback(
    (report) => {
      if (!isFilter(fromUrl)) setFilter(bucketOf({ ...report, taken: Boolean(report.taken) }));
    },
    [fromUrl]
  );

  const reloadInbox = useCallback(() => loadInbox({ silent: true }), [loadInbox]);
  const inboxHref = `/panel?f=${filter}`;
  const caseHref = (reportId) => `/panel/reportes/${reportId}?f=${filter}`;

  const handleSignOut = async () => {
    await signOut?.();
    navigate('/panel/ingresar', { replace: true });
  };

  return (
    <div className={`op-panel${id ? ' is-case' : ''}`} data-theme={theme}>
      <PanelTopBar
        agency={agency}
        email={user?.email}
        onSignOut={handleSignOut}
        inboxHref={inboxHref}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <TestBanner agency={agency} />
      <div className="main">
        <PanelInbox
          inbox={inbox}
          thumbs={thumbs}
          filter={filter}
          sort={sort}
          currentId={id}
          agency={agency}
          onFilter={changeFilter}
          onSort={() => setSort((s) => (s === 'desc' ? 'asc' : 'desc'))}
          onRetry={() => loadInbox()}
          caseHref={caseHref}
        />
        {id ? (
          <PanelCase
            key={id}
            id={id}
            agencyName={agency?.name ?? ''}
            agency={agency}
            inboxHref={inboxHref}
            toast={toast}
            onChanged={reloadInbox}
            onLoaded={onCaseLoaded}
          />
        ) : (
          <section className="detail" aria-label="Detalle">
            <div className="placeholder">
              <div className="state">
                <div className="state-ic">
                  <Ms name="left_click" />
                </div>
                <h2>Elegí un caso</h2>
                <p>Abrí un reporte de la lista para ver las fotos, la ubicación y el historial.</p>
              </div>
            </div>
          </section>
        )}
      </div>
      <ToastRegion toasts={toasts} onDismiss={dismiss} />
    </div>
  );
};

export default PanelPage;
