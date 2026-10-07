/**
 * @file Rep3554Faq.test.jsx
 * @description REP-3554 · «Consultar preguntas frecuentes»: ruta /faq con un conjunto breve de preguntas y respuestas, navegación
 * de retorno, acceso visible desde Perfil, contacto por correo y teléfonos de emergencia como únicos enlaces, y contenido
 * fácil de actualizar. Diseño de referencia: docs/export/faq.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FaqPage } from '../pages/FaqPage';
import { FAQ_CONTACT, FAQ_ITEMS } from '../content/faqContent';
import { DEFAULT_REPORT_CATEGORIES } from '../services/categoriesService';
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

// Todo el texto que el ciudadano puede leer en una pregunta: enunciado, párrafos y bloques opcionales
const textoDe = (item) =>
  [
    item.question,
    ...item.answer,
    ...(item.steps ?? []),
    ...(item.categories ?? []).flatMap((c) => [c.title, c.description]),
    ...(item.phones ?? []).flatMap((p) => [p.number, p.label]),
  ].join(' ');

// Texto del primer párrafo tal como queda en pantalla (sin las marcas de negrita)
const primerParrafo = (item) => item.answer[0].replace(/\*\*/g, '');

describe('REP-3554: contenido de las preguntas frecuentes', () => {
  it('UT-V3554-01: es un conjunto breve (entre 6 y 12 preguntas), cada una con id único, pregunta y respuesta', () => {
    expect(FAQ_ITEMS.length).toBeGreaterThanOrEqual(6);
    expect(FAQ_ITEMS.length).toBeLessThanOrEqual(12);
    expect(new Set(FAQ_ITEMS.map((item) => item.id)).size).toBe(FAQ_ITEMS.length);
    for (const item of FAQ_ITEMS) {
      expect(item.question.trim().endsWith('?')).toBe(true);
      expect(Array.isArray(item.answer)).toBe(true);
      expect(item.answer.join(' ').trim().length).toBeGreaterThan(20);
    }
  });

  it('UT-V3554-02: cubre lo básico del MVP: cómo reportar, fotos y privacidad, seguimiento, sin conexión y emergencias', () => {
    const texto = FAQ_ITEMS.map(textoDe).join(' ').toLowerCase();
    for (const tema of ['cómo hago un reporte', 'fotos', 'estado', 'no tengo internet', '911']) {
      expect(texto).toContain(tema);
    }
  });

  it('UT-V3554-03: no promete lo que la app no hace: sin plazos de respuesta ni enlaces externos, y usa los nombres reales de la app', () => {
    const texto = `${FAQ_ITEMS.map(textoDe).join(' ')} ${FAQ_CONTACT.title} ${FAQ_CONTACT.description}`;
    expect(texto).not.toMatch(/https?:\/\//i);
    expect(texto).not.toMatch(/en \d+ (horas|días)|dentro de las próximas|a la brevedad|garantiz/i);
    // Frases del diseño original que la app hoy no cumple
    expect(texto).not.toMatch(/sumarte|mapa de calor|derivado/i);
    expect(texto).toContain('Notificado al responsable');
  });

  it('UT-V3554-03b: las categorías son las cinco de la app, con sus nombres reales', () => {
    const categorias = FAQ_ITEMS.find((item) => item.categories).categories.map((c) => c.title);
    expect(categorias.sort()).toEqual(DEFAULT_REPORT_CATEGORIES.map((c) => c.name).sort());
  });
});

describe('REP-3554: pantalla /faq', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('UT-V3554-04: muestra el título y todas las preguntas, con solo la primera abierta al entrar', () => {
    montarFaq();

    expect(screen.getByRole('heading', { level: 1, name: /preguntas frecuentes/i })).toBeInTheDocument();
    const botones = FAQ_ITEMS.map((item) => screen.getByRole('button', { name: item.question }));
    expect(botones[0]).toHaveAttribute('aria-expanded', 'true');
    for (const boton of botones.slice(1)) expect(boton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText(primerParrafo(FAQ_ITEMS[0]))).toBeVisible();
    expect(screen.getByText(primerParrafo(FAQ_ITEMS[3]))).not.toBeVisible();
  });

  it('UT-V3554-05: tocar una pregunta muestra su respuesta y volver a tocarla la oculta', () => {
    montarFaq();
    const cuarta = screen.getByRole('button', { name: FAQ_ITEMS[3].question });

    fireEvent.click(cuarta);
    expect(cuarta).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(primerParrafo(FAQ_ITEMS[3]))).toBeVisible();

    fireEvent.click(cuarta);
    expect(cuarta).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText(primerParrafo(FAQ_ITEMS[3]))).not.toBeVisible();
  });

  it('UT-V3554-06: se muestra una respuesta por vez: abrir una pregunta cierra la que estaba abierta', () => {
    montarFaq();
    fireEvent.click(screen.getByRole('button', { name: FAQ_ITEMS[3].question }));

    expect(screen.getByRole('button', { name: FAQ_ITEMS[0].question })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText(primerParrafo(FAQ_ITEMS[0]))).not.toBeVisible();
    expect(screen.getByText(primerParrafo(FAQ_ITEMS[3]))).toBeVisible();
  });

  it('UT-V3554-07: es accesible: cada botón apunta a su respuesta, que es una región con nombre', () => {
    montarFaq();
    const boton = screen.getByRole('button', { name: FAQ_ITEMS[0].question });

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

  it('UT-V3554-09: el contacto es solo un enlace de correo: sin formulario, sin campos de texto y sin enlaces a sitios externos', () => {
    const { container } = montarFaq();
    // La barra de la app trae su propio <input type="file"> para abrir la cámara: no cuenta como campo de soporte
    expect(container.querySelector('form, textarea, input:not([type="file"])')).toBeNull();
    expect(container.querySelector('a[href^="http"]')).toBeNull();
    expect(screen.getByTestId('faq-contact-btn')).toHaveAttribute('href', `mailto:${FAQ_CONTACT.email}`);
  });

  it('UT-V3554-12: la respuesta de emergencias ofrece llamar al 911, al 107 y al 100', () => {
    const { container } = montarFaq();
    fireEvent.click(screen.getByRole('button', { name: /es una emergencia/i }));

    const telefonos = [...container.querySelectorAll('a[href^="tel:"]')].map((a) => a.getAttribute('href'));
    expect(telefonos).toEqual(['tel:911', 'tel:107', 'tel:100']);
    expect(screen.getByRole('link', { name: /911 · Policía/ })).toBeVisible();
  });

  it('UT-V3554-13: los nombres de pantallas y botones van resaltados y sin marcas a la vista', () => {
    const { container } = montarFaq();
    expect(container.textContent).not.toContain('**');
    expect(screen.getAllByText('Perfil', { selector: 'strong' }).length).toBeGreaterThan(0);
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
