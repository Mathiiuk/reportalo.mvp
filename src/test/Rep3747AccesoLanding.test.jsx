/**
 * @file Rep3747AccesoLanding.test.jsx
 * @description REP-3747: acceso al panel desde la landing de municipios (diseño v2 de Iván, D40 y M33; Matías, 30/10).
 * La tarjeta «Ingresar al panel» ocupa el lugar de «Cómo funciona», que baja como fila de tres tarjetas antes de
 * «Privacidad y marco legal». Pide el enlace igual que /panel/ingresar: sin crear cuentas y respondiendo siempre lo
 * mismo, así nadie puede averiguar qué correos son de un organismo (decisión 4A). Por eso no se muestra «Cuenta del
 * Municipio de …» bajo el campo, como trae el diseño.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const otpMock = vi.fn();
vi.mock('../lib/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: { auth: { signInWithOtp: (...args) => otpMock(...args) } },
}));

import { MunicipiosPage } from '../pages/MunicipiosPage';
import { AuthContext } from '../context/AuthContext';

const montar = () =>
  render(
    <AuthContext.Provider value={{ user: null, session: null, loading: false }}>
      <MemoryRouter initialEntries={['/municipios']}>
        <MunicipiosPage />
      </MemoryRouter>
    </AuthContext.Provider>
  );

const tarjeta = () => screen.getByRole('region', { name: 'Ingresar al panel' });
const pedir = (correo) => {
  fireEvent.change(within(tarjeta()).getByLabelText('Correo del organismo'), { target: { value: correo } });
  fireEvent.click(within(tarjeta()).getByRole('button', { name: /enviarme el enlace/i }));
};
const sigue = (a, b) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe('REP-3747 · acceso al panel en la landing de municipios', () => {
  beforeEach(() => otpMock.mockReset());

  it('UT-3747-L1: la tarjeta va en el hero, después del título y antes de las cifras (D40 y M33)', () => {
    montar();
    const card = tarjeta();
    expect(within(card).getByText('Acceso para organismos')).toBeInTheDocument();
    expect(within(card).getByText(/Usá el correo de tu organismo\. Te llega un enlace para entrar, sin contraseña\./)).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'info@reportalo.com.ar' })).toHaveAttribute('href', 'mailto:info@reportalo.com.ar');
    const titulo = screen.getByRole('heading', { level: 1 });
    expect(sigue(titulo, card)).toBe(true);
    expect(sigue(card, screen.getByText('Fotos anonimizadas'))).toBe(true);
  });

  it('UT-3747-L2: «Cómo funciona» baja como fila de tres tarjetas, después del hero y antes de Privacidad', () => {
    montar();
    const como = document.getElementById('como-funciona');
    expect(como.tagName).toBe('SECTION');
    expect(within(como).getAllByRole('listitem').filter((li) => li.closest('ol'))).toHaveLength(3);
    expect(sigue(tarjeta(), como)).toBe(true);
    expect(sigue(como, document.getElementById('privacidad'))).toBe(true);
  });

  it('UT-3747-L3: pide el enlace sin crear cuentas y vuelve al panel', async () => {
    otpMock.mockResolvedValue({ error: null });
    montar();
    pedir(' Operador.CABA@Prueba.Reportalo.ar ');
    expect(await within(tarjeta()).findByText('Revisá tu correo')).toBeInTheDocument();
    expect(otpMock).toHaveBeenCalledWith({
      email: 'operador.caba@prueba.reportalo.ar',
      options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/panel` },
    });
    fireEvent.click(within(tarjeta()).getByRole('button', { name: 'Usar otro correo' }));
    expect(within(tarjeta()).getByLabelText('Correo del organismo')).toBeInTheDocument();
  });

  it('UT-3747-L4: un correo sin organismo recibe la misma respuesta (no se puede averiguar quién es operador)', async () => {
    otpMock.mockResolvedValue({ error: { message: 'Signups not allowed for otp', code: 'otp_disabled' } });
    montar();
    pedir('vecino@gmail.com');
    expect(await within(tarjeta()).findByText('Revisá tu correo')).toBeInTheDocument();
    expect(screen.queryByText(/no está asociado/i)).not.toBeInTheDocument();
  });

  it('UT-3747-L5: correo inválido o error del servicio muestran el aviso en la tarjeta', async () => {
    montar();
    pedir('no-es-un-correo');
    expect(within(tarjeta()).getByRole('alert')).toHaveTextContent('Escribí un correo válido');
    expect(otpMock).not.toHaveBeenCalled();
    otpMock.mockResolvedValue({ error: { message: 'Email rate limit exceeded' } });
    pedir('operador@prueba.reportalo.ar');
    await waitFor(() => expect(within(tarjeta()).getByRole('alert')).toHaveTextContent('No pudimos enviar el enlace'));
  });
});
