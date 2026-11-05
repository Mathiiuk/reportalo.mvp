import React, { useState } from 'react';
import { CATEGORIAS, fmtNum, fmtPct, mesCorto, mesLargo, mesTodaviaAbierto } from './obsFormat';

/**
 * OBS · Gráficos del observatorio, en HTML y SVG propios (sin librería).
 *
 * Reglas del skill de visualización que se aplican:
 * - Una sola serie no lleva leyenda (el título la nombra); varias, leyenda con números.
 * - Marcas finas con extremos redondeados, 2 px de separación entre segmentos.
 * - Cada marca tiene su detalle al pasar el mouse o al tocarla, y hay una tabla para lectores de pantalla.
 * - El texto usa los tokens de tinta, nunca el color de la serie.
 *
 * Meses en curso (Hernán, 05/11/2026: «¿qué son las torres naranjas?»): el rayado de fondo no se entendía. Ahora el mes
 * que empezó hace menos de 60 días dice «en curso» escrito debajo, en el eje, y en la línea su tramo va punteado.
 */

/** Eje de meses: el nombre corto y, debajo, «en curso» si sus reportes todavía no tuvieron tiempo de resolverse. */
export const EjeMeses = ({ meses, hoy = new Date() }) => (
  <div className="flex gap-2" aria-hidden="true">
    {meses.map((m) => (
      <span key={m} className="flex min-w-0 flex-1 flex-col items-center leading-tight">
        <span className="text-[11px] font-semibold text-rep-ink-faint">{mesCorto(m)}</span>
        {mesTodaviaAbierto(m, hoy) && <span className="text-[10px] font-bold text-rep-warning-ink">en curso</span>}
      </span>
    ))}
  </div>
);

/** Nota al pie para los gráficos por mes: qué quiere decir «en curso». Solo si algún mes lo está. */
export const NotaEnCurso = ({ meses, hoy = new Date() }) =>
  meses.some((m) => mesTodaviaAbierto(m, hoy)) ? (
    <p className="m-0 text-[11.5px] leading-snug text-rep-ink-muted">
      <b className="font-bold text-rep-warning-ink">En curso:</b> son meses recientes. Sus reportes todavía no tuvieron tiempo de resolverse, así
      que esas cifras van a cambiar.
    </p>
  ) : null;

/** Línea de detalle arriba de un gráfico: lo señalado, o una ayuda si no hay nada señalado. */
const Detalle = ({ children }) => (
  <p aria-live="polite" className="m-0 min-h-[18px] text-[12px] text-rep-ink-label">
    {children ?? <span className="text-rep-ink-faint">Pasá el mouse o tocá un mes para ver el detalle.</span>}
  </p>
);

/**
 * Mi barrio · Reportes por mes: una línea simple con área (como el mockup de Hernán, «para el ciudadano es más fácil»).
 * El tramo de los meses en curso va punteado y sus puntos huecos.
 *
 * @param {Array<{ mes: string, reportes: number, resueltos: number, pctResueltos: number|null }>} meses
 *   todos los meses del período (los que no tienen reportes vienen en 0)
 */
export const LineaMes = ({ meses, hoy = new Date() }) => {
  const [activo, setActivo] = useState(null);
  const n = meses.length;
  const max = Math.max(1, ...meses.map((m) => m.reportes));
  // Coordenadas en porcentaje del área del gráfico. x: el centro de la columna de cada mes, para que el punto caiga
  // justo encima de su nombre en el eje (EjeMeses reparte el ancho en columnas iguales). y: de 12 a 96, con lugar arriba
  const x = (i) => ((i + 0.5) * 100) / n;
  const y = (v) => 96 - (84 * v) / max;
  const puntos = meses.map((m, i) => ({ ...m, i, px: x(i), py: y(m.reportes), abierto: mesTodaviaAbierto(m.mes, hoy) }));
  const primeroAbierto = puntos.findIndex((p) => p.abierto);
  const maduros = primeroAbierto === -1 ? puntos : puntos.slice(0, primeroAbierto);
  // El tramo punteado arranca en el último mes maduro, para que la línea no se corte
  const enCurso = primeroAbierto === -1 ? [] : puntos.slice(Math.max(0, primeroAbierto - 1));
  const camino = (ps) => ps.map((p, j) => `${j ? 'L' : 'M'}${p.px},${p.py}`).join(' ');
  const area = `${camino(puntos)} L${puntos[n - 1].px},96 L${puntos[0].px},96 Z`;
  const pico = puntos.reduce((a, b) => (b.reportes > a.reportes ? b : a), puntos[0]);
  const detalle = activo !== null ? meses[activo] : null;

  return (
    <div className="flex flex-col gap-2">
      <Detalle>
        {detalle && (
          <>
            <b className="text-rep-ink">{mesLargo(detalle.mes)}:</b> {fmtNum(detalle.reportes)} reportes · {fmtNum(detalle.resueltos)} resueltos
            {detalle.pctResueltos !== null && ` (${fmtPct(detalle.pctResueltos)})`}
            {mesTodaviaAbierto(detalle.mes, hoy) && ' · en curso'}
          </>
        )}
      </Detalle>

      <div className="relative h-[170px] border-b border-rep-divider desktop:h-[200px]" aria-hidden="true">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
          <path d={area} fill="rgb(var(--rep-accent) / 0.12)" stroke="none" />
          {maduros.length > 1 && (
            <path d={camino(maduros)} fill="none" stroke="rgb(var(--rep-accent))" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          )}
          {enCurso.length > 1 && (
            <path d={camino(enCurso)} fill="none" stroke="rgb(var(--rep-accent))" strokeWidth="2" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          )}
        </svg>
        {/* Puntos en HTML: quedan redondos aunque el SVG se estire. Huecos en los meses en curso */}
        {puntos.map((p) => (
          <button
            key={p.mes}
            type="button"
            tabIndex={-1}
            onMouseEnter={() => setActivo(p.i)}
            onMouseLeave={() => setActivo(null)}
            onClick={() => setActivo(activo === p.i ? null : p.i)}
            className="absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
            style={{ left: `${p.px}%`, top: `${p.py}%` }}
          >
            <span
              className={`block h-2.5 w-2.5 rounded-full border-2 border-rep-accent ${p.abierto ? 'bg-rep-surface' : 'bg-rep-accent'} ${activo === p.i ? 'scale-150' : ''}`}
            />
          </button>
        ))}
        {/* Etiquetas selectivas: el pico y el último mes */}
        {[pico, puntos[n - 1]]
          .filter((p, j, arr) => p.reportes > 0 && arr.indexOf(p) === j)
          .map((p) => (
            <span
              key={`et-${p.mes}`}
              className="pointer-events-none absolute -translate-x-1/2 text-[11px] font-bold text-rep-ink-label"
              style={{ left: `${p.px}%`, top: `calc(${p.py}% - 22px)` }}
            >
              {fmtNum(p.reportes)}
            </span>
          ))}
      </div>
      <EjeMeses meses={meses.map((m) => m.mes)} hoy={hoy} />
      <NotaEnCurso meses={meses.map((m) => m.mes)} hoy={hoy} />

      <div className="sr-only">
        <table>
          <caption>Reportes y resueltos por mes</caption>
          <thead>
            <tr>
              <th scope="col">Mes</th>
              <th scope="col">Reportes</th>
              <th scope="col">Resueltos</th>
              <th scope="col">% resueltos</th>
            </tr>
          </thead>
          <tbody>
            {meses.map((m) => (
              <tr key={m.mes}>
                <th scope="row">
                  {mesLargo(m.mes)}
                  {mesTodaviaAbierto(m.mes, hoy) ? ' (en curso)' : ''}
                </th>
                <td>{fmtNum(m.reportes)}</td>
                <td>{fmtNum(m.resueltos)}</td>
                <td>{fmtPct(m.pctResueltos)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/**
 * Reportes por mes y categoría (Mapa): columnas apiladas en el orden fijo de las categorías, con 2 px entre
 * segmentos. Con un filtro de categoría queda solo esa.
 */
export const BarrasMesCategoria = ({ meses, filas, categoria = null, hoy = new Date() }) => {
  const [activo, setActivo] = useState(null);
  const cats = categoria ? CATEGORIAS.filter((c) => c.code === categoria) : CATEGORIAS;
  const valor = (mes, code) => filas.find((f) => String(f.mes).slice(0, 10) === mes && f.categoria === code)?.reportes ?? 0;
  const columnas = meses.map((mes) => {
    const partes = cats.map((c) => ({ ...c, n: valor(mes, c.code) }));
    return { mes, partes, total: partes.reduce((s, p) => s + p.n, 0) };
  });
  const max = Math.max(1, ...columnas.map((c) => c.total));
  const detalle = activo !== null ? columnas[activo] : null;

  return (
    <div className="flex flex-col gap-2">
      {cats.length > 1 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] font-semibold text-rep-ink-muted">
          {cats.map((c) => (
            <span key={c.code} className="inline-flex items-center gap-1.5">
              <i aria-hidden="true" className="h-2.5 w-2.5 rounded-sm" style={{ background: c.color }} />
              {c.nombre} <b className="font-bold text-rep-ink-label">{fmtNum(columnas.reduce((s, col) => s + col.partes.find((p) => p.code === c.code).n, 0))}</b>
            </span>
          ))}
        </div>
      )}
      <Detalle>
        {detalle && (
          <>
            <b className="text-rep-ink">{mesLargo(detalle.mes)}:</b> {fmtNum(detalle.total)} reportes
            {cats.length > 1 && ` · ${detalle.partes.filter((p) => p.n).map((p) => `${p.nombre} ${fmtNum(p.n)}`).join(' · ')}`}
          </>
        )}
      </Detalle>
      <div className="flex h-[160px] items-end gap-2 border-b border-rep-divider desktop:h-[190px]" aria-hidden="true">
        {columnas.map((col, i) => (
          <button
            key={col.mes}
            type="button"
            tabIndex={-1}
            onMouseEnter={() => setActivo(i)}
            onMouseLeave={() => setActivo(null)}
            onClick={() => setActivo(activo === i ? null : i)}
            className={`flex h-full min-w-0 flex-1 flex-col items-center justify-end rounded-t-md ${activo === i ? 'bg-rep-divider/70' : ''}`}
          >
            <span className="mb-1 text-[11px] font-bold text-rep-ink-label">{col.total ? fmtNum(col.total) : ''}</span>
            <span className="flex w-full max-w-[44px] flex-col-reverse gap-[2px]" style={{ height: `${(col.total / max) * 100}%` }}>
              {col.partes
                .filter((p) => p.n > 0)
                .map((p, j, arr) => (
                  <span key={p.code} className={j === arr.length - 1 ? 'rounded-t' : ''} style={{ background: p.color, flexGrow: p.n, flexBasis: 0, minHeight: 2 }} />
                ))}
            </span>
          </button>
        ))}
      </div>
      <EjeMeses meses={meses} hoy={hoy} />
      <NotaEnCurso meses={meses} hoy={hoy} />
      <div className="sr-only">
        <table>
          <caption>Reportes por mes y categoría</caption>
          <thead>
            <tr>
              <th scope="col">Mes</th>
              {cats.map((c) => (
                <th key={c.code} scope="col">
                  {c.nombre}
                </th>
              ))}
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {columnas.map((col) => (
              <tr key={col.mes}>
                <th scope="row">{mesLargo(col.mes)}</th>
                {col.partes.map((p) => (
                  <td key={p.code}>{fmtNum(p.n)}</td>
                ))}
                <td>{fmtNum(col.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/**
 * Qué se reporta: barras horizontales por categoría (reemplaza a la dona: «para el ciudadano es más fácil»).
 * Cada barra es un botón: tocarla filtra la pantalla; tocarla de nuevo saca el filtro.
 *
 * @param {Array<{ categoria: string, reportes: number }>} filas una por categoría
 */
export const BarrasCategorias = ({ filas, seleccion = null, onSeleccion }) => {
  const total = filas.reduce((s, f) => s + f.reportes, 0);
  const max = Math.max(1, ...filas.map((f) => f.reportes));
  return (
    <div className="flex flex-col gap-1.5">
      {CATEGORIAS.map((c) => {
        const n = filas.find((f) => f.categoria === c.code)?.reportes ?? 0;
        const on = seleccion === c.code;
        return (
          <button
            key={c.code}
            type="button"
            aria-pressed={on}
            aria-label={`${c.nombre}: ${fmtNum(n)} reportes`}
            onClick={() => onSeleccion?.(on ? null : c.code)}
            className={`rep-focus flex flex-col gap-1 rounded-xl px-2.5 py-2 text-left transition-colors ${on ? 'bg-rep-accent-soft' : 'hover:bg-rep-surface-sunken'} ${
              seleccion && !on ? 'opacity-60' : ''
            }`}
          >
            <span className="flex items-baseline justify-between gap-2 text-[12.5px]">
              <span className="font-bold text-rep-ink">{c.nombre}</span>
              <span className="tabular-nums text-rep-ink-label">
                <b className="font-bold">{fmtNum(n)}</b> <span className="text-rep-ink-faint">· {fmtPct(total ? Math.round((100 * n) / total) : 0)}</span>
              </span>
            </span>
            <span className="block h-2.5 w-full rounded-full bg-rep-divider">
              <span className="block h-full rounded-full" style={{ width: `${(n / max) * 100}%`, minWidth: n ? 4 : 0, background: c.color }} />
            </span>
          </button>
        );
      })}
      <p className="m-0 mt-1 text-[11.5px] text-rep-ink-faint">{fmtNum(total)} reportes en total · tocá una categoría para filtrar</p>
    </div>
  );
};

/**
 * Mi zona vs. mi jurisdicción (mockup de Hernán): los porcentajes de la zona al lado de los de su comuna o partido.
 * Solo porcentajes (un solo eje): los días van en los indicadores, no se mezclan unidades en un gráfico.
 */
export const ZonaVsJurisdiccion = ({ zona, jurisdiccion, filas }) => (
  <div className="flex flex-col gap-3">
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] font-semibold text-rep-ink-muted">
      <span className="inline-flex items-center gap-1.5">
        <i aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-rep-accent" />
        <b className="font-bold text-rep-ink-label">{zona}</b>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <i aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-rep-ink-faint" />
        <b className="font-bold text-rep-ink-label">{jurisdiccion}</b>
      </span>
    </div>
    {filas.map((f) => (
      <div key={f.indicador} className="flex flex-col gap-1">
        <span className="text-[12px] font-bold text-rep-ink">{f.indicador}</span>
        {[
          { nombre: zona, v: f.zona, color: 'bg-rep-accent' },
          { nombre: jurisdiccion, v: f.jurisdiccion, color: 'bg-rep-ink-faint' },
        ].map((s) => (
          <div key={s.nombre} className="flex items-center gap-2">
            <span className="block h-2.5 flex-1 rounded-full bg-rep-divider">
              {s.v !== null && <span className={`block h-full rounded-full ${s.color}`} style={{ width: `${Math.min(100, s.v)}%`, minWidth: s.v > 0 ? 4 : 0 }} />}
            </span>
            <span className="w-[64px] shrink-0 text-right text-[11.5px] font-semibold tabular-nums text-rep-ink-label">
              {s.v === null ? 'pocos casos' : fmtPct(s.v)}
            </span>
          </div>
        ))}
      </div>
    ))}
    <div className="sr-only">
      <table>
        <caption>{`${zona} comparado con ${jurisdiccion}`}</caption>
        <thead>
          <tr>
            <th scope="col">Indicador</th>
            <th scope="col">{zona}</th>
            <th scope="col">{jurisdiccion}</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.indicador}>
              <th scope="row">{f.indicador}</th>
              <td>{fmtPct(f.zona)}</td>
              <td>{fmtPct(f.jurisdiccion)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

/** Leyenda de las zonas comparadas: color + nombre (la identidad nunca va solo en el color). */
export const LeyendaZonas = ({ series }) => (
  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] font-semibold text-rep-ink-muted">
    {series.map((s) => (
      <span key={s.id} className="inline-flex items-center gap-1.5">
        <i aria-hidden="true" className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
        <b className="font-bold text-rep-ink-label">{s.nombre}</b>
      </span>
    ))}
  </div>
);

/**
 * Comparar · Reportes por mes: por cada mes, una columna fina por zona (en el orden en que se eligieron).
 * @param {Array<{ id, nombre, color, porMes: Map<string, number> }>} series
 */
export const BarrasMesZonas = ({ meses, series, hoy = new Date() }) => {
  const [activo, setActivo] = useState(null);
  const max = Math.max(1, ...series.flatMap((s) => meses.map((m) => s.porMes.get(m) ?? 0)));
  return (
    <div className="flex flex-col gap-2">
      <LeyendaZonas series={series} />
      <Detalle>
        {activo !== null && (
          <>
            <b className="text-rep-ink">{mesLargo(meses[activo])}:</b> {series.map((s) => `${s.nombre} ${fmtNum(s.porMes.get(meses[activo]) ?? 0)}`).join(' · ')}
          </>
        )}
      </Detalle>
      <div className="flex h-[170px] items-end gap-2 border-b border-rep-divider desktop:h-[200px]" aria-hidden="true">
        {meses.map((m, i) => (
          <button
            key={m}
            type="button"
            tabIndex={-1}
            onMouseEnter={() => setActivo(i)}
            onMouseLeave={() => setActivo(null)}
            onClick={() => setActivo(activo === i ? null : i)}
            className={`flex h-full min-w-0 flex-1 items-end justify-center gap-[2px] rounded-t-md px-0.5 ${activo === i ? 'bg-rep-divider/70' : ''}`}
          >
            {series.map((s) => {
              const n = s.porMes.get(m) ?? 0;
              return <span key={s.id} className="w-full max-w-[14px] rounded-t" style={{ height: `${(n / max) * 100}%`, minHeight: n ? 3 : 0, background: s.color }} />;
            })}
          </button>
        ))}
      </div>
      <EjeMeses meses={meses} hoy={hoy} />
      <NotaEnCurso meses={meses} hoy={hoy} />
      <div className="sr-only">
        <table>
          <caption>Reportes por mes de cada zona</caption>
          <thead>
            <tr>
              <th scope="col">Mes</th>
              {series.map((s) => (
                <th key={s.id} scope="col">
                  {s.nombre}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {meses.map((m) => (
              <tr key={m}>
                <th scope="row">{mesLargo(m)}</th>
                {series.map((s) => (
                  <td key={s.id}>{fmtNum(s.porMes.get(m) ?? 0)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/**
 * Comparar · barras horizontales por categoría, una fila fina por zona, con el valor escrito al final.
 * Sirve para «Días hasta resolver» (con la marca del plazo) y para «Qué se reporta» en proporción.
 */
export const BarrasCategoriaZonas = ({ series, max, marcas = null, etiquetaMarca = 'plazo', caption }) => (
  <div className="flex flex-col gap-3">
    <LeyendaZonas series={series} />
    <div className="flex flex-col gap-3.5" aria-hidden="true">
      {CATEGORIAS.map((c) => {
        const marca = marcas?.[c.code] ?? null;
        return (
          <div key={c.code} className="flex flex-col gap-1">
            <span className="flex items-baseline justify-between text-[12px] font-bold text-rep-ink">
              {c.nombre}
              {marca !== null && (
                <span className="text-[11px] font-semibold text-rep-ink-faint">
                  {etiquetaMarca}: {fmtNum(marca)} días
                </span>
              )}
            </span>
            {series.map((s) => {
              const v = s.valores[c.code] ?? { valor: null, texto: '—' };
              return (
                <div key={s.id} className="flex items-center gap-2">
                  <div className="relative h-2.5 flex-1 rounded-full bg-rep-divider">
                    {v.valor !== null && (
                      <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(100, (v.valor / max) * 100)}%`, minWidth: v.valor > 0 ? 3 : 0, background: s.color }} />
                    )}
                    {marca !== null && <span className="absolute -inset-y-1 w-[2px] bg-rep-danger" style={{ left: `${Math.min(100, (marca / max) * 100)}%` }} />}
                  </div>
                  <span className="w-[86px] shrink-0 text-right text-[11.5px] font-semibold tabular-nums text-rep-ink-label">{v.texto}</span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
    <div className="sr-only">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Categoría</th>
            {series.map((s) => (
              <th key={s.id} scope="col">
                {s.nombre}
              </th>
            ))}
            {marcas && <th scope="col">Plazo</th>}
          </tr>
        </thead>
        <tbody>
          {CATEGORIAS.map((c) => (
            <tr key={c.code}>
              <th scope="row">{c.nombre}</th>
              {series.map((s) => (
                <td key={s.id}>{s.valores[c.code]?.texto ?? '—'}</td>
              ))}
              {marcas && <td>{marcas[c.code] !== undefined ? `${fmtNum(marcas[c.code])} días` : '—'}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);
