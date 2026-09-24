import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Share2, Map as MapIcon, ChevronRight, Megaphone, Sparkles } from 'lucide-react';
import { AppLayout } from '../components/layout/AppLayout';
import { getNewsItem, NEWS_SOURCES } from '../services/newsService';

const formatFullDate = (isoDate) => {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
};

/**
 * Nota completa de una novedad (UJ v3.3 · M25 teléfono / D32 escritorio — REP-3791 Bloque 8).
 * Muestra quién publica y, si la novedad tiene ubicación, ofrece verla en el mapa.
 */
export const NewsDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, item: null });

  useEffect(() => {
    let isMounted = true;
    getNewsItem(id).then((result) => {
      if (isMounted) setState({ loading: false, item: result.item });
    });
    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: state.item?.title || 'Novedad de Reportalo', url: window.location.href });
        return;
      }
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Link de la novedad copiado');
    } catch (err) {
      if (err?.name !== 'AbortError') toast.error('No se pudo compartir la novedad');
    }
  };

  const { item } = state;
  const isApp = item?.source === 'app';
  const Icon = isApp ? Sparkles : Megaphone;

  return (
    <AppLayout activeTab="novedades">
      <div className="flex-1 overflow-y-auto bg-rep-bg pb-28 md:pb-10">
        <div className="mx-auto w-full max-w-2xl px-4 pt-3 md:px-10 md:pt-8">
          <header className="flex items-center justify-between gap-2 pb-2">
            <button
              type="button"
              onClick={() => navigate('/alertas')}
              aria-label="Volver a Novedades"
              className="rep-focus -ml-2 flex min-h-touch min-w-touch items-center justify-center rounded-full text-rep-ink-label hover:bg-rep-divider"
            >
              <ArrowLeft aria-hidden="true" className="h-6 w-6" strokeWidth={2.25} />
            </button>
            <button
              type="button"
              onClick={handleShare}
              aria-label="Compartir la novedad"
              className="rep-focus flex min-h-touch min-w-touch items-center justify-center rounded-full text-rep-ink-label hover:bg-rep-divider"
            >
              <Share2 aria-hidden="true" className="h-5 w-5" strokeWidth={2.25} />
            </button>
          </header>

          {state.loading ? (
            <div aria-busy="true" className="flex flex-col gap-3 motion-safe:animate-pulse">
              <div className="h-40 rounded-2xl bg-rep-track" />
              <div className="h-6 w-2/3 rounded-lg bg-rep-track" />
              <div className="h-24 rounded-2xl bg-rep-track" />
            </div>
          ) : !item ? (
            <div className="mt-10 flex flex-col items-center gap-3 text-center">
              <p className="m-0 text-rep-section text-rep-ink">Esta novedad ya no está disponible</p>
              <button
                type="button"
                onClick={() => navigate('/alertas')}
                className="rep-focus min-h-touch rounded-xl px-4 text-rep-body font-bold text-rep-accent"
              >
                Volver a Novedades
              </button>
            </div>
          ) : (
            <article data-testid="news-detail" className="flex flex-col gap-3">
              <span aria-hidden="true" className="flex h-40 w-full items-center justify-center rounded-2xl bg-rep-accent-soft text-rep-accent md:h-56">
                <Icon className="h-10 w-10" strokeWidth={1.75} />
              </span>

              <span className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-lg px-2 py-0.5 text-rep-pill uppercase tracking-wide ${
                    isApp ? 'bg-rep-notice-soft text-rep-notice' : 'bg-rep-accent-soft text-rep-accent'
                  }`}
                >
                  {NEWS_SOURCES[item.source]?.tag ?? 'Municipio'}
                </span>
                <span className="text-rep-label text-rep-ink-muted md:text-rep-label-d">
                  {formatFullDate(item.publishedAt)} · {item.author}
                </span>
              </span>

              <h1 className="m-0 text-rep-title text-rep-ink md:text-rep-title-d">{item.title}</h1>

              <div className="flex flex-col gap-3">
                {item.body?.map((paragraph) => (
                  <p key={paragraph.slice(0, 24)} className="m-0 text-rep-body text-rep-ink-body md:text-rep-body-d">
                    {paragraph}
                  </p>
                ))}
              </div>

              {item.hasLocation && (
                <button
                  type="button"
                  onClick={() => navigate('/mapa')}
                  className="rep-focus mt-2 flex min-h-touch w-full items-center gap-2.5 rounded-2xl border border-rep-border bg-rep-surface p-4 text-left shadow-rep-card transition-[filter] duration-120 hover:brightness-[.98] dark:hover:brightness-[1.04]"
                >
                  <MapIcon aria-hidden="true" className="h-5 w-5 shrink-0 text-rep-accent" strokeWidth={2.25} />
                  <span className="flex-1 text-rep-body font-bold text-rep-ink md:text-rep-body-d">
                    Ver el tramo afectado en el mapa
                  </span>
                  <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-rep-ink-faint" />
                </button>
              )}
            </article>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default NewsDetailPage;
