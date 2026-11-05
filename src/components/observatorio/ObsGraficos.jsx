import React, { useState } from 'react';
import { Clock } from 'lucide-react';
import { CATEGORIAS, fmtNum, fmtPct, mesCorto, mesLargo, mesTodaviaAbierto } from './obsFormat';

/**
 * OBS · F2 · Gráficos del observatorio, en HTML y SVG propios (sin librería).
 *
 * Reglas del skill de visualización que se aplican:
 * - Una sola serie no lleva leyenda (el título la nombra); varias, leyenda con números.
 * - Marcas finas con extremos redondeados de 4 px, 2 px de separación entre porciones.
 * - Cada marca tiene su detalle al pasar el mouse o con el teclado (foco), y hay una tabla para lectores de pantalla.
 * - El texto usa los tokens de tinta, nunca el color de la serie.
 */

/**
 * Reportes por mes: una columna por mes, con la parte resuelta marcada adentro.
 * Los meses que empezaron hace menos de 60 días llevan la franja «Todavía abiertos».
 *
 * @param {Array<{ mes: string, reportes: number, resueltos: number, pctResueltos: number|null }>} meses
 *   todos los meses del período (los que no tienen reportes vienen en 0)
 */
export const BarrasMes = ({ meses, hoy = new Date() }) => {
  const [activo, setActivo] = useState(null);
  const max = Math.max(1, ...meses.map((m) => m.reportes));
  const hayAbiertos = meses.some((m) => mesTodaviaAbierto(m.mes, hoy));
  const detalle = activo !== null ? meses[activo] : null;

  return (
    <div className="flex flex-col gap-2">
      {/* Leyenda: dos marcas dentro de la misma columna */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] font-semibold text-rep-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <i aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-rep-accent/35" />
          Reportes
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-rep-accent" />
          De esos, resueltos
        </span>
      </div>

      {/* Detalle del mes señalado (o una ayuda si no hay ninguno) */}
      <p aria-live="polite" className="m-0 min-h-[18px] text-[12px] text-rep-ink-label">
        {detalle ? (
          <>
            <b className="text-rep-ink">{mesLargo(detalle.mes)}:</b> {fmtNum(detalle.reportes)} reportes · {fmtNum(detalle.resueltos)} resueltos
            {detalle.pctResueltos !== null && ` (${fmtPct(detalle.pctResueltos)})`}
          </>
        ) : (
          <span className="text-rep-ink-faint">Pasá el mouse o tocá un mes para ver el detalle.</span>
        )}
      </p>

      <div className="relative flex h-[160px] items-end gap-2 border-b border-rep-divider desktop:h-[190px]" aria-hidden="true">
        {meses.map((m, i) => {
          const abierto = mesTodaviaAbierto(m.mes, hoy);
          const alto = (m.reportes / max) * 100;
          const altoRes = m.reportes ? (m.resueltos / m.reportes) * 100 : 0;
          return (
            <button
              key={m.mes}
              type="button"
              tabIndex={-1}
              onMouseEnter={() => setActivo(i)}
              onMouseLeave={() => setActivo(null)}
              onClick={() => setActivo(activo === i ? null : i)}
              className={`relative flex h-full min-w-0 flex-1 flex-col items-center justify-end rounded-t-md ${activo === i ? 'bg-rep-divider/70' : ''}`}
              // «Todavía abiertos»: rayado tenue a 45° (textura, no un fondo liso que en oscuro se confunde con la columna)
              style={
                abierto && activo !== i
                  ? { backgroundImage: 'repeating-linear-gradient(135deg, rgb(var(--rep-warning) / 0.16) 0 2px, transparent 2px 7px)' }
                  : undefined
              }
            >
              {/* Valor arriba de la columna: solo el número, en tinta */}
              <span className="mb-1 text-[11px] font-bold text-rep-ink-label">{m.reportes ? fmtNum(m.reportes) : ''}</span>
              <span
                className="flex w-full max-w-[44px] flex-col justify-end overflow-hidden rounded-t bg-rep-accent/35"
                style={{ height: `${alto}%`, minHeight: m.reportes ? 3 : 0 }}
              >
                <span className="w-full bg-rep-accent" style={{ height: `${altoRes}%`, minHeight: m.resueltos ? 2 : 0 }} />
              </span>
            </button>
          );
        })}
      </div>

      {/* Eje de meses */}
      <div className="flex gap-2" aria-hidden="true">
        {meses.map((m) => (
          <span key={m.mes} className="min-w-0 flex-1 text-center text-[11px] font-semibold text-rep-ink-faint">
            {mesCorto(m.mes)}
          </span>
        ))}
      </div>

      {/* Lo mismo, como tabla, para lectores de pantalla y para usar el teclado.
          Va dentro de un div oculto: una <table> no respeta el ancho de 1 px de sr-only y estiraba la página. */}
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
                {mesTodaviaAbierto(m.mes, hoy) ? ' (todavía abierto)' : ''}
              </th>
              <td>{fmtNum(m.reportes)}</td>
              <td>{fmtNum(m.resueltos)}</td>
              <td>{fmtPct(m.pctResueltos)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {hayAbiertos && (
        <p className="m-0 flex items-start gap-1.5 text-[11.5px] leading-snug text-rep-ink-muted">
          <Clock aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rep-warning" strokeWidth={2.25} />
          <span>
            <b className="font-bold text-rep-ink-label">Todavía abiertos</b> (fondo rayado): esos meses parecen peores porque sus reportes todavía no
            tuvieron tiempo de resolverse.
          </span>
        </p>
      )}
    </div>
  );
};

/**
 * Reportes por mes y categoría (POC D57 «Reportes por mes y categoría»): columnas apiladas en el orden fijo de las
 * categorías, con 2 px de separación entre segmentos. Con un filtro de categoría queda solo esa.
 *
 * @param {string[]} meses todos los meses del período ('YYYY-MM-01')
 * @param {Array<{ mes: string, categoria: string|null, reportes: number }>} filas las de obs_por_mes
 * @param {string|null} categoria filtro activo
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
      {/* Leyenda con el total del período de cada categoría: la identidad nunca queda solo en el color */}
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

      <p aria-live="polite" className="m-0 min-h-[18px] text-[12px] text-rep-ink-label">
        {detalle ? (
          <>
            <b className="text-rep-ink">{mesLargo(detalle.mes)}:</b> {fmtNum(detalle.total)} reportes
            {cats.length > 1 && ` · ${detalle.partes.filter((p) => p.n).map((p) => `${p.nombre} ${fmtNum(p.n)}`).join(' · ')}`}
          </>
        ) : (
          <span className="text-rep-ink-faint">Pasá el mouse o tocá un mes para ver el detalle.</span>
        )}
      </p>

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
            style={
              mesTodaviaAbierto(col.mes, hoy) && activo !== i
                ? { backgroundImage: 'repeating-linear-gradient(135deg, rgb(var(--rep-warning) / 0.16) 0 2px, transparent 2px 7px)' }
                : undefined
            }
          >
            <span className="mb-1 text-[11px] font-bold text-rep-ink-label">{col.total ? fmtNum(col.total) : ''}</span>
            {/* Segmentos de abajo hacia arriba en el orden fijo, con 2 px de superficie entre ellos */}
            <span className="flex w-full max-w-[44px] flex-col-reverse gap-[2px]" style={{ height: `${(col.total / max) * 100}%` }}>
              {col.partes
                .filter((p) => p.n > 0)
                .map((p, j, arr) => (
                  <span
                    key={p.code}
                    className={j === arr.length - 1 ? 'rounded-t' : ''}
                    style={{ background: p.color, flexGrow: p.n, flexBasis: 0, minHeight: 2 }}
                  />
                ))}
            </span>
          </button>
        ))}
      </div>

      <div className="flex gap-2" aria-hidden="true">
        {columnas.map((col) => (
          <span key={col.mes} className="min-w-0 flex-1 text-center text-[11px] font-semibold text-rep-ink-faint">
            {mesCorto(col.mes)}
          </span>
        ))}
      </div>

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
 * Qué se reporta: dona por categoría con leyenda tocable. Tocar una categoría filtra la pantalla; tocarla de nuevo,
 * o «Todas», saca el filtro.
 *
 * @param {Array<{ categoria: string, reportes: number }>} filas una por categoría
 * @param {string|null} seleccion categoría del filtro activo
 * @param {Function} onSeleccion recibe el código, o null para sacar el filtro
 */
export const DonaCategorias = ({ filas, seleccion = null, onSeleccion }) => {
  const total = filas.reduce((s, f) => s + f.reportes, 0);
  const R = 52;
  const C = 2 * Math.PI * R;
  const GAP = total > 0 && filas.filter((f) => f.reportes > 0).length > 1 ? 2 : 0; // 2 px de superficie entre porciones
  let acumulado = 0;

  const porciones = CATEGORIAS.map((cat) => {
    const f = filas.find((x) => x.categoria === cat.code) ?? { reportes: 0 };
    const largo = total ? (f.reportes / total) * C : 0;
    const p = { ...cat, reportes: f.reportes, pct: total ? (100 * f.reportes) / total : 0, desde: acumulado, largo };
    acumulado += largo;
    return p;
  });

  return (
    <div className="flex flex-col items-center gap-4 tablet:flex-row tablet:items-center desktop:gap-6">
      <svg viewBox="0 0 140 140" className="h-[150px] w-[150px] shrink-0" role="img" aria-label={`Reportes por categoría: ${porciones.map((p) => `${p.nombre} ${p.reportes}`).join(', ')}`}>
        <circle cx="70" cy="70" r={R} fill="none" stroke="rgb(var(--rep-divider))" strokeWidth="16" />
        {/* Las porciones arrancan arriba (las 12) y van en el sentido de las agujas del reloj */}
        <g transform="rotate(-90 70 70)">
        {porciones
          .filter((p) => p.largo > 0)
          .map((p) => (
            <circle
              key={p.code}
              cx="70"
              cy="70"
              r={R}
              fill="none"
              stroke={p.color}
              strokeWidth={seleccion === p.code ? 20 : 16}
              strokeDasharray={`${Math.max(0, p.largo - GAP)} ${C}`}
              strokeDashoffset={-p.desde}
              opacity={seleccion && seleccion !== p.code ? 0.3 : 1}
            >
              <title>{`${p.nombre}: ${fmtNum(p.reportes)} (${fmtPct(p.pct)})`}</title>
            </circle>
          ))}
        </g>
        <text x="70" y="70" textAnchor="middle" className="fill-rep-ink text-[22px] font-extrabold">
          {fmtNum(total)}
        </text>
        <text x="70" y="88" textAnchor="middle" className="fill-rep-ink-faint text-[10px] font-semibold">
          reportes
        </text>
      </svg>

      <ul className="m-0 flex w-full list-none flex-col gap-1 p-0">
        {porciones.map((p) => {
          const on = seleccion === p.code;
          return (
            <li key={p.code}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onSeleccion?.(on ? null : p.code)}
                className={`rep-focus flex min-h-[38px] w-full items-center gap-2.5 rounded-xl px-2.5 text-left transition-colors ${
                  on ? 'bg-rep-accent-soft' : 'hover:bg-rep-surface-sunken'
                } ${seleccion && !on ? 'opacity-60' : ''}`}
              >
                <i aria-hidden="true" className="h-3 w-3 shrink-0 rounded-sm" style={{ background: p.color }} />
                <span className="flex-1 text-[12.5px] font-bold text-rep-ink">{p.nombre}</span>
                <span className="text-[12.5px] font-semibold tabular-nums text-rep-ink-label">{fmtNum(p.reportes)}</span>
                <span className="w-[52px] text-right text-[12px] tabular-nums text-rep-ink-faint">{fmtPct(Math.round(p.pct))}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
