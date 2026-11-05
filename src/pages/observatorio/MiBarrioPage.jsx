import React, { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftRight, House } from 'lucide-react';
import { Aviso, ChipsFiltros, Encabezado, Kpi, Kpis, ListaLectura, Migas, ObsCard, SelectorCategoria, SelectorPeriodo, Sello, Tabla } from '../../components/observatorio/ObsUi';
import { BarrasMes, DonaCategorias } from '../../components/observatorio/ObsGraficos';
import { Cargando, ErrorCarga, SinReportes, notaMenosDeCinco, useCarga } from '../../components/observatorio/ObsEstados';
import { useObsFiltro } from '../../components/observatorio/useObsFiltro';
import { CATEGORIAS, desdeDePeriodo, fmtDias, fmtNum, fmtPct, mesesDelPeriodo, nombreCategoria, textoPeriodo } from '../../components/observatorio/obsFormat';
import { fetchPorCategoria, fetchPorMes, fetchResumen, fetchZonas } from '../../services/observatorioService';

/**
 * OBS · F2 · Mi barrio (POC D56/M49): la puerta de entrada del vecino, pensada primero para el teléfono.
 *
 * Responde «¿me lo arreglan?»: % resueltos, días hasta resolver y cumplimiento de plazo, cada cifra comparada con su
 * comuna o partido (nunca con otros barrios). El volumen queda como contexto.
 *
 * Cambios contra el POC, por los datos reales (04/11/2026):
 * - «% resueltos por mes» pasa a «Reportes por mes» con la parte resuelta adentro: con 5 resueltos en toda la base,
 *   una línea de porcentajes saldría vacía en casi todos los meses.
 * - «Problemas que vuelven» se cambia por «Cumplimiento de plazo» (la reincidencia espera la definición del PO).
 * - «Top 5 prestaciones» se cambia por «Cómo se resuelve cada categoría»: el reporte no guarda la prestación.
 * - Sin el límite de una consulta por día: es una hipótesis comercial (REP-3407) que todavía no está decidida.
 */

// Zona elegida la última vez, solo en este navegador (comodidad: si no está, se vuelve a elegir)
const CLAVE_ZONA = 'reportalo_obs_mi_barrio';
const leerZonaGuardada = () => {
  try {
    return localStorage.getItem(CLAVE_ZONA);
  } catch {
    return null;
  }
};
const guardarZona = (id) => {
  try {
    localStorage.setItem(CLAVE_ZONA, id);
  } catch {
    /* sin almacenamiento: no pasa nada */
  }
};

const COMO_LEER = [
  'Más reportes no quiere decir peor barrio: depende de cuánta gente usa la app y cuántos viven ahí.',
  'Los meses recientes parecen peores: sus reportes todavía no tuvieron tiempo de resolverse.',
  '«Resuelto» no es lo mismo que «cerrado»: un reporte desestimado también se cierra.',
  'Cada cifra se compara con tu comuna o partido, nunca con otros barrios.',
];

/**
 * Arma el territorio para el selector: barrios y localidades agrupados por comuna o partido, con su provincia.
 * @returns {{ grupos: Array<{ id, nombre, provincia, localidades: Array }>, porId: Map }}
 */
export const armarTerritorio = (zonas) => {
  const provincias = new Map(zonas.filter((z) => z.nivel === 'provincia').map((z) => [z.zona_id, z.nombre]));
  const subdivisiones = zonas
    .filter((z) => z.nivel === 'subdivision')
    .map((z) => ({ id: z.zona_id, nombre: z.nombre, provinciaId: z.padre_id, provincia: provincias.get(z.padre_id) ?? z.padre_nombre }));
  const porId = new Map();
  const grupos = subdivisiones
    .map((s) => ({
      ...s,
      localidades: zonas
        .filter((z) => z.nivel === 'localidad' && z.padre_id === s.id)
        .map((z) => ({ id: z.zona_id, nombre: z.nombre }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    }))
    .filter((g) => g.localidades.length > 0)
    // Orden: provincia y después comuna o partido, con «Comuna 2» antes que «Comuna 10»
    .sort((a, b) => a.provincia.localeCompare(b.provincia, 'es') || a.nombre.localeCompare(b.nombre, 'es', { numeric: true }));
  grupos.forEach((g) => g.localidades.forEach((l) => porId.set(l.id, { ...l, padre: g })));
  return { grupos, porId };
};

const SelectorZona = ({ territorio, valor, onChange }) => (
  <label className="flex min-h-touch min-w-0 flex-1 items-center gap-2 rounded-xl border border-rep-border bg-rep-surface px-3 text-rep-label font-bold text-rep-ink-label tablet:max-w-[360px]">
    <House aria-hidden="true" className="h-4 w-4 shrink-0 text-rep-accent" strokeWidth={2.25} />
    <select
      aria-label="Mi barrio o localidad"
      value={valor ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      className="rep-focus min-w-0 flex-1 cursor-pointer border-0 bg-transparent font-bold text-rep-ink outline-none"
    >
      <option value="">Elegí tu barrio o localidad</option>
      {territorio.grupos.map((g) => (
        <optgroup key={g.id} label={`${g.nombre} · ${g.provincia}`}>
          {g.localidades.map((l) => (
            <option key={l.id} value={l.id}>
              {l.nombre}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  </label>
);

/** Las cifras de una zona elegida. */
const Tablero = ({ zona, filtro }) => {
  const { periodo, categoria, setCategoria } = filtro;
  const desde = desdeDePeriodo(periodo);
  const padre = zona.padre;

  const { cargando, error, datos, recargar } = useCarga(
    () =>
      Promise.all([
        fetchResumen({ nivel: 'localidad', zona: zona.id, desde, categoria }),
        fetchResumen({ nivel: 'subdivision', zona: padre.id, desde, categoria }),
        fetchPorMes({ nivel: 'localidad', zona: zona.id, desde, categoria }),
        fetchPorCategoria({ nivel: 'localidad', zona: zona.id, desde }),
      ]).then(([resumen, resumenPadre, porMes, porCategoria]) => ({ resumen, resumenPadre, porMes, porCategoria })),
    [zona.id, desde, categoria]
  );

  // Todos los meses del período, con 0 donde no hubo reportes (la base solo devuelve meses con reportes)
  const meses = useMemo(() => {
    const totales = new Map((datos?.porMes ?? []).filter((f) => f.categoria === null).map((f) => [String(f.mes).slice(0, 10), f]));
    return mesesDelPeriodo(periodo).map((mes) => totales.get(mes) ?? { mes, reportes: 0, resueltos: 0, pctResueltos: null });
  }, [datos, periodo]);

  if (cargando && !datos) {
    return (
      <>
        <Kpis>
          {[0, 1, 2, 3].map((i) => (
            <Cargando key={i} alto="h-[104px]" />
          ))}
        </Kpis>
        <Cargando alto="h-64" />
      </>
    );
  }
  if (error) return <ErrorCarga onReintentar={recargar} />;

  const { resumen: r, resumenPadre: rp, porCategoria } = datos;

  return (
    <>
      <Kpis>
        <Kpi
          testId="obs-kpi-resueltos"
          destacado={r.pctResueltos > 0}
          valor={fmtPct(r.pctResueltos)}
          etiqueta="de lo reportado se resolvió"
          nota={r.pctResueltos === null ? notaMenosDeCinco() : `${padre.nombre}: ${fmtPct(rp.pctResueltos)}`}
        />
        <Kpi
          testId="obs-kpi-dias"
          valor={fmtDias(r.medianaDias)}
          etiqueta="tarda lo que se arregla (mediana)"
          nota={r.medianaDias === null ? notaMenosDeCinco('días') : `El 90 % se resuelve en menos de ${fmtDias(r.p90Dias)}`}
        />
        <Kpi
          testId="obs-kpi-plazo"
          valor={fmtPct(r.pctEnPlazo)}
          etiqueta="se resolvió dentro del plazo"
          nota={r.pctEnPlazo === null ? `${fmtNum(r.elegiblesPlazo)} con el plazo cumplido: pocos para un %` : `${padre.nombre}: ${fmtPct(rp.pctEnPlazo)}`}
        />
        <Kpi testId="obs-kpi-reportes" valor={fmtNum(r.reportes)} etiqueta="reportes en el período" nota="Para contexto, no para comparar" />
      </Kpis>

      {r.reportes === 0 ? (
        <SinReportes zona={zona.nombre} periodo={textoPeriodo(periodo)} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3.5 desktop:grid-cols-[1.35fr_1fr] desktop:gap-4">
            <ObsCard titulo="Reportes por mes" sub={categoria ? nombreCategoria(categoria) : zona.nombre}>
              <BarrasMes meses={meses} />
            </ObsCard>
            <ObsCard
              titulo="Qué se reporta"
              sub="tocá una categoría para filtrar"
              pie={categoria ? `Filtrando por ${nombreCategoria(categoria)}. Tocala de nuevo para ver todas.` : null}
            >
              <DonaCategorias filas={porCategoria} seleccion={categoria} onSeleccion={setCategoria} />
            </ObsCard>
          </div>

          <div className="grid grid-cols-1 gap-3.5 desktop:grid-cols-[1.35fr_1fr] desktop:gap-4">
            <ObsCard titulo="Cómo se resuelve cada categoría" sub={zona.nombre}>
              <Tabla
                caption="Reportes, resueltos y días por categoría"
                columnas={['Categoría', 'Reportes', '% resueltos', 'Mediana', 'Plazo']}
                filas={CATEGORIAS.map((c) => {
                  const f = porCategoria.find((x) => x.categoria === c.code) ?? {};
                  return [c.nombre, fmtNum(f.reportes ?? 0), fmtPct(f.pctResueltos ?? null), fmtDias(f.medianaDias ?? null), fmtDias(f.plazoDias ?? null)];
                })}
              />
            </ObsCard>
            <ObsCard titulo="Cómo leer estos datos">
              <ListaLectura items={COMO_LEER} />
            </ObsCard>
          </div>
        </>
      )}
    </>
  );
};

export const MiBarrioPage = () => {
  const navigate = useNavigate();
  const filtro = useObsFiltro();
  const { periodo, setPeriodo, categoria, setCategoria, zona: zonaId, setZona } = filtro;
  const { cargando, error, datos: territorio, recargar } = useCarga(() => fetchZonas().then(armarTerritorio), []);

  // Sin zona en la dirección, se retoma la que el vecino eligió la última vez en este navegador
  useEffect(() => {
    if (!zonaId && territorio) {
      const guardada = leerZonaGuardada();
      if (guardada && territorio.porId.has(guardada)) setZona(guardada);
    }
  }, [zonaId, territorio, setZona]);

  const zona = zonaId && territorio ? territorio.porId.get(zonaId) : null;
  useEffect(() => {
    if (zona) guardarZona(zona.id);
  }, [zona]);

  if (cargando) return <Cargando alto="h-40" etiqueta="Cargando barrios" />;
  if (error) return <ErrorCarga onReintentar={recargar} />;

  const migas = zona
    ? [{ nombre: 'Argentina' }, { nombre: zona.padre.provincia }, { nombre: zona.padre.nombre }, { nombre: zona.nombre }]
    : null;

  return (
    <>
      {migas && <Migas pasos={migas} />}
      <Encabezado
        titulo={zona ? `Mi barrio: ${zona.nombre}` : 'Mi barrio'}
        sellos={zona ? <Sello /> : null}
        bajada={
          zona
            ? `${textoPeriodo(periodo).replace(/^./, (c) => c.toUpperCase())} · comparado con ${zona.padre.nombre}`
            : 'Elegí tu barrio o localidad para ver cómo se atienden los problemas.'
        }
        derecha={zona ? <SelectorPeriodo valor={periodo} onChange={setPeriodo} /> : null}
      />

      <div className="flex flex-col gap-2.5 tablet:flex-row tablet:flex-wrap tablet:items-center">
        <SelectorZona territorio={territorio} valor={zona?.id ?? null} onChange={setZona} />
        {zona && <SelectorCategoria valor={categoria} onChange={setCategoria} />}
      </div>
      {zona && <ChipsFiltros categoria={categoria} onQuitarCategoria={() => setCategoria(null)} />}

      {zona ? (
        <>
          <Tablero zona={zona} filtro={filtro} />
          <button
            type="button"
            onClick={() => navigate(`/observatorio/comparar?zonas=${zona.id}`)}
            className="rep-focus flex min-h-touch items-center justify-center gap-2 self-stretch rounded-xl border border-rep-border bg-rep-surface px-4 text-rep-label font-bold text-rep-ink-label hover:bg-rep-surface-sunken tablet:self-start"
          >
            <ArrowLeftRight aria-hidden="true" className="h-4 w-4" strokeWidth={2.25} />
            Comparar con otras zonas
          </button>
        </>
      ) : (
        <Aviso icono={House}>
          Vas a ver qué parte de lo reportado se resolvió, en cuántos días y qué es lo que más se reporta, comparado con tu comuna o partido.
        </Aviso>
      )}
    </>
  );
};

export default MiBarrioPage;
