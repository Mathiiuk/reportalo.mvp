import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Megaphone } from 'lucide-react';
import { AppLayout } from '../components/layout/AppLayout';
import { NewsCard } from '../components/news/NewsCard';
import { DEMO_NEWS, getPublishedNews } from '../services/newsService';

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
  const [isDemoActive, setIsDemoActive] = useState(false);
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

  const currentNews = isDemoActive ? DEMO_NEWS : newsItems;

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
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="m-0 text-rep-title text-rep-ink md:text-rep-title-d">Novedades</h1>
              <p className="m-0 mt-1 text-rep-label text-rep-ink-muted md:text-rep-label-d">
                Avisos oficiales de tu municipio y cambios de la app.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsDemoActive((prev) => !prev)}
              className="rep-focus min-h-touch shrink-0 rounded-lg border-0 bg-rep-accent-soft px-3.5 text-rep-label font-bold text-rep-accent transition-[filter] duration-120 hover:brightness-[.96] dark:hover:brightness-[1.06]"
            >
              {isDemoActive ? 'Limpiar demo' : 'Cargar demo'}
            </button>
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
            <div className="mx-auto mt-6 flex max-w-xl flex-col items-center justify-center rounded-[24px] border border-rep-border bg-rep-surface p-8 text-center shadow-rep-card md:mt-12 md:p-12">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rep-accent-soft text-rep-accent">
                <Megaphone aria-hidden="true" className="h-7 w-7" strokeWidth={2} />
              </span>
              {/* Va como párrafo y no como encabezado: el título de la pantalla ya es «Novedades» */}
              <p className="m-0 mt-4 text-rep-section text-rep-ink">Sin novedades por ahora</p>
              <p className="m-0 mt-2 text-rep-body text-rep-ink-muted">
                Cuando el municipio publique avisos o haya cambios en la app, los vas a ver acá.
              </p>
              <Link
                to="/mapa"
                className="rep-focus mt-4 inline-flex min-h-touch items-center rounded-xl bg-rep-accent px-4 text-rep-label font-extrabold text-rep-on-accent no-underline transition-colors duration-120 hover:bg-rep-accent-strong"
              >
                Explorar el mapa
              </Link>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default NewsPage;
