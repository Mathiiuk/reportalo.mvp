import React from 'react';
import { ChevronRight, Megaphone, Sparkles } from 'lucide-react';
import { NEWS_SOURCES, formatNewsDate } from '../../services/newsService';

/**
 * Tarjeta de novedad (componente nombrado en el §10 del UJ v3.3: «NewsCard»).
 * `variant="featured"` para la destacada de arriba; `"compact"` para las filas de abajo (M24 · D31).
 */
export const NewsCard = ({ item, variant = 'compact', onOpen }) => {
  const isFeatured = variant === 'featured';
  const isApp = item.source === 'app';
  const Icon = isApp ? Sparkles : Megaphone;
  const tag = `${NEWS_SOURCES[item.source]?.tag ?? 'Municipio'}${item.tagDetail ? ` · ${item.tagDetail}` : ''}`;

  return (
    <button
      type="button"
      onClick={() => onOpen?.(item)}
      data-testid={isFeatured ? 'news-card-featured' : 'news-card'}
      className={`rep-focus flex w-full items-center gap-3 rounded-2xl border border-rep-border bg-rep-surface text-left shadow-rep-card transition-[filter] duration-120 hover:brightness-[.98] dark:hover:brightness-[1.04] ${
        isFeatured ? 'flex-col items-stretch gap-0 overflow-hidden p-0' : 'p-4'
      }`}
    >
      {isFeatured && (
        <span aria-hidden="true" className="flex h-32 w-full items-center justify-center bg-rep-accent-soft text-rep-accent md:h-40">
          <Icon className="h-9 w-9" strokeWidth={1.75} />
        </span>
      )}

      <span className={`flex min-w-0 flex-1 flex-col gap-1 ${isFeatured ? 'p-4' : ''}`}>
        <span className="flex items-center gap-2">
          <span
            className={`rounded-lg px-2 py-0.5 text-rep-pill uppercase tracking-wide ${
              isApp ? 'bg-rep-notice-soft text-rep-notice' : 'bg-rep-accent-soft text-rep-accent'
            }`}
          >
            {tag}
          </span>
          <span className="text-rep-label text-rep-ink-muted">{formatNewsDate(item.publishedAt)}</span>
        </span>

        <span className={`text-rep-ink ${isFeatured ? 'text-rep-section md:text-rep-section-d' : 'text-rep-body font-bold md:text-rep-body-d'}`}>
          {item.title}
        </span>

        {isFeatured && item.summary && (
          <span className="text-rep-body text-rep-ink-muted md:text-rep-body-d">{item.summary}</span>
        )}
      </span>

      {!isFeatured && <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-rep-ink-faint" />}
    </button>
  );
};

export default NewsCard;
