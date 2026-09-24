import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'vecina@example.org' }, session: {} }) }));

// La app ya no trae novedades de ejemplo. Para probar el diseño de la lista y de la nota, el
// origen de datos se simula con publicaciones de prueba definidas solo acá.
const { getPublishedNewsMock, getNewsItemMock } = vi.hoisted(() => ({
  getPublishedNewsMock: vi.fn(),
  getNewsItemMock: vi.fn(),
}));
vi.mock('../services/newsService', async (importOriginal) => ({
  ...(await importOriginal()),
  getPublishedNews: getPublishedNewsMock,
  getNewsItem: getNewsItemMock,
}));

const FIXTURE_NEWS = [
  {
    id: 'n-1', source: 'municipio', tagDetail: null, title: 'Bacheo en Av. Mitre: cortes parciales',
    summary: 'La cuadrilla trabaja por tramos.', publishedAt: '2026-09-08T09:00:00Z',
    author: 'Secretaría de Obras Públicas', hasLocation: true, body: ['La cuadrilla trabaja por tramos.'],
  },
  {
    id: 'n-2', source: 'app', tagDetail: 'v1.3', title: 'Ya podés descargar la constancia de cierre en PDF',
    summary: 'En el detalle de los reportes resueltos.', publishedAt: '2026-09-05T12:00:00Z',
    author: 'Equipo de Reportalo', hasLocation: false, body: ['Disponible en el detalle.'],
  },
  {
    id: 'n-3', source: 'municipio', tagDetail: null, title: 'Operativo de poda', summary: 'Cronograma por calle.',
    publishedAt: '2026-09-01T10:00:00Z', author: 'Secretaría de Espacios Públicos', hasLocation: true, body: ['Poda.'],
  },
  {
    id: 'n-4', source: 'municipio', tagDetail: null, title: 'Nuevos contenedores de reciclado', summary: 'Doce puntos.',
    publishedAt: '2026-08-28T10:00:00Z', author: 'Secretaría de Ambiente', hasLocation: true, body: ['Contenedores.'],
  },
];

beforeEach(() => {
  getPublishedNewsMock.mockResolvedValue({ news: [], pending: true });
  getNewsItemMock.mockResolvedValue({ item: null, pending: true });
});

import { NewsPage } from '../pages/NewsPage';
import { NewsDetailPage } from '../pages/NewsDetailPage';

const renderNews = () =>
  render(
    <MemoryRouter initialEntries={['/alertas']}>
      <Routes>
        <Route path="/alertas" element={<NewsPage />} />
        <Route path="/novedades/:id" element={<NewsDetailPage />} />
      </Routes>
    </MemoryRouter>
  );

describe('REP-3791 Bloque 8 · Novedades (UJ v3.3 · M24 / M25)', () => {
  it('UT-B8-01: sin origen de datos, muestra el estado vacío con salida al mapa y sin modo demo', async () => {
    renderNews();
    expect(screen.getByRole('heading', { name: 'Novedades', level: 1 })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /todavía no hay publicaciones/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cargar demo/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ver el mapa/i })).toBeInTheDocument();
  });

  it('UT-B8-02: con contenido, muestra una destacada arriba y el resto compactas, y filtra por origen', async () => {
    getPublishedNewsMock.mockResolvedValue({ news: FIXTURE_NEWS, pending: false });
    renderNews();

    expect(await screen.findByTestId('news-card-featured')).toBeInTheDocument();
    expect(screen.getAllByTestId('news-card')).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: /^app$/i }));
    expect(screen.queryAllByTestId('news-card')).toHaveLength(0);
    expect(within(screen.getByTestId('news-card-featured')).getByText(/constancia de cierre en PDF/i)).toBeInTheDocument();
  });

  it('UT-B8-03: la nota completa muestra quién publica y ofrece ver el tramo en el mapa', async () => {
    getNewsItemMock.mockResolvedValue({ item: FIXTURE_NEWS[0], pending: false });
    render(
      <MemoryRouter initialEntries={['/novedades/n-1']}>
        <Routes>
          <Route path="/novedades/:id" element={<NewsDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByTestId('news-detail')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Bacheo en Av. Mitre/i })).toBeInTheDocument();
    expect(screen.getByText(/Secretaría de Obras Públicas/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ver el tramo afectado en el mapa/i })).toBeInTheDocument();
  });
});
