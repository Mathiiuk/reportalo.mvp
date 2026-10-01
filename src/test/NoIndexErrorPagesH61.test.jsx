/**
 * @file NoIndexErrorPagesH61.test.jsx
 * @description REP-3798 / H-61: las pantallas de error piden noindex a los buscadores mientras
 * están montadas, ya que la SPA responde 200 y no puede devolver el 404/403 real.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useNoIndex } from '../hooks/useNoIndex';
import { NotFoundPage } from '../pages/NotFoundPage';

vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ session: null }) }));

const robots = () => document.head.querySelector('meta[name="robots"]');

const Probe = () => {
  useNoIndex();
  return null;
};

describe('H-61 · noindex en pantallas de error', () => {
  it('UT-H61-01: useNoIndex agrega la etiqueta al montar y la quita al desmontar', () => {
    const { unmount } = render(<Probe />);
    expect(robots()?.content).toBe('noindex');
    unmount();
    expect(robots()).toBeNull();
  });

  it('UT-H61-02: la página 404 general pide noindex', () => {
    const { unmount } = render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    );
    expect(robots()?.content).toBe('noindex');
    unmount();
    expect(robots()).toBeNull();
  });
});
