/**
 * @file RevisionFixesUJ33.test.jsx
 * @description Cubre los arreglos salidos de la revision de codigo de la rama REP-3787,
 * para que no vuelvan a aparecer.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../lib/supabaseClient', () => ({ isSupabaseConfigured: false, supabase: {} }));

import { getNewsItem } from '../services/newsService';
import { NewsDetailPage } from '../pages/NewsDetailPage';

describe('Revision REP-3787: contenido de demostracion de Novedades', () => {
  it('UT-FIX-01: getNewsItem no entrega contenido de demostracion si no se lo piden', async () => {
    // Sin esta condicion, entrar a /novedades/demo-1 por un enlace compartido mostraba
    // un comunicado firmado por una secretaria del municipio que nadie publico.
    const sinPedirlo = await getNewsItem('demo-1');
    expect(sinPedirlo.item).toBeNull();

    const pidiendolo = await getNewsItem('demo-1', { includeDemo: true });
    expect(pidiendolo.item).not.toBeNull();
  });

  it('UT-FIX-02: la nota sin ?demo=1 no muestra el comunicado de ejemplo', async () => {
    render(
      <MemoryRouter initialEntries={['/novedades/demo-1']}>
        <Routes>
          <Route path="/novedades/:id" element={<NewsDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Esta novedad ya no está disponible')).toBeInTheDocument();
    expect(screen.queryByText(/Bacheo en Av. Mitre/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Secretaría de Obras Públicas/)).not.toBeInTheDocument();
  });
});
