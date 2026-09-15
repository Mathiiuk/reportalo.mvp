import React, { useEffect, useMemo, useRef, useState } from 'react';
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await getSelectableLocalities();
      if (cancelled) return;
      if (!result.success) {
        setError(result.error ?? 'No se pudieron cargar las localidades.');
      } else {
        setLocalities(result.localities);
      }
      setLoading(false);
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
      <label className="block font-bold text-[12px] text-[#263249] mb-1.5">
        ¿En qué localidad ocurrió el problema?
      </label>

      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        data-testid="locality-selector-trigger"
        disabled={loading || Boolean(error)}
        className="w-full flex items-center gap-2 bg-white border border-[#DDE3EA] rounded-[13px] py-3 px-3.5 text-left cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed hover:border-[#1E6FCB] transition-colors"
      >
        <MapPinned className="w-[18px] h-[18px] text-[#1E6FCB] flex-shrink-0" strokeWidth={2.25} />
        <span
          className={`flex-1 text-[13px] font-semibold truncate ${
            selected ? 'text-[#263249]' : 'text-[#8593A2]'
          }`}
        >
          {loading
            ? 'Cargando localidades…'
            : error
            ? 'No se pudieron cargar las localidades'
            : selected
            ? selected.label
            : 'Seleccioná la localidad'}
        </span>
        <ChevronDown className="w-[16px] h-[16px] text-[#8593A2] flex-shrink-0" strokeWidth={2.25} />
      </button>

      {error && (
        <p className="mt-1 text-[11px] font-medium text-[#D64545]" role="alert">
          {error}
        </p>
      )}

      {isOpen && !loading && !error && (
        <div className="absolute z-30 mt-1.5 w-full bg-white border border-[#DDE3EA] rounded-[13px] shadow-[0_10px_24px_rgba(20,40,80,0.16)] overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-[#EEF1F5]">
            <Search className="w-[15px] h-[15px] text-[#8593A2] flex-shrink-0" strokeWidth={2.25} />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar localidad…"
              aria-label="Buscar localidad"
              data-testid="locality-selector-search"
              className="flex-1 text-[13px] font-medium text-[#263249] outline-none border-0 bg-transparent placeholder:text-[#B3BDC9]"
            />
          </div>
          <ul role="listbox" className="max-h-56 overflow-y-auto">
            {filteredLocalities.length === 0 && (
              <li className="px-3.5 py-3 text-[12px] font-medium text-[#8593A2]">
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
                  className={`w-full text-left px-3.5 py-2.5 text-[13px] font-medium cursor-pointer hover:bg-[#F3F6FA] transition-colors ${
                    locality.id === value ? 'text-[#1E6FCB] bg-[#EAF2FC]' : 'text-[#263249]'
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
