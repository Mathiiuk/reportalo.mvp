/**
 * @file Rep3747IngresoPanel.test.jsx
 * @description REP-3747: ingreso propio del panel (decisión 4A de Matías, 29/10). Pide el enlace sin crear
 * cuentas y responde siempre lo mismo, así nadie puede averiguar qué correos son de un organismo. /organismo, la
 * dirección del diseño de Iván, lleva a /panel (decisión 2A).
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

const otpMock = vi.fn();
vi.mock('../lib/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: { auth: { signInWithOtp: (...args) => otpMock(...args) } },
}));
let sesion = null;
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ session: sesion, user: sesion?.user ?? null, loading: false }) }));

import { PanelLoginPage } from '../pages/panel/PanelLoginPage';
import { OrganismoRedirect } from '../pages/panel/OrganismoRedirect';

const Ruta = () => {
  const l = useLocation();
  return <span data-testid="ruta">{`${l.pathname}${l.search}`}</span>;
};
const montar = (entrada = '/panel/ingresar') =>
  render(
    <MemoryRouter initialEntries={[entrada]}>
      <Routes>
        <Route path="/panel/ingresar" element={<PanelLoginPage />} />
        <Route path="/organismo/*" element={<OrganismoRedirect />} />
        <Route path="*" element={<Ruta />} />
      </Routes>
    </MemoryRouter>
  );

const pedir = (correo) => {
  fireEvent.change(screen.getByLabelText('Correo del organismo'), { target: { value: correo } });
  fireEvent.click(screen.getByRole('button', { name: /enviarme el enlace/i }));
};

describe('REP-3747 · ingreso del panel', () => {
  beforeEach(() => {
    otpMock.mockReset();
    sesion = null;
  });

  it('UT-3747-I1: pide el enlace sin crear cuentas y vuelve a /panel', async () => {
    otpMock.mockResolvedValue({ data: {}, error: null });
    montar();
    expect(screen.getByRole('heading', { level: 1, name: 'Ingresar al panel' })).toBeInTheDocument();
    pedir(' Operador@Prueba.ar ');
    await waitFor(() =>
      expect(otpMock).toHaveBeenCalledWith({
        email: 'operador@prueba.ar',
        options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/panel` },
      })
    );
    expect(await screen.findByRole('heading', { name: 'Revisá tu correo' })).toBeInTheDocument();
    expect(screen.getByText(/si el correo corresponde a un organismo, te llega el enlace/i)).toBeInTheDocument();
  });

  it('UT-3747-I2: un correo sin cuenta recibe la misma respuesta (no se puede averiguar quién es operador)', async () => {
    otpMock.mockResolvedValue({ data: null, error: { message: 'Signups not allowed for otp', code: 'otp_disabled', status: 422 } });
    montar();
    pedir('nadie@ejemplo.com');
    expect(await screen.findByRole('heading', { name: 'Revisá tu correo' })).toBeInTheDocument();
    expect(screen.queryByText(/no está asociado/i)).not.toBeInTheDocument();
  });

  it('UT-3747-I3: formato inválido o falla de red: lo dice y no cambia de pantalla', async () => {
    montar();
    pedir('sin-arroba');
    expect(await screen.findByRole('alert')).toHaveTextContent(/escribí un correo válido/i);
    expect(otpMock).not.toHaveBeenCalled();
    otpMock.mockResolvedValue({ data: null, error: { message: 'Failed to fetch', status: 0 } });
    pedir('operador@prueba.ar');
    expect(await screen.findByRole('alert')).toHaveTextContent(/no pudimos enviar el enlace/i);
  });

  it('UT-3747-I4: «Usar otro correo» vuelve al formulario', async () => {
    otpMock.mockResolvedValue({ data: {}, error: null });
    montar();
    pedir('operador@prueba.ar');
    fireEvent.click(await screen.findByRole('button', { name: 'Usar otro correo' }));
    expect(screen.getByLabelText('Correo del organismo')).toBeInTheDocument();
  });

  it('UT-3747-I5: con sesión ya iniciada va directo a /panel', async () => {
    sesion = { user: { id: 'op-1' } };
    montar();
    await waitFor(() => expect(screen.getByTestId('ruta')).toHaveTextContent('/panel'));
  });

  it('UT-3747-I6: /organismo y sus subrutas llevan a /panel', async () => {
    montar('/organismo/');
    await waitFor(() => expect(screen.getByTestId('ruta')).toHaveTextContent(/^\/panel$/));
  });
});
