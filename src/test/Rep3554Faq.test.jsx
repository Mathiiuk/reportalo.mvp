/**
 * @file Rep3554Faq.test.jsx
 * @description REP-3554 · «Consultar preguntas frecuentes»: ruta /faq con un conjunto breve de preguntas y respuestas, navegación
 * de retorno, acceso visible desde Perfil, sin flujos de soporte ni integraciones externas, y contenido fácil de actualizar.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FaqPage } from '../pages/FaqPage';
import { FAQ_ITEMS } from '../content/faqContent';
import { ProfilePage } from '../pages/ProfilePage';
import { AuthContext } from '../context/AuthContext';

vi.mock('sonner', () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn(), default: vi.fn() } }));
vi.mock('../services/reportSubmissionService', () => ({ getMyReports: vi.fn().mockResolvedValue({ success: true, reports: [] }) }));
vi.mock('../services/offlineStorageService', () => ({ getAllPendingSyncReports: vi.fn().mockResolvedValue([]) }));

const Donde = () => <div data-testid="donde">{useLocation().pathname}</div>;

const montarFaq = () =>
  render(
    <MemoryRouter initialEntries={['/faq']}>
      <Routes>
        <Route path="/faq" element={<FaqPage />} />
        <Route path="*" element={<Donde />} />
      </Routes>
    </MemoryRouter>
  );

describe('REP-3554: contenido de las preguntas frecuentes', () => {
  it('UT-V3554-01: es un conjunto breve (entre 6 y 12 preguntas), cada una con id único, pregunta y respuesta', () => {
    expect(FAQ_ITEMS.length).toBeGreaterThanOrEqual(6);
    expect(FAQ_ITEMS.length).toBeLessThanOrEqual(12);
    expect(new Set(FAQ_ITEMS.map((item) => item.id)).size).toBe(FAQ_ITEMS.length);
    for (const item of FAQ_ITEMS) {
      expect(item.question.trim().endsWith('?')).toBe(true);
      expect(item.answer.trim().length).toBeGreaterThan(30);
    }
  });

  it('UT-V3554-02: cubre lo básico del MVP: cómo reportar, fotos y privacidad, seguimiento, sin conexión y emergencias', () => {
    const texto = FAQ_ITEMS.map((i) => `${i.question} ${i.answer}`).join(' ').toLowerCase();
    for (const tema of ['cómo hago un reporte', 'fotos', 'estado', 'no tengo internet', '911']) {
      expect(texto).toContain(tema);
    }
  });

  it('UT-V3554-03: no promete lo que la app no hace: sin plazos de respuesta, sin soporte por teléfono o mail, sin enlaces externos', () => {
    const texto = FAQ_ITEMS.map((i) => `${i.question} ${i.answer}`).join(' ');
    expect(texto).not.toMatch(/https?:\/\//i);
    expect(texto).not.toMatch(/@[a-z0-9-]+\./i);
    expect(texto).not.toMatch(/en \d+ (horas|días)|dentro de las próximas|garantiz/i);
  });
});

describe('REP-3554: pantalla /faq', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('UT-V3554-04: muestra el título y todas las preguntas, cerradas al entrar', () => {
    montarFaq();

    expect(screen.getByRole('heading', { level: 1, name: /preguntas frecuentes/i })).toBeInTheDocument();
    const botones = screen.getAllByRole('button', { name: /\?$/ });
    expect(botones).toHaveLength(FAQ_ITEMS.length);
    for (const boton of botones) expect(boton).toHaveAttribute('aria-expanded', 'false');
  });

  it('UT-V3554-05: tocar una pregunta muestra su respuesta y volver a tocarla la oculta', () => {
    montarFaq();
    const primera = screen.getByRole('button', { name: FAQ_ITEMS[0].question });

    fireEvent.click(primera);
    expect(primera).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(FAQ_ITEMS[0].answer)).toBeVisible();

    fireEvent.click(primera);
    expect(primera).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText(FAQ_ITEMS[0].answer)).not.toBeVisible();
  });

  it('UT-V3554-06: se pueden abrir varias a la vez (cada una es independiente)', () => {
    montarFaq();
    fireEvent.click(screen.getByRole('button', { name: FAQ_ITEMS[0].question }));
    fireEvent.click(screen.getByRole('button', { name: FAQ_ITEMS[1].question }));

    expect(screen.getByText(FAQ_ITEMS[0].answer)).toBeVisible();
    expect(screen.getByText(FAQ_ITEMS[1].answer)).toBeVisible();
  });

  it('UT-V3554-07: es accesible: cada botón apunta a su respuesta, que es una región con nombre', () => {
    montarFaq();
    const boton = screen.getByRole('button', { name: FAQ_ITEMS[0].question });
    fireEvent.click(boton);

    const region = document.getElementById(boton.getAttribute('aria-controls'));
    expect(region).toBeInTheDocument();
    expect(region).toHaveAttribute('role', 'region');
    expect(region).toHaveAttribute('aria-labelledby', boton.id);
  });

  it('UT-V3554-08: tiene navegación de retorno al Perfil', () => {
    montarFaq();
    fireEvent.click(screen.getByRole('button', { name: /volver al perfil/i }));
    expect(screen.getByTestId('donde')).toHaveTextContent('/perfil');
  });

  it('UT-V3554-09: no agrega flujos de soporte: sin formulario, sin campos de texto y sin enlaces externos', () => {
    const { container } = montarFaq();
    // La barra de la app trae su propio <input type="file"> para abrir la cámara: no cuenta como campo de soporte
    expect(container.querySelector('form, textarea, input:not([type="file"])')).toBeNull();
    expect(container.querySelector('a[href^="http"], a[href^="mailto"], a[href^="tel"]')).toBeNull();
  });
});

describe('REP-3554: acceso visible desde Perfil y ruta protegida', () => {
  const auth = {
    session: { user: { id: 'usr-1', email: 'lucia.f@mail.com', user_metadata: { full_name: 'Lucía F.' } } },
    user: { id: 'usr-1', email: 'lucia.f@mail.com', user_metadata: { full_name: 'Lucía F.' } },
    loading: false,
    signOut: vi.fn(),
  };

  it('UT-V3554-10: el Perfil ofrece «Ayuda y preguntas frecuentes» y lleva a /faq', () => {
    render(
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={['/perfil']}>
          <Routes>
            <Route path="/perfil" element={<ProfilePage />} />
            <Route path="*" element={<Donde />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    const acceso = screen.getByTestId('profile-faq-btn');
    expect(within(acceso).getByText(/ayuda y preguntas frecuentes/i)).toBeInTheDocument();
    fireEvent.click(acceso);
    expect(screen.getByTestId('donde')).toHaveTextContent('/faq');
  });

  it('UT-V3554-11: la ruta /faq existe y exige sesión, como las demás pantallas de la app', () => {
    const app = readFileSync(resolve(__dirname, '../App.jsx'), 'utf8');
    expect(app).toMatch(/path="\/faq"\s+element=\{\s*<ProtectedRoute>\s*<FaqPage \/>\s*<\/ProtectedRoute>/);
    expect(app).toMatch(/React\.lazy\(\(\) => import\('\.\/pages\/FaqPage'\)/);
  });
});
