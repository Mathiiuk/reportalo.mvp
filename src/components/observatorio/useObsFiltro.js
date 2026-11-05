import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CATEGORIAS, PERIODOS, PERIODO_POR_DEFECTO } from './obsFormat';
import { NIVELES } from '../../services/observatorioService';

/**
 * OBS · F2 · Filtros del observatorio guardados en la dirección (?p=6&c=TRANSITO&zona=…).
 *
 * Así una vista se puede compartir o recargar sin perder lo elegido, y «Atrás» del navegador deshace un filtro.
 * Un valor que no es válido se ignora (vuelve al de por defecto) en vez de mandarse a la base.
 */
export const useObsFiltro = () => {
  const [params, setParams] = useSearchParams();

  const periodo = PERIODOS.some((p) => p.key === params.get('p')) ? params.get('p') : PERIODO_POR_DEFECTO;
  const categoria = CATEGORIAS.some((c) => c.code === params.get('c')) ? params.get('c') : null;
  const zona = params.get('zona') || null;
  // Nivel del mapa (F3): sin zona, siempre el país
  const nivel = zona && NIVELES.includes(params.get('nivel')) && params.get('nivel') !== 'pais' ? params.get('nivel') : 'pais';

  // Cambia una clave y deja las demás; null o el valor por defecto la sacan de la dirección
  const cambiar = useCallback(
    (clave, valor) =>
      setParams(
        (actual) => {
          const nuevo = new URLSearchParams(actual);
          if (valor === null || valor === undefined || valor === '' || (clave === 'p' && valor === PERIODO_POR_DEFECTO)) nuevo.delete(clave);
          else nuevo.set(clave, valor);
          return nuevo;
        },
        { replace: false }
      ),
    [setParams]
  );

  // Nivel y zona cambian juntos (bajar o subir en el mapa); el país no lleva ninguno de los dos
  const setLugar = useCallback(
    (nuevoNivel, nuevaZona) =>
      setParams((actual) => {
        const nuevo = new URLSearchParams(actual);
        if (nuevoNivel === 'pais' || !nuevaZona) {
          nuevo.delete('nivel');
          nuevo.delete('zona');
        } else {
          nuevo.set('nivel', nuevoNivel);
          nuevo.set('zona', nuevaZona);
        }
        return nuevo;
      }),
    [setParams]
  );

  return useMemo(
    () => ({
      periodo,
      categoria,
      zona,
      nivel,
      setPeriodo: (v) => cambiar('p', v),
      setCategoria: (v) => cambiar('c', v),
      setZona: (v) => cambiar('zona', v),
      setLugar,
    }),
    [periodo, categoria, zona, nivel, cambiar, setLugar]
  );
};
