import React from 'react';
import { ChevronRight, Globe, Lock, Lightbulb, Shapes, X } from 'lucide-react';
import { CATEGORIAS, PERIODOS, nombreCategoria } from './obsFormat';

/**
 * OBS · F1 · Piezas de interfaz del observatorio (POC v5 de Iván, en Tailwind y con los tokens rep-*).
 *
 * Mobile y escritorio son el mismo componente: cambian la grilla y los tamaños con `desktop:`.
 */

/** Sello de visibilidad: «Público» (lo ve cualquier vecino con sesión) o «Solo organismo». */
export const Sello = ({ tipo = 'publico' }) =>
  tipo === 'organismo' ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#F1EDFC] px-2 py-0.5 text-[10.5px] font-bold text-[#6B4FC4] dark:bg-[#2A2540] dark:text-[#AC90F2]">
      <Lock aria-hidden="true" className="h-3 w-3" strokeWidth={2.5} />
      Solo organismo
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#E3F5EC] px-2 py-0.5 text-[10.5px] font-bold text-[#2C7A55] dark:bg-[#173325] dark:text-[#4DCB90]">
      <Globe aria-hidden="true" className="h-3 w-3" strokeWidth={2.5} />
      Público
    </span>
  );

/**
 * Tarjeta del observatorio: título, subtítulo corto, sello opcional y pie con una aclaración.
 */
export const ObsCard = ({ titulo, sub, sello, pie, children, className = '', ...rest }) => (
  <section
    className={`flex min-w-0 flex-col gap-3 rounded-2xl border border-rep-border bg-rep-surface p-4 shadow-rep-card desktop:p-5 ${className}`}
    {...rest}
  >
    {titulo && (
      <h3 className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-rep-label font-extrabold text-rep-ink desktop:text-rep-label-d desktop:font-extrabold">
        <span>{titulo}</span>
        {sub && <small className="text-rep-label font-semibold text-rep-ink-faint">· {sub}</small>}
        {sello && <span className="ml-auto">{sello}</span>}
      </h3>
    )}
    {children}
    {pie && (
      <p className="m-0 flex items-start gap-1.5 border-t border-rep-divider pt-2.5 text-[12px] leading-snug text-rep-ink-muted">
        {pie}
      </p>
    )}
  </section>
);

/**
 * Indicador: el valor grande, qué es, y una nota debajo (comparación o aclaración).
 * `destacado` lo pinta en verde (es el que responde «¿me lo arreglan?»).
 */
export const Kpi = ({ valor, etiqueta, nota, sello, destacado = false, testId }) => (
  <div data-testid={testId} className="flex min-w-0 flex-col gap-0.5 rounded-2xl border border-rep-border bg-rep-surface p-3.5 shadow-rep-card desktop:p-4">
    {sello && <span className="mb-1">{sello}</span>}
    <b className={`text-[24px] font-extrabold leading-tight tracking-tight desktop:text-[28px] ${destacado ? 'text-rep-success' : 'text-rep-ink'}`}>
      {valor}
    </b>
    <span className="text-[12px] font-semibold leading-snug text-rep-ink-label">{etiqueta}</span>
    {nota && <em className="text-[11.5px] not-italic leading-snug text-rep-ink-faint">{nota}</em>}
  </div>
);

/** Grilla de indicadores: de a dos en el teléfono; en escritorio, las columnas que se pidan. */
export const Kpis = ({ children, columnas = 4 }) => (
  <div className={`grid grid-cols-2 gap-2.5 desktop:gap-3 ${columnas === 3 ? 'desktop:grid-cols-3' : columnas === 6 ? 'desktop:grid-cols-6' : 'desktop:grid-cols-4'}`}>
    {children}
  </div>
);

/** Franja de aviso dentro de la pantalla (no es un error: explica algo). */
export const Aviso = ({ icono: Icono = Lightbulb, children, accion = null }) => (
  <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-rep-accent-border bg-rep-accent-soft px-3.5 py-2.5 text-[12.5px] leading-snug text-rep-ink-body">
    <Icono aria-hidden="true" className="h-4 w-4 shrink-0 text-rep-accent" strokeWidth={2.25} />
    <span className="min-w-0 flex-1">{children}</span>
    {accion}
  </div>
);

/** Encabezado de sección: título, sellos y bajada, con el selector de período a la derecha en escritorio. */
export const Encabezado = ({ titulo, sellos = null, bajada, derecha = null }) => (
  <div className="flex flex-col gap-3 desktop:flex-row desktop:items-end desktop:justify-between">
    <div className="min-w-0">
      <h2 className="m-0 flex flex-wrap items-center gap-2 text-rep-section text-rep-ink desktop:text-rep-section-d">
        {titulo} {sellos}
      </h2>
      {bajada && <p className="m-0 mt-1 text-rep-body text-rep-ink-muted desktop:text-rep-body-d">{bajada}</p>}
    </div>
    {derecha}
  </div>
);

/** Selector segmentado de período (Mes · Trimestre · 6 meses). */
export const SelectorPeriodo = ({ valor, onChange }) => (
  <div role="group" aria-label="Período" className="inline-flex shrink-0 self-start rounded-xl border border-rep-border bg-rep-surface p-0.5">
    {PERIODOS.map((p) => (
      <button
        key={p.key}
        type="button"
        aria-pressed={valor === p.key}
        onClick={() => onChange(p.key)}
        className={`rep-focus min-h-[36px] rounded-[10px] px-3 text-rep-label font-bold transition-colors duration-120 ${
          valor === p.key ? 'bg-rep-accent text-rep-on-accent' : 'text-rep-ink-muted hover:text-rep-ink-label'
        }`}
      >
        {p.label}
      </button>
    ))}
  </div>
);

/** Filtro de categoría. Vacío = todas. */
export const SelectorCategoria = ({ valor, onChange }) => (
  <label
    className={`flex min-h-touch items-center gap-2 rounded-xl border px-3 text-rep-label font-bold ${
      valor ? 'border-rep-accent-border bg-rep-accent-soft text-rep-accent' : 'border-rep-border bg-rep-surface text-rep-ink-label'
    }`}
  >
    <Shapes aria-hidden="true" className="h-4 w-4" strokeWidth={2.25} />
    <select
      aria-label="Categoría"
      value={valor ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      className="rep-focus min-w-0 flex-1 cursor-pointer border-0 bg-transparent font-bold text-inherit outline-none"
    >
      <option value="">Todas las categorías</option>
      {CATEGORIAS.map((c) => (
        <option key={c.code} value={c.code}>
          {c.nombre}
        </option>
      ))}
    </select>
  </label>
);

/** Chips de los filtros activos, cada uno con su «quitar», y «Limpiar todo» si hay más de uno. */
export const ChipsFiltros = ({ categoria, onQuitarCategoria }) => {
  if (!categoria) return null;
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Filtros activos">
      <button
        type="button"
        onClick={onQuitarCategoria}
        className="rep-focus inline-flex min-h-[32px] items-center gap-1.5 rounded-full border border-rep-accent-border bg-rep-accent-soft px-3 text-[12px] font-bold text-rep-accent"
      >
        {nombreCategoria(categoria)}
        <X aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.5} />
        <span className="sr-only">Quitar filtro</span>
      </button>
    </div>
  );
};

/**
 * Migas del territorio. Cada paso que no es el último se puede tocar para subir.
 * @param {Array<{ nombre: string, onClick?: Function }>} pasos
 */
export const Migas = ({ pasos }) => (
  <nav aria-label="Ubicación" className="flex flex-wrap items-center gap-1 text-[12.5px] text-rep-ink-muted">
    {pasos.map((p, i) => {
      const ultimo = i === pasos.length - 1;
      return (
        <React.Fragment key={`${p.nombre}-${i}`}>
          {i > 0 && <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 text-rep-ink-faint" strokeWidth={2.25} />}
          {ultimo || !p.onClick ? (
            <span aria-current={ultimo ? 'location' : undefined} className={ultimo ? 'font-bold text-rep-ink' : ''}>
              {p.nombre}
            </span>
          ) : (
            <button type="button" onClick={p.onClick} className="rep-focus rounded font-semibold text-rep-accent hover:underline">
              {p.nombre}
            </button>
          )}
        </React.Fragment>
      );
    })}
  </nav>
);

/** Lista de lectura con lamparita (por ejemplo, «Cómo leer estos datos»). */
export const ListaLectura = ({ items }) => (
  <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
    {items.map((t) => (
      <li key={t} className="flex items-start gap-2 text-[12.5px] leading-snug text-rep-ink-body desktop:text-[13px]">
        <Lightbulb aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-rep-warning" strokeWidth={2.25} />
        <span>{t}</span>
      </li>
    ))}
  </ul>
);

/**
 * Tabla. Con hasta tres columnas se acomoda al ancho del teléfono; con más, se desplaza de costado (POC M54).
 */
export const Tabla = ({ columnas, filas, caption }) => (
  <div className="-mx-1 overflow-x-auto px-1">
    <table className={`w-full border-collapse text-left text-[12.5px] desktop:text-[13px] ${columnas.length > 3 ? 'min-w-[420px]' : ''}`}>
      {caption && <caption className="sr-only">{caption}</caption>}
      <thead>
        <tr>
          {columnas.map((c) => (
            <th key={c} scope="col" className="border-b border-rep-divider px-2 py-2 text-[11px] font-bold uppercase tracking-wide text-rep-ink-faint">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {filas.map((fila, i) => (
          <tr key={i} className="border-b border-rep-divider last:border-0">
            {fila.map((celda, j) => (
              <td key={j} className={`px-2 py-2 align-top text-rep-ink-body ${j === 0 ? 'font-bold text-rep-ink' : ''}`}>
                {celda}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
