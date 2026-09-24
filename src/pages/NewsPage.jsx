import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Megaphone } from 'lucide-react';
import { AppLayout } from '../components/layout/AppLayout';
import { NewsCard } from '../components/news/NewsCard';
import { EmptyState } from '../components/common/EmptyState';
import { getPublishedNews } from '../services/newsService';

const FILTERS = [
  { key: 'todas', label: 'Todas' },
  { key: 'municipio', label: 'Municipio' },
  { key: 'app', label: 'App' },
  { key: 'cerca', label: 'Cerca mío' },
];

/**
 * Novedades del municipio y de la app (UJ v3.3 · M24 teléfono / D31 escritorio — REP-3791 Bloque 8).
 * Una destacada arriba y el resto compactas debajo, con filtros por origen.
 */
export const NewsPage = () => {
  const navigate = useNavigate();
  const [newsItems, setNewsItems] = useState([]);
  const [activeFilter, setActiveFilter] = useState('todas');

  useEffect(() => {
    let isMounted = true;
    getPublishedNews()
      .then((result) => {
        if (isMounted) setNewsItems(result.news || []);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const currentNews = newsItems;

  const filteredNews = useMemo(
    () =>
      currentNews.filter((item) => {
        if (activeFilter === 'todas') return true;
        if (activeFilter === 'cerca') return Boolean(item.hasLocation);
        return item.source === activeFilter;
      }),
    [currentNews, activeFilter]
  );

  const [featured, ...rest] = filteredNews;
  const openItem = (item) => navigate(`/novedades/${item.id}`);

  return (
    <AppLayout activeTab="novedades">
      <div className="flex-1 overflow-y-auto bg-rep-bg px-4 pb-28 pt-5 sm:px-6 md:px-10 md:pb-10">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          <div>
            <h1 className="m-0 text-rep-title text-rep-ink md:text-rep-title-d">Novedades</h1>
            <p className="m-0 mt-1 text-rep-label text-rep-ink-muted md:text-rep-label-d">
              Avisos oficiales de tu municipio y cambios de la app.
            </p>
          </div>

          {/* Filtros por origen (M24). «Cerca mío» muestra las que tienen ubicación */}
          <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1">
            {FILTERS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => setActiveFilter(filter.key)}
                aria-pressed={activeFilter === filter.key}
                className={`rep-focus min-h-touch shrink-0 rounded-xl border px-3.5 text-rep-label font-bold transition-colors duration-120 ${
                  activeFilter === filter.key
                    ? 'border-rep-accent bg-rep-accent text-rep-on-accent'
                    : 'border-rep-border bg-rep-surface text-rep-ink-label'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {filteredNews.length > 0 ? (
            <div className="flex flex-col gap-3">
              <NewsCard item={featured} variant="featured" onOpen={openItem} />
              {rest.map((item) => (
                <NewsCard key={item.id} item={item} onOpen={openItem} />
              ))}
            </div>
          ) : (
            /* Estado vacío (UJ v3.3 · M27 / D35): tono de espera, salida secundaria al mapa */
            <EmptyState
              icon={Megaphone}
              title="Todavía no hay publicaciones"
              description="Cuando el municipio publique un aviso de obra u operativo, o salga una versión nueva de la app, lo vas a leer acá."
              secondaryAction={{ label: 'Ver el mapa', onClick: () => navigate('/mapa') }}
            />
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default NewsPage;
