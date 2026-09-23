import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'vecina@example.org' }, session: {} }) }));

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
  it('UT-B8-01: sin origen de datos, muestra el estado vacío con salida al mapa', () => {
    renderNews();
    expect(screen.getByRole('heading', { name: 'Novedades', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /todavía no hay publicaciones/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ver el mapa/i })).toBeInTheDocument();
  });

  it('UT-B8-02: con contenido, muestra una destacada arriba y el resto compactas, y filtra por origen', () => {
    renderNews();
    fireEvent.click(screen.getByRole('button', { name: /cargar demo/i }));

    expect(screen.getByTestId('news-card-featured')).toBeInTheDocument();
    expect(screen.getAllByTestId('news-card')).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: /^app$/i }));
    expect(screen.queryAllByTestId('news-card')).toHaveLength(0);
    expect(within(screen.getByTestId('news-card-featured')).getByText(/constancia de cierre en PDF/i)).toBeInTheDocument();
  });

  it('UT-B8-03: la nota completa muestra quién publica y ofrece ver el tramo en el mapa', async () => {
    // El contenido de demostración solo se sirve con ?demo=1, que es lo que agrega la
    // lista cuando está en modo demo.
    render(
      <MemoryRouter initialEntries={['/novedades/demo-1?demo=1']}>
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
