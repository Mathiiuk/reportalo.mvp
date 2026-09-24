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
  it('UT-FIX-01: getNewsItem no entrega contenido de demostracion: la app ya no lo trae', async () => {
    // Un comunicado firmado por una secretaria del municipio que nadie publico no puede
    // aparecer por ninguna via, ni pidiendolo ni desde un enlace compartido.
    const resultado = await getNewsItem('demo-1');
    expect(resultado.item).toBeNull();
    expect(resultado.pending).toBe(true);
  });

  it('UT-FIX-02: una nota de ejemplo vieja (enlace compartido) muestra «ya no está disponible»', async () => {
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
