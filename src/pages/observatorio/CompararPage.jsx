import React, { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeftRight, Plus, Scale, X } from 'lucide-react';
import { Aviso, ChipsFiltros, Encabezado, ObsCard, SelectorCategoria, SelectorPeriodo, Sello } from '../../components/observatorio/ObsUi';
import { BarrasCategoriaZonas, BarrasMesZonas } from '../../components/observatorio/ObsGraficos';
import { Cargando, ErrorCarga, useCarga } from '../../components/observatorio/ObsEstados';
import { EmptyState } from '../../components/common/EmptyState';
import { useObsFiltro } from '../../components/observatorio/useObsFiltro';
import { hijosDe, indexarTerritorio, NOMBRE_PAIS, nombreCorto } from '../../components/observatorio/obsTerritorio';
import { CATEGORIAS, desdeDePeriodo, fmtDias, fmtNum, fmtPct, mesesDelPeriodo, SIN_DATO, textoPeriodo } from '../../components/observatorio/obsFormat';
import { fetchPorCategoria, fetchPorMes, fetchResumen, fetchZonas, MIN_CASOS } from '../../services/observatorioService';

/**
 * OBS · F4 · Comparar zonas (POC D59/M52): hasta 3 zonas de cualquier nivel y jurisdicción, con el mismo criterio.
 *
 * - «Comparar no es rankear»: las zonas van en el orden en que se eligieron y los colores identifican zonas, no
 *   «mejor» o «peor». Cada cifra se pone al lado de la de su propia jurisdicción.
 * - Las zonas quedan en la dirección (?zonas=a,b,c): el Mapa y Mi barrio llegan acá con ellas.
 * - Cambios contra el POC por los datos reales: «% resueltos por mes» → reportes por mes (con 5 resueltos la línea
 *   salía vacía); «Problemas urbanos por familia de prestación» → qué se reporta, en proporción por categoría (el
 *   reporte no guarda la prestación). La tasa cada 10.000 habitantes queda «s/d» hasta cargar el Censo 2022.
 */

export const MAX_ZONAS = 3;
export const COLOR_ZONA = ['rgb(var(--rep-obs-zona-1))', 'rgb(var(--rep-obs-zona-2))', 'rgb(var(--rep-obs-zona-3))'];
const NOMBRE_NIVEL = { provincia: 'provincia', subdivision: 'comuna o partido', localidad: 'barrio o localidad' };

/** Zonas elegidas en la dirección: válidas, sin repetir, como máximo 3, en el orden en que llegaron. */
export const leerZonas = (texto, indice) =>
  [...new Set(String(texto ?? '').split(',').map((s) => s.trim()).filter(Boolean))].filter((id) => !indice || indice.has(id)).slice(0, MAX_ZONAS);

/** Jurisdicción con la que se compara cada zona: la de arriba (para una provincia, el país). */
const jurisdiccion = (indice, z) => {
  const padre = z.padreId ? indice.get(z.padreId) : null;
  return padre ? { nivel: padre.nivel, zona: padre.id, nombre: nombreCorto(padre.nombre) } : { nivel: 'pais', zona: null, nombre: NOMBRE_PAIS };
};

/** Selector «Agregar zona»: provincias, y cada comuna o partido con sus barrios o localidades. */
const AgregarZona = ({ indice, elegidas, onAgregar }) => {
  const provincias = hijosDe(indice, 'pais', null);
  return (
    <label className="flex min-h-touch items-center gap-2 rounded-xl border border-dashed border-rep-accent-border bg-rep-surface px-3 text-rep-label font-bold text-rep-accent">
      <Plus aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />
      <select
        aria-label="Agregar zona"
        value=""
        onChange={(e) => e.target.value && onAgregar(e.target.value)}
        className="rep-focus min-w-0 flex-1 cursor-pointer border-0 bg-transparent font-bold text-inherit outline-none"
      >
        <option value="">Agregar zona</option>
        <optgroup label="Provincias">
          {provincias.map((p) => (
            <option key={p.id} value={p.id} disabled={elegidas.includes(p.id)}>
              {p.nombre}
            </option>
          ))}
        </optgroup>
        {provincias.flatMap((p) =>
          hijosDe(indice, 'provincia', p.id).map((s) => (
            <optgroup key={s.id} label={`${s.nombre} · ${p.nombre}`}>
              <option value={s.id} disabled={elegidas.includes(s.id)}>
                {s.nombre} (toda)
              </option>
              {hijosDe(indice, 'subdivision', s.id).map((l) => (
                <option key={l.id} value={l.id} disabled={elegidas.includes(l.id)}>
                  {l.nombre}
                </option>
              ))}
            </optgroup>
          ))
        )}
      </select>
    </label>
  );
};

/** «Primero, la respuesta»: una fila por indicador y una columna por zona, cada cifra con la de su jurisdicción. */
const PrimeroLaRespuesta = ({ zonas }) => {
  const columnas = { gridTemplateColumns: `minmax(84px, 1.1fr) repeat(${zonas.length}, minmax(0, 1fr))` };
  const Fila = ({ indicador, sub, valor }) => (
    <div className="grid items-start gap-2 border-t border-rep-divider py-2.5" style={columnas}>
      <div className="flex flex-col">
        <span className="text-[12.5px] font-bold text-rep-ink">{indicador}</span>
        {sub && <small className="text-[11px] font-semibold text-rep-ink-faint">{sub}</small>}
      </div>
      {zonas.map((z) => (
        <div key={z.id} className="flex min-w-0 flex-col">{valor(z)}</div>
      ))}
    </div>
  );
  // La cifra va en tinta, no en el color de la zona (el verde agua no llega al contraste de texto sobre blanco):
  // el color identifica la columna en el encabezado
  const Cifra = ({ children }) => (
    <b className="text-[17px] font-extrabold leading-tight tabular-nums text-rep-ink desktop:text-[19px]">{children}</b>
  );
  const Nota = ({ children }) => <small className="break-words text-[11px] font-semibold leading-tight text-rep-ink-faint">{children}</small>;

  return (
    <div data-testid="obs-comparar-respuesta">
      <div className="grid items-end gap-2 pb-2" style={columnas}>
        <span />
        {zonas.map((z) => (
          <div key={z.id} className="flex min-w-0 flex-col border-t-[3px] pt-1.5" style={{ borderColor: z.color }}>
            <span className="hyphens-auto break-words text-[11.5px] font-extrabold leading-tight text-rep-ink tablet:text-[12.5px]">{nombreCorto(z.nombre)}</span>
            <small className="break-words text-[11px] font-semibold leading-tight text-rep-ink-faint">{z.jurisdiccion.nombre}</small>
          </div>
        ))}
      </div>
      <Fila
        indicador="% resueltos"
        sub="contra su jurisdicción"
        valor={(z) => (
          <>
            <Cifra>{fmtPct(z.r.pctResueltos)}</Cifra>
            <Nota>
              {z.jurisdiccion.nombre}: {fmtPct(z.rj.pctResueltos)}
            </Nota>
          </>
        )}
      />
      <Fila
        indicador="Días hasta resolver"
        sub="mediana y p90"
        valor={(z) => (
          <>
            <Cifra>{fmtDias(z.r.medianaDias)}</Cifra>
            <Nota>p90: {fmtDias(z.r.p90Dias)}</Nota>
          </>
        )}
      />
      <Fila
        indicador="Resueltos en plazo"
        sub="plazo de cada categoría"
        valor={(z) => (
          <>
            <Cifra>{fmtPct(z.r.pctEnPlazo)}</Cifra>
            <Nota>
              {z.jurisdiccion.nombre}: {fmtPct(z.rj.pctEnPlazo)}
            </Nota>
          </>
        )}
      />
      <Fila indicador="Cada 10.000 habitantes" sub="Censo 2022" valor={(z) => <Cifra>{SIN_DATO}</Cifra>} />
      <Fila
        indicador="Reportes"
        sub="para contexto"
        valor={(z) => (
          <>
            <Cifra>{fmtNum(z.r.reportes)}</Cifra>
            <Nota>{fmtNum(z.r.abiertos)} abiertos</Nota>
          </>
        )}
      />
      <p className="m-0 border-t border-rep-divider pt-2.5 text-[11.5px] leading-snug text-rep-ink-muted">
        «—»: menos de {MIN_CASOS} casos, sin porcentaje ni días. «{SIN_DATO}»: todavía no hay población oficial cargada.
      </p>
    </div>
  );
};

export const CompararPage = () => {
  const [params, setParams] = useSearchParams();
  const { periodo, setPeriodo, categoria, setCategoria } = useObsFiltro();
  const territorio = useCarga(() => fetchZonas().then(indexarTerritorio), []);
  const indice = territorio.datos;
  const ids = useMemo(() => leerZonas(params.get('zonas'), indice), [params, indice]);
  const clave = ids.join(',');

  const ponerZonas = useCallback(
    (nuevas) =>
      setParams((actual) => {
        const p = new URLSearchParams(actual);
        if (nuevas.length) p.set('zonas', nuevas.join(','));
        else p.delete('zonas');
        return p;
      }),
    [setParams]
  );

  const desde = desdeDePeriodo(periodo);
  const cifras = useCarga(
    () =>
      !indice || !ids.length
        ? Promise.resolve(null)
        : Promise.all(
            ids.map((id, i) => {
              const z = indice.get(id);
              const j = jurisdiccion(indice, z);
              const lugar = { nivel: z.nivel, zona: z.id, desde };
              return Promise.all([
                fetchResumen({ ...lugar, categoria }),
                fetchResumen({ nivel: j.nivel, zona: j.zona, desde, categoria }),
                fetchPorMes({ ...lugar, categoria }),
                fetchPorCategoria(lugar),
              ]).then(([r, rj, porMes, porCategoria]) => ({
                id: z.id,
                nombre: z.nombre,
                nivel: z.nivel,
                color: COLOR_ZONA[i],
                jurisdiccion: j,
                r,
                rj,
                porMes: new Map(porMes.filter((f) => f.categoria === null).map((f) => [String(f.mes).slice(0, 10), f.reportes])),
                porCategoria,
              }));
            })
          ),
    [clave, desde, categoria, Boolean(indice)]
  );

  if (territorio.cargando) return <Cargando alto="h-40" etiqueta="Cargando zonas" />;
  if (territorio.error) return <ErrorCarga onReintentar={territorio.recargar} />;

  const zonas = cifras.datos ?? [];
  const plazos = Object.fromEntries((zonas[0]?.porCategoria ?? []).filter((f) => f.plazoDias).map((f) => [f.categoria, f.plazoDias]));
  const maxDias = Math.max(1, ...Object.values(plazos), ...zonas.flatMap((z) => z.porCategoria.map((f) => f.medianaDias ?? 0)));
  // Con los datos de hoy casi ninguna categoría llega a 5 resueltos: se dice, para que las barras vacías no parezcan un error
  const sinDias = zonas.length > 0 && zonas.every((z) => z.porCategoria.every((f) => f.medianaDias === null));

  return (
    <>
      <Encabezado
        titulo="Comparar zonas"
        sellos={<Sello />}
        bajada={`Hasta ${MAX_ZONAS} zonas de cualquier nivel, con el mismo criterio · ${textoPeriodo(periodo)}`}
        derecha={<SelectorPeriodo valor={periodo} onChange={setPeriodo} />}
      />

      {/* Zonas elegidas, como chips de color con su «quitar», y el selector para sumar otra */}
      <div className="flex flex-col gap-2.5 tablet:flex-row tablet:flex-wrap tablet:items-center">
        {ids.map((id, i) => {
          const z = indice.get(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => ponerZonas(ids.filter((x) => x !== id))}
              className="rep-focus inline-flex min-h-touch items-center gap-2 rounded-xl border-2 bg-rep-surface px-3 text-rep-label font-extrabold text-rep-ink"
              style={{ borderColor: COLOR_ZONA[i] }}
            >
              <i aria-hidden="true" className="h-3 w-3 rounded-sm" style={{ background: COLOR_ZONA[i] }} />
              {z.nombre}
              <small className="font-semibold text-rep-ink-faint">{NOMBRE_NIVEL[z.nivel]}</small>
              <X aria-hidden="true" className="h-4 w-4 text-rep-ink-faint" strokeWidth={2.5} />
              <span className="sr-only">Quitar {z.nombre}</span>
            </button>
          );
        })}
        {ids.length < MAX_ZONAS && <AgregarZona indice={indice} elegidas={ids} onAgregar={(id) => ponerZonas([...ids, id])} />}
        <span className="hidden flex-1 tablet:block" />
        {ids.length > 0 && <SelectorCategoria valor={categoria} onChange={setCategoria} />}
      </div>
      <ChipsFiltros categoria={categoria} onQuitarCategoria={() => setCategoria(null)} />

      {!ids.length ? (
        <EmptyState
          icon={ArrowLeftRight}
          title="Elegí una zona para empezar"
          description={`Podés comparar hasta ${MAX_ZONAS} zonas: barrios, comunas, partidos o provincias. También podés elegirlas desde el Mapa.`}
        />
      ) : (
        <>
          <Aviso icono={Scale}>
            Las zonas aparecen en el orden en que las elegiste. Comparar no es rankear: una zona con más reportes puede ser una donde más gente usa la
            app. Los colores identifican zonas, no «mejor» o «peor».
          </Aviso>

          {cifras.error ? (
            <ErrorCarga onReintentar={cifras.recargar} />
          ) : !cifras.datos ? (
            <Cargando alto="h-64" />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3.5 desktop:grid-cols-2 desktop:gap-4">
                <ObsCard titulo="Primero, la respuesta" sub="cada zona contra su jurisdicción">
                  <PrimeroLaRespuesta zonas={zonas} />
                </ObsCard>
                <ObsCard titulo="Reportes por mes" sub="para contexto, no para comparar">
                  <BarrasMesZonas meses={mesesDelPeriodo(periodo)} series={zonas} />
                </ObsCard>
              </div>
              <div className="grid grid-cols-1 gap-3.5 desktop:grid-cols-2 desktop:gap-4">
                <ObsCard
                  titulo="Días hasta resolver por categoría"
                  sub="mediana; la marca roja es el plazo"
                  pie={sinDias ? `Todavía ninguna categoría de estas zonas tiene ${MIN_CASOS} reportes resueltos: por eso no hay días. Los plazos sí se muestran.` : null}
                >
                  <BarrasCategoriaZonas
                    caption="Mediana de días hasta resolver por categoría"
                    series={zonas.map((z) => ({
                      ...z,
                      valores: Object.fromEntries(
                        CATEGORIAS.map((c) => {
                          const f = z.porCategoria.find((x) => x.categoria === c.code);
                          return [c.code, { valor: f?.medianaDias ?? null, texto: fmtDias(f?.medianaDias ?? null) }];
                        })
                      ),
                    }))}
                    max={maxDias}
                    marcas={plazos}
                  />
                </ObsCard>
                <ObsCard titulo="Qué se reporta" sub="en proporción del total de cada zona">
                  <BarrasCategoriaZonas
                    caption="Proporción de reportes por categoría en cada zona"
                    series={zonas.map((z) => {
                      const total = z.porCategoria.reduce((s, f) => s + f.reportes, 0);
                      return {
                        ...z,
                        valores: Object.fromEntries(
                          CATEGORIAS.map((c) => {
                            const n = z.porCategoria.find((x) => x.categoria === c.code)?.reportes ?? 0;
                            const pct = total ? (100 * n) / total : null;
                            return [c.code, { valor: pct, texto: total ? `${fmtPct(Math.round(pct))} (${fmtNum(n)})` : '—' }];
                          })
                        ),
                      };
                    })}
                    max={100}
                  />
                </ObsCard>
              </div>
            </>
          )}
        </>
      )}
    </>
  );
};

export default CompararPage;
