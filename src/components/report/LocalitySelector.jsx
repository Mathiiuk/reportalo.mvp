import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { MapPinned, ChevronDown, Search } from 'lucide-react';
import { getSelectableLocalities, normalizeForSearch } from '../../services/localitiesService';

/**
 * Selector manual de localidad (REP-2500, Opción 1 aprobada por PO).
 * R-1: label "Localidad — Partido/Comuna, Provincia".
 * R-3: el label de la pregunta se refiere al lugar del problema, no al domicilio del ciudadano.
 * R-5: autocompletado insensible a tildes, ~56 opciones.
 */
export const LocalitySelector = ({ value, onChange }) => {
  const [localities, setLocalities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const labelId = useId();
  const valueId = useId();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await getSelectableLocalities();
        if (cancelled) return;
        if (!result.success) {
          setError(result.error ?? 'No se pudieron cargar las localidades.');
        } else {
          setLocalities(result.localities);
        }
      } catch (err) {
        if (!cancelled) setError('Error inesperado al cargar localidades.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selected = useMemo(
    () => localities.find((locality) => locality.id === value) ?? null,
    [localities, value]
  );

  const filteredLocalities = useMemo(() => {
    const normalizedQuery = normalizeForSearch(query);
    if (!normalizedQuery) return localities;
    return localities.filter((locality) => locality.searchKey.includes(normalizedQuery));
  }, [localities, query]);

  const handleSelect = (locality) => {
    onChange?.(locality.id, locality.label);
    setQuery('');
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <span id={labelId} className="mb-1.5 block text-rep-label font-bold text-rep-ink-label">
        ¿En qué localidad ocurrió el problema?
      </span>

      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-labelledby={`${labelId} ${valueId}`}
        data-testid="locality-selector-trigger"
        disabled={loading || Boolean(error)}
        className="rep-focus flex min-h-[48px] w-full items-center gap-2 rounded-2xl border border-rep-border bg-rep-surface px-3.5 text-left transition-colors duration-120 hover:border-rep-accent disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-rep-border"
      >
        <MapPinned className="h-[18px] w-[18px] shrink-0 text-rep-accent" strokeWidth={2.25} aria-hidden="true" />
        <span
          id={valueId}
          className={`flex-1 truncate text-rep-input font-semibold ${selected ? 'text-rep-ink' : 'text-rep-ink-muted'}`}
        >
          {loading
            ? 'Cargando localidades…'
            : error
            ? 'No se pudieron cargar las localidades'
            : selected
            ? selected.label
            : 'Seleccioná la localidad'}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-rep-ink-muted" strokeWidth={2.25} aria-hidden="true" />
      </button>

      {error && (
        <p className="m-0 mt-1 text-rep-label font-medium text-rep-danger" role="alert">
          {error}
        </p>
      )}

      {isOpen && !loading && !error && (
        // Se abre hacia arriba (bottom-full): este selector vive en el pie del modal de
        // ajuste de ubicación, con poco espacio debajo y el botón "Confirmar ubicación"
        // inmediatamente después — abrir hacia abajo lo tapaba y lo dejaba fuera de pantalla.
        <div className="absolute bottom-full z-30 mb-1.5 flex max-h-[min(55vh,20rem)] w-full flex-col overflow-hidden rounded-2xl border border-rep-border bg-rep-surface shadow-[0_-10px_24px_rgb(var(--rep-shadow)/0.16)]">
          <div className="flex shrink-0 items-center gap-2 border-b border-rep-divider px-3.5 py-2">
            <Search className="h-4 w-4 shrink-0 text-rep-ink-muted" strokeWidth={2.25} aria-hidden="true" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar localidad…"
              aria-label="Buscar localidad"
              data-testid="locality-selector-search"
              className="min-h-touch flex-1 select-text border-0 bg-transparent text-rep-input text-rep-ink outline-none placeholder:text-rep-ink-faint"
            />
          </div>
          <ul role="listbox" aria-labelledby={labelId} className="m-0 min-h-0 flex-1 list-none overflow-y-auto p-0">
            {filteredLocalities.length === 0 && (
              <li className="px-3.5 py-3 text-rep-label font-medium text-rep-ink-muted">
                Sin resultados para "{query}".
              </li>
            )}
            {filteredLocalities.map((locality) => (
              <li key={locality.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={locality.id === value}
                  onClick={() => handleSelect(locality)}
                  data-testid={`locality-option-${locality.id}`}
                  className={`min-h-touch w-full px-3.5 py-2.5 text-left text-[15px] font-medium outline-none transition-colors duration-120 hover:bg-rep-surface-sunken focus-visible:bg-rep-accent-soft ${
                    locality.id === value ? 'bg-rep-accent-soft text-rep-accent' : 'text-rep-ink'
                  }`}
                >
                  {locality.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default LocalitySelector;
