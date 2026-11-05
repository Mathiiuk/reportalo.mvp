import React from 'react';
import { ObsCard, Encabezado, Sello, ListaLectura, Tabla, Kpi, Kpis } from '../../components/observatorio/ObsUi';
import { Cargando, ErrorCarga, useCarga } from '../../components/observatorio/ObsEstados';
import { fmtDias, fmtNum, fmtPct, nombreCategoria } from '../../components/observatorio/obsFormat';
import { fetchPlazos, fetchResumen, MIN_CASOS } from '../../services/observatorioService';

/**
 * OBS · F1 · Metodología (POC D61/M54): qué mide cada número, qué no se puede concluir y de dónde sale.
 *
 * Las fórmulas son las de la migración 20261105010506_obs_f0a_agregados_del_observatorio.sql. Los plazos se leen de la
 * base, así que si el PO los cambia, la pantalla cambia sola. «Hoy en la base» muestra el total del país para que se
 * vea con qué volumen se calcula todo.
 */

const INDICADORES = [
  ['Reportes', 'Reportes creados en el período, de las cuatro categorías. Vulnerabilidad social no entra.'],
  ['% resueltos', 'Reportes que hoy están en «Resuelto» ÷ reportes. No es «cerrados»: «Desestimado» e «Informado» también cierran un reporte.'],
  ['Días hasta resolver', 'Mediana y p90 de los días entre la creación y el primer paso a «Resuelto». El 90 % se resolvió en menos que el p90.'],
  ['Cumplimiento de plazo', 'Resueltos dentro del plazo de su categoría ÷ reportes que ya tuvieron tiempo de cumplirlo.'],
  ['Abiertos', 'Reportes en un estado abierto según Open311: Recibido, En análisis, Derivado, Escalado o En discrepancia.'],
  ['Menos de 5 casos', `Con menos de ${MIN_CASOS} casos se muestra la cantidad, pero no porcentajes ni días: un solo reporte movería todo.`],
];

const NO_CONCLUIR = [
  'Más reportes no quiere decir peor zona ni mayor vulnerabilidad social: depende de cuánta gente usa la app. Por eso no hay rankings: las tablas van en orden alfabético.',
  'Los meses recientes parecen peores porque sus reportes todavía no tuvieron tiempo de resolverse.',
  `Con menos de ${MIN_CASOS} reportes se muestra la cantidad, pero no porcentajes ni días.`,
  'Hacia el vecino solo se distingue «abierto» y «cerrado» de Open311; los estados internos son del organismo.',
  'Solo agregados: sin fotos, sin descripciones, sin direcciones y sin puntos sueltos en el mapa.',
];

const ORIGEN = [
  ['Territorio: país › provincia › comuna o partido › barrio o localidad', 'Base de Reportalo'],
  ['Categorías, estados y su equivalencia Open311', 'Base de Reportalo'],
  ['Reportes, fechas y cambios de estado', 'Reportes reales enviados desde la app'],
  ['Plazos por categoría', 'Definidos por el PO el 03/11/2026'],
  ['Población (tasa cada 10.000 habitantes)', 's/d: todavía no está cargado el Censo 2022'],
  ['Centro de cada zona en el mapa', 'Aproximado: la base no tiene los límites de las zonas'],
];

const TODAVIA_NO = [
  'Problemas que vuelven y puntos crónicos: esperan la definición del PO.',
  'Prestaciones (bache, luminaria, etc.): el reporte todavía no guarda la prestación, así que todo va por categoría.',
  'Tasa cada 10.000 habitantes: falta cargar la población oficial.',
];

const HoyEnLaBase = () => {
  const { cargando, error, datos, recargar } = useCarga(() => fetchResumen({ nivel: 'pais' }), []);
  if (cargando) return <Cargando alto="h-28" />;
  if (error) return <ErrorCarga onReintentar={recargar} />;
  return (
    <Kpis>
      <Kpi testId="obs-met-reportes" valor={fmtNum(datos.reportes)} etiqueta="reportes en total" nota="Todas las zonas, desde el primero" />
      <Kpi valor={fmtNum(datos.resueltos)} etiqueta="resueltos" nota={`${fmtPct(datos.pctResueltos)} del total`} destacado />
      <Kpi valor={fmtDias(datos.medianaDias)} etiqueta="hasta resolver (mediana)" nota={datos.p90Dias !== null ? `p90: ${fmtDias(datos.p90Dias)}` : `Menos de ${MIN_CASOS} resueltos`} />
      <Kpi valor={fmtNum(datos.abiertos)} etiqueta="abiertos" nota="Todavía en curso" />
    </Kpis>
  );
};

const Plazos = () => {
  const { cargando, error, datos, recargar } = useCarga(fetchPlazos, []);
  if (cargando) return <Cargando alto="h-20" />;
  if (error) return <ErrorCarga onReintentar={recargar} />;
  return (
    <Tabla
      caption="Plazos por categoría"
      columnas={['Categoría', 'Plazo', 'Fuente']}
      filas={datos.map((p) => [nombreCategoria(p.categoria), fmtDias(p.plazoDias), p.fuente])}
    />
  );
};

export const MetodologiaPage = () => (
  <>
    <Encabezado titulo="Metodología" sellos={<Sello />} bajada="Qué mide cada número, qué no se puede concluir y de dónde sale" />

    <ObsCard titulo="Hoy en la base" sub="se calcula al abrir esta pantalla">
      <HoyEnLaBase />
    </ObsCard>

    <div className="grid grid-cols-1 gap-3.5 desktop:grid-cols-2 desktop:gap-4">
      <ObsCard titulo="Cómo se calcula cada número">
        <Tabla caption="Indicadores" columnas={['Indicador', 'Cálculo']} filas={INDICADORES} />
      </ObsCard>
      <div className="flex flex-col gap-3.5 desktop:gap-4">
        <ObsCard titulo="Qué no se puede concluir">
          <ListaLectura items={NO_CONCLUIR} />
        </ObsCard>
        <ObsCard titulo="Plazos por categoría" sub="para el cumplimiento">
          <Plazos />
        </ObsCard>
      </div>
    </div>

    <div className="grid grid-cols-1 gap-3.5 desktop:grid-cols-2 desktop:gap-4">
      <ObsCard titulo="De dónde salen los datos">
        <Tabla caption="Origen de los datos" columnas={['Elemento', 'Origen']} filas={ORIGEN} />
      </ObsCard>
      <ObsCard titulo="Lo que todavía no se mide">
        <ListaLectura items={TODAVIA_NO} />
      </ObsCard>
    </div>
  </>
);

export default MetodologiaPage;
