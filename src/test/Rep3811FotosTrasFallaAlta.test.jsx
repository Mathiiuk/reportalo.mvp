import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

const Donde = () => <div data-testid="donde">{useLocation().pathname}</div>;
import { NewReportPage } from '../pages/NewReportPage';

// REP-2204: espía del alta del reporte, para verificar que un doble toque no lo crea dos veces
const { upsertReportSpy } = vi.hoisted(() => ({
  upsertReportSpy: vi.fn(() => ({
    select: () => ({
      // REP-3811: el alta falla (como en el incidente de QA)
      maybeSingle: () => Promise.resolve({
        data: null,
        status: 403,
        error: { message: 'new row violates row-level security policy', code: '42501' },
      }),
    }),
  })),
}));

// REP-2204: espía del registro de consentimiento (se registra una vez por envío, no una por toque)
const { recordTermsSpy } = vi.hoisted(() => ({
  recordTermsSpy: vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock('../services/termsService', async (importOriginal) => ({
  ...(await importOriginal()),
  recordTermsAcceptance: recordTermsSpy,
}));

// REP-2500: createCitizenReport exige un usuario autenticado (user_id NOT NULL)
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-test-123', email: 'ciudadano@reportalo.ar' },
    isAuthenticated: true,
  }),
}));

// REP-2500: persistencia real — se mockea Supabase para que la selección de
// localidad (R-1 a R-5) y la creación del reporte (E-3) resuelvan en memoria.
vi.mock('../lib/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: vi.fn((table) => {
      if (table === 'localities') {
        return {
          select: vi.fn().mockResolvedValue({
            data: [
              // Cerca de DEFAULT_CITY_COORDINATES (locationService.js) a propósito: el pin
              // en este test nunca se mueve, así que la localidad elegida tiene que quedar
              // dentro del umbral de checkLocalityPinMismatch para no bloquear "Confirmar".
              {
                id: 'loc-almagro',
                name: 'Almagro',
                subdivisions: { name: 'Comuna 5', states_provinces: { name: 'Ciudad Autónoma de Buenos Aires' } },
              },
            ],
            error: null,
          }),
        };
      }
      if (table === 'citizen_reports') {
        return { upsert: upsertReportSpy };
      }
      if (table === 'report_images') {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: { id: 'image-e2e-1', image_url: 'https://cdn/report-evidences/report-e2e-1/img.jpg' },
                error: null,
              }),
            })),
          })),
        };
      }
      // Otras tablas (ej. services): sin datos, así categoriesService cae al fallback local.
      // REP-2204: las categorías de respaldo no traen dbId, así que al enviar se resuelve por service_code.
      return {
        select: vi.fn(() => ({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'service-e2e-1' }, error: null }),
          })),
        })),
      };
    }),
    // REP-2501: la subida a cuarentena lee la sesión para usar la carpeta del usuario
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'user-e2e-1' } } } }),
    },
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        remove: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://cdn/report-evidences/report-e2e-1/img.jpg' } })),
      })),
    },
    // El pipeline de cuarentena (REP-2404) invoca esta Edge Function al detectar Supabase mockeado/configurado
    functions: {
      invoke: vi.fn().mockResolvedValue({
        data: {
          success: true,
          sanitizedUrl: 'https://cdn/report-evidences/sanitized_e2e.jpg',
          clientSideId: 'csid-e2e-1',
          entitiesDetectedCount: 2,
          detectedZones: [
            { x: 120, y: 80, width: 90, height: 90, type: 'face' },
            { x: 300, y: 410, width: 140, height: 50, type: 'license_plate' },
          ],
        },
        error: null,
      }),
    },
  },
}));


import { getActiveDraftReport } from '../services/offlineStorageService';

// REP-3811 · regresión: cuando el alta falla con conexión, el borrador conserva sus fotos. Las fotos no se
// descartan por la falla del alta; si un borrador aparece sin fotos, la causa está en otro tramo (ver
// .agents/workflow/executions/REP-3811-run-001.md).
describe('REP-3811: las fotos locales tras una falla del alta', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    if (typeof URL.createObjectURL !== 'function') URL.createObjectURL = vi.fn(() => 'blob:http://localhost/mock-preview-url');
    if (typeof URL.revokeObjectURL !== 'function') URL.revokeObjectURL = vi.fn();
    global.fetch = vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(new Blob(['x'], { type: 'image/jpeg' })) });
  });

  it('UT-3811-10: tras fallar el alta con conexión, el borrador guardado conserva las fotos y vuelve a la revisión', async () => {
    render(
      <MemoryRouter initialEntries={['/nuevo-reporte']}>
        <Routes>
          <Route path="/nuevo-reporte" element={<NewReportPage />} />
          <Route path="*" element={<Donde />} />
        </Routes>
      </MemoryRouter>
    );
    fireEvent.change(screen.getByTestId('gallery-file-input'), {
      target: { files: [new File(['sample image'], 'bache_real.jpg', { type: 'image/jpeg' })] },
    });
    fireEvent.click(await screen.findByRole('button', { name: /continuar al siguiente paso/i }));
    await screen.findByRole('button', { name: /^Continuar$/i });
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Persona durmiendo en la calle' } });
    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /enviar reporte/i }));
    await waitFor(() => expect(screen.getByTestId('locality-selector-trigger')).not.toBeDisabled());
    fireEvent.click(screen.getByTestId('locality-selector-trigger'));
    fireEvent.click(await screen.findByTestId('locality-option-loc-almagro'));
    fireEvent.click(screen.getByRole('button', { name: /confirmar ubicación/i }));
    fireEvent.click(await screen.findByRole('button', { name: /enviar reporte/i }));
    fireEvent.click(await screen.findByRole('button', { name: /acepto y envío/i }));

    // El alta falla: el flujo vuelve a la revisión con el borrador intacto
    await waitFor(() => expect(upsertReportSpy).toHaveBeenCalledTimes(1), { timeout: 8000 });
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const draft = await getActiveDraftReport();
    const fotos = (draft?.evidenceList || []).map((ev) => ({ tieneBlob: Boolean(ev.blob) }));
    // Vuelve a la revisión (paso 3), no al mapa ni al éxito
    expect(screen.getByText(/Revisá antes de enviar/i)).toBeInTheDocument();
    expect(draft).toBeTruthy();
    expect(draft.status).toBe('DRAFT_LOCAL');
    expect(draft.currentStep).toBe(3);
    expect(fotos.length).toBe(1);
    expect(fotos[0].tieneBlob).toBe(true);
  }, 30000);
});
