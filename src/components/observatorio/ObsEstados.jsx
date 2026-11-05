import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Construction, LocateOff } from 'lucide-react';
import { EmptyState } from '../common/EmptyState';
import { MIN_CASOS } from '../../services/observatorioService';

/**
 * OBS · F1 · Estados del observatorio (POC D60/M53: «Cuatro estados que no pueden faltar»).
 *
 * - Sin reportes: la zona existe pero no tiene reportes en el período.
 * - Menos de 5: la cantidad se muestra, el porcentaje y los días no (la base los devuelve null).
 * - Sin dato oficial: «s/d» (lo resuelve obsFormat).
 * - Sin conexión: franja fija en ObsLayout.
 * Más los dos de cualquier pantalla con datos: cargando y error.
 */

/** Nota que acompaña un «—» por tener menos de 5 casos. */
export const notaMenosDeCinco = (que = 'porcentaje') => `Menos de ${MIN_CASOS} casos: sin ${que}`;

export const SinReportes = ({ zona, periodo }) => (
  <EmptyState
    icon={LocateOff}
    title={`Todavía no hay reportes${zona ? ` en ${zona}` : ''}`}
    description={`No hay reportes${periodo ? ` de ${periodo}` : ''} en esta zona. Cuando los vecinos reporten, acá vas a ver qué parte se resolvió y en cuántos días.`}
  />
);

export const ErrorCarga = ({ onReintentar }) => (
  <EmptyState
    icon={AlertCircle}
    title="No pudimos traer las cifras"
    description="Revisá tu conexión y volvé a intentar."
    primaryAction={onReintentar ? { label: 'Reintentar', onClick: onReintentar } : null}
  />
);

export const EnConstruccion = ({ seccion, queVaATener }) => (
  <EmptyState icon={Construction} title={`${seccion}: en construcción`} description={queVaATener} />
);

/** Bloque gris mientras carga (sin spinner: mantiene el lugar de la tarjeta). */
export const Cargando = ({ alto = 'h-24', etiqueta = 'Cargando cifras' }) => (
  <div role="status" aria-label={etiqueta} className={`w-full animate-pulse rounded-2xl bg-rep-divider ${alto}`} />
);

/**
 * Carga asíncrona con estado { cargando, error, datos } y un `recargar`.
 * Ignora la respuesta si el componente se desmontó o cambió la consulta.
 * @param {Function} fn función que devuelve una promesa
 * @param {Array} deps dependencias que vuelven a disparar la consulta
 */
export const useCarga = (fn, deps) => {
  const [estado, setEstado] = useState({ cargando: true, error: null, datos: null });
  const [vuelta, setVuelta] = useState(0);
  const recargar = useCallback(() => setVuelta((v) => v + 1), []);

  useEffect(() => {
    let vigente = true;
    setEstado((e) => ({ ...e, cargando: true, error: null }));
    fn()
      .then((datos) => vigente && setEstado({ cargando: false, error: null, datos }))
      .catch((error) => vigente && setEstado({ cargando: false, error, datos: null }));
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, vuelta]);

  return { ...estado, recargar };
};
