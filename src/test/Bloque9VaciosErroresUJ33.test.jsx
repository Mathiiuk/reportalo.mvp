import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Inbox } from 'lucide-react';

import { EmptyState } from '../components/common/EmptyState';
import { ForbiddenPage } from '../pages/ForbiddenPage';

describe('REP-3791 Bloque 9 · Estados vacíos y errores (UJ v3.3 · M26–M32)', () => {
  it('UT-B9-01: EmptyState dice qué va a pasar y ofrece un solo verbo principal', () => {
    const onPrimary = vi.fn();
    const onSecondary = vi.fn();
    render(
      <EmptyState
        icon={Inbox}
        title="Todavía no enviaste reportes"
        description="Cuando envíes uno, acá vas a poder seguir su estado."
        primaryAction={{ label: 'Hacer mi primer reporte', onClick: onPrimary }}
        secondaryAction={{ label: 'Ver el mapa de la zona', onClick: onSecondary }}
      />
    );

    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /todavía no enviaste reportes/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /hacer mi primer reporte/i }));
    fireEvent.click(screen.getByRole('button', { name: /ver el mapa de la zona/i }));
    expect(onPrimary).toHaveBeenCalledTimes(1);
    expect(onSecondary).toHaveBeenCalledTimes(1);
  });

  it('UT-B9-02: M32 muestra el 403 con la dirección que falló y las dos salidas', () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/acceso-restringido', state: { from: '/municipio/avellaneda' } }]}>
        <Routes>
          <Route path="/acceso-restringido" element={<ForbiddenPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /acceso denegado/i })).toBeInTheDocument();
    expect(screen.getByText('/municipio/avellaneda')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /volver al inicio/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ingresar con cuenta institucional/i })).toBeInTheDocument();
  });
});
