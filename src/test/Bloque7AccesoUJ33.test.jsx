import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ signInWithMagicLink: vi.fn().mockResolvedValue({ error: null }), signInWithGoogle: vi.fn(), authError: null, clearError: vi.fn() }),
}));

import { CheckEmailPage } from '../pages/CheckEmailPage';

describe('REP-3791 Bloque 7 · Acceso y primer ingreso (UJ v3.3 · M01–M03)', () => {
  it('UT-B7-01: M03 arranca la cuenta regresiva de reenvío en 60 s, con formato m:ss', () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/check-email', state: { email: 'vecina@example.org' } }]}>
        <CheckEmailPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /Revisá tu correo/i })).toBeInTheDocument();
    expect(screen.getByText('vecina@example.org')).toBeInTheDocument();
    expect(screen.getByText(/Reenviar en 1:00/)).toBeInTheDocument();
    expect(screen.getByText(/El enlace vence en 15 minutos y sirve una sola vez/i)).toBeInTheDocument();
  });
});
