import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftRight, ChevronRight, House, Info, MapPin } from 'lucide-react';
import { ChipsFiltros, Encabezado, Kpi, Kpis, Migas, ObsCard, SelectorCategoria, SelectorPeriodo, Sello } from '../../components/observatorio/ObsUi';
import { BarrasMesCategoria, DonaCategorias } from '../../components/observatorio/ObsGraficos';
import { LeyendaMapa, ObsMapa, ZOOM_MAXIMO } from '../../components/observatorio/ObsMapa';
import { Cargando, ErrorCarga, notaMenosDeCinco, useCarga } from '../../components/observatorio/ObsEstados';
import { useObsFiltro } from '../../components/observatorio/useObsFiltro';
import { camino, centroZona, hijosDe, indexarTerritorio } from '../../components/observatorio/obsTerritorio';
import { desdeDePeriodo, fmtDias, fmtNum, fmtPct, mesesDelPeriodo, textoPeriodo } from '../../components/observatorio/obsFormat';
import { fetchHijos, fetchPorCategoria, fetchPorMes, fetchResumen, fetchZonas, MIN_CASOS, NIVEL_HIJO } from '../../services/observatorioService';

/**
 * OBS · F3 · Mapa de calor: del país al barrio, con los cuatro niveles de la base (POC D57/M50).
 *
 * - Un círculo por zona hija en su centro aproximado; tocar un círculo o una fila de la tabla baja un nivel, las migas
 *   suben. El nivel y la zona quedan en la dirección (?nivel=&zona=).
 * - Período y categoría filtran el mapa, los indicadores, la tabla y las barras a la vez (la dona muestra siempre las
 *   cuatro y sirve para elegir).
 * - Sin ranking: la tabla va en orden alfabético con números naturales («Comuna 2» antes que «Comuna 10»).
 * - Se eligen hasta 3 zonas de la tabla para compararlas (F4).
 * - Teléfono: mapa a lo ancho y la tabla debajo; no hay selector de nivel, alcanza con migas y círculos.
 */

const NOMBRE_NIVEL = { pais: 'zonas', provincia: 'comunas o partidos', subdivision: 'barrios o localidades' };
const MAX_COMPARAR = 3;

const TablaHijos = ({ filas, seleccion, onSeleccion, onBajar }) => (
  <div className="-mx-1 overflow-x-auto px-1">
    <table className="w-full min-w-[440px] border-collapse text-left text-[12.5px] desktop:text-[13px]">
      <caption className="sr-only">Zonas de este nivel, en orden alfabético</caption>
      <thead>
        <tr className="text-[11px] font-bold uppercase tracking-wide text-rep-ink-faint">
          <th scope="col" className="w-8 border-b border-rep-divider px-2 py-2">
            <span className="sr-only">Comparar</span>
          </th>
          <th scope="col" className="border-b border-rep-divider px-2 py-2">Zona</th>
          <th scope="col" className="border-b border-rep-divider px-2 py-2 text-right">Reportes</th>
          <th scope="col" className="border-b border-rep-divider px-2 py-2 text-right">% resueltos</th>
          <th scope="col" className="border-b border-rep-divider px-2 py-2 text-right">Mediana</th>
          <th scope="col" className="border-b border-rep-divider px-2 py-2 text-right">Abiertos</th>
          <th scope="col" className="w-6 border-b border-rep-divider" />
        </tr>
      </thead>
      <tbody>
        {filas.map((f) => {
          const marcada = seleccion.includes(f.zona);
          const lleno = seleccion.length >= MAX_COMPARAR && !marcada;
          return (
            <tr key={f.zona} className="border-b border-rep-divider last:border-0 hover:bg-rep-surface-sunken">
              <td className="px-2 py-1.5">
                <input
                  type="checkbox"
                  checked={marcada}
                  disabled={lleno || !f.reportes}
                  onChange={() => onSeleccion(f.zona)}
                  aria-label={`Elegir ${f.nombre} para comparar`}
                  className="h-4 w-4 accent-[rgb(var(--rep-accent))]"
                />
              </td>
              <td className="whitespace-nowrap px-2 py-1.5">
                {f.reportes ? (
                  <button type="button" onClick={() => onBajar(f)} className="rep-focus rounded text-left font-bold text-rep-ink hover:text-rep-accent hover:underline">
                    {f.nombre}
                  </button>
                ) : (
                  <span className="font-semibold text-rep-ink-faint">{f.nombre}</span>
                )}
              </td>
              <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-rep-ink-body">{f.reportes ? fmtNum(f.reportes) : <span className="text-rep-ink-faint">sin reportes</span>}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-rep-ink-body">{fmtPct(f.pctResueltos)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-rep-ink-body">{fmtDias(f.medianaDias)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-rep-ink-body">{fmtNum(f.abiertos)}</td>
              <td className="pr-1 text-rep-ink-faint">{f.reportes ? <ChevronRight aria-hidden="true" className="h-4 w-4" strokeWidth={2.25} /> : null}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

export const MapaPage = () => {
  const navigate = useNavigate();
  const { periodo, setPeriodo, categoria, setCategoria, nivel, zona: zonaId, setLugar } = useObsFiltro();
  const [seleccion, setSeleccion] = useState([]);
  const territorio = useCarga(() => fetchZonas().then(indexarTerritorio), []);
  const indice = territorio.datos;

  // Una zona que no existe (dirección vieja o mal copiada) vuelve al país
  const zona = nivel !== 'pais' && indice ? indice.get(zonaId) : null;
  const nivelValido = nivel === 'pais' || Boolean(zona);
  useEffect(() => {
    if (indice && !nivelValido) setLugar('pais', null);
  }, [indice, nivelValido, setLugar]);

  // Al cambiar de nivel se vacía la selección para comparar
  useEffect(() => setSeleccion([]), [nivel, zonaId]);

  const desde = desdeDePeriodo(periodo);
  const lugar = { nivel, zona: nivel === 'pais' ? null : zonaId, desde };
  const cifras = useCarga(
    () =>
      nivelValido
        ? Promise.all([
            fetchResumen({ ...lugar, categoria }),
            fetchHijos({ ...lugar, categoria }),
            fetchPorMes({ ...lugar, categoria }),
            fetchPorCategoria(lugar),
          ]).then(([resumen, hijos, porMes, porCategoria]) => ({ resumen, hijos, porMes, porCategoria }))
        : Promise.resolve(null),
    [nivel, zonaId, desde, categoria, nivelValido]
  );

  const bajar = (h) => setLugar(h.nivel, h.zona);

  // Círculos del mapa: las zonas hijas, o la zona misma en el último nivel
  const items = useMemo(() => {
    if (!indice || !cifras.datos) return [];
    if (!NIVEL_HIJO[nivel]) {
      return [{ id: zona.id, nombre: zona.nombre, centro: centroZona(indice, zona), reportes: cifras.datos.resumen.reportes, seleccionado: true }];
    }
    return cifras.datos.hijos.map((h) => ({
      id: h.zona,
      nombre: h.nombre,
      centro: centroZona(indice, indice.get(h.zona)),
      reportes: h.reportes,
      onClick: h.reportes ? () => setLugar(h.nivel, h.zona) : undefined,
    }));
  }, [indice, cifras.datos, nivel, zona, setLugar]);

  if (territorio.cargando) return <Cargando alto="h-40" etiqueta="Cargando el territorio" />;
  if (territorio.error) return <ErrorCarga onReintentar={territorio.recargar} />;
  if (!nivelValido) return null;

  const pasos = camino(indice, nivel, zonaId);
  const nombre = pasos[pasos.length - 1].nombre;
  const filasHijos = cifras.datos ? [...cifras.datos.hijos].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true })) : [];
  const sinCentro = items.filter((i) => !i.centro && i.reportes > 0);
  const r = cifras.datos?.resumen;

  return (
    <>
      <Migas pasos={pasos.map((p, i) => (i < pasos.length - 1 ? { nombre: p.nombre, onClick: () => setLugar(p.nivel, p.id) } : { nombre: p.nombre }))} />
      <Encabezado
        titulo={`Mapa · ${nombre}`}
        sellos={<Sello />}
        bajada={`${NIVEL_HIJO[nivel] ? `${fmtNum(hijosDe(indice, nivel, zonaId).length)} ${NOMBRE_NIVEL[nivel]} · ` : ''}${textoPeriodo(periodo)}`}
        derecha={<SelectorPeriodo valor={periodo} onChange={setPeriodo} />}
      />
      <div className="flex flex-col gap-2.5 tablet:flex-row tablet:items-center">
        <SelectorCategoria valor={categoria} onChange={setCategoria} />
      </div>
      <ChipsFiltros categoria={categoria} onQuitarCategoria={() => setCategoria(null)} />

      {cifras.error ? (
        <ErrorCarga onReintentar={cifras.recargar} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3.5 desktop:grid-cols-[1.4fr_1fr] desktop:gap-4">
            <ObsCard
              titulo="Reportes por zona"
              sub={NIVEL_HIJO[nivel] ? 'tocá un círculo para bajar' : 'último nivel'}
              pie={
                <>
                  <Info aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
                  <span>
                    Zoom máximo {ZOOM_MAXIMO}: ninguna vista muestra un caso ni una dirección. El centro de cada zona es aproximado.
                    {sinCentro.length > 0 && ` Sin ubicación en el mapa (sí en la tabla): ${sinCentro.map((i) => i.nombre).join(', ')}.`}
                  </span>
                </>
              }
            >
              <ObsMapa items={items} etiqueta={`Mapa de ${nombre}: un círculo por zona según la cantidad de reportes`} />
              <LeyendaMapa />
            </ObsCard>

            <div className="flex min-w-0 flex-col gap-3.5 desktop:gap-4">
              {!cifras.datos ? (
                <Cargando alto="h-[104px]" />
              ) : (
                <Kpis columnas={3}>
                  <Kpi testId="obs-mapa-reportes" valor={fmtNum(r.reportes)} etiqueta="reportes" nota="Para contexto" />
                  <Kpi
                    testId="obs-mapa-resueltos"
                    valor={fmtPct(r.pctResueltos)}
                    etiqueta="resueltos"
                    nota={r.pctResueltos === null ? notaMenosDeCinco() : 'No «cerrados»'}
                    destacado={r.pctResueltos > 0}
                  />
                  <Kpi
                    valor={fmtDias(r.medianaDias)}
                    etiqueta="hasta resolver (mediana)"
                    nota={r.medianaDias === null ? notaMenosDeCinco('días') : `p90: ${fmtDias(r.p90Dias)}`}
                  />
                </Kpis>
              )}

              {NIVEL_HIJO[nivel] ? (
                <ObsCard
                  titulo={`${nombre}: ${NOMBRE_NIVEL[nivel]}`}
                  sub="orden alfabético"
                  pie={
                    <>
                      <ArrowLeftRight aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
                      <span>Elegí hasta {MAX_COMPARAR} zonas y tocá «Comparar». Con menos de {MIN_CASOS} reportes no hay % ni días.</span>
                    </>
                  }
                >
                  {!cifras.datos ? (
                    <Cargando alto="h-40" />
                  ) : (
                    <TablaHijos
                      filas={filasHijos}
                      seleccion={seleccion}
                      onSeleccion={(id) => setSeleccion((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id].slice(0, MAX_COMPARAR)))}
                      onBajar={bajar}
                    />
                  )}
                </ObsCard>
              ) : (
                <ObsCard titulo={nombre} sub="último nivel">
                  <p className="m-0 flex items-start gap-2 text-rep-body text-rep-ink-muted">
                    <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-rep-accent" strokeWidth={2.25} />
                    Es el último nivel de la base. Podés subir con las migas o ver este barrio en detalle.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate(`/observatorio/mi-barrio?zona=${zona.id}`)}
                    className="rep-focus flex min-h-touch items-center justify-center gap-2 self-start rounded-xl border border-rep-border bg-rep-surface px-4 text-rep-label font-bold text-rep-ink-label hover:bg-rep-surface-sunken"
                  >
                    <House aria-hidden="true" className="h-4 w-4" strokeWidth={2.25} />
                    Ver {zona.nombre} en Mi barrio
                  </button>
                </ObsCard>
              )}

              {NIVEL_HIJO[nivel] && (
                <button
                  type="button"
                  disabled={seleccion.length < 2}
                  onClick={() => navigate(`/observatorio/comparar?zonas=${seleccion.join(',')}`)}
                  className="rep-focus flex min-h-touch items-center justify-center gap-2 self-stretch rounded-xl bg-rep-accent px-4 text-rep-label font-extrabold text-rep-on-accent shadow-rep-accent transition-colors hover:bg-rep-accent-strong disabled:opacity-45 disabled:shadow-none tablet:self-start"
                >
                  <ArrowLeftRight aria-hidden="true" className="h-4 w-4" strokeWidth={2.25} />
                  {seleccion.length >= 2 ? `Comparar ${seleccion.length} zonas` : 'Elegí 2 o 3 zonas para comparar'}
                </button>
              )}
            </div>
          </div>

          {cifras.datos && (
            <div className="grid grid-cols-1 gap-3.5 desktop:grid-cols-[1.4fr_1fr] desktop:gap-4">
              <ObsCard titulo="Reportes por mes y categoría" sub={nombre}>
                <BarrasMesCategoria meses={mesesDelPeriodo(periodo)} filas={cifras.datos.porMes.filter((f) => f.categoria !== null)} categoria={categoria} />
              </ObsCard>
              <ObsCard titulo="Qué se reporta" sub="tocá una categoría para filtrar">
                <DonaCategorias filas={cifras.datos.porCategoria} seleccion={categoria} onSeleccion={setCategoria} />
              </ObsCard>
            </div>
          )}
        </>
      )}
    </>
  );
};

export default MapaPage;
