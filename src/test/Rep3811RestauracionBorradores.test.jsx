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
      // El alta funciona: lo que se mira acá es la identidad del borrador
      maybeSingle: () => Promise.resolve({ data: { id: 'report-nuevo-1', client_side_id: 'x' }, error: null }),
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



import { saveDraftReport, markDraftPendingSync, getAllPendingSyncReports, getDraftReport } from '../services/offlineStorageService';

const montar = () =>
  render(
    <MemoryRouter initialEntries={['/nuevo-reporte']}>
      <Routes>
        <Route path="/nuevo-reporte" element={<NewReportPage />} />
        <Route path="*" element={<Donde />} />
      </Routes>
    </MemoryRouter>
  );

const sembrarPendiente = async () => {
  await saveDraftReport({
    client_side_id: 'csid-pendiente-anterior',
    evidenceList: [{ id: 'e-viejo', file: new Blob(['foto vieja'], { type: 'image/jpeg' }), name: 'vieja.jpg', mimeType: 'image/jpeg' }],
    selectedCategory: { id: 'AMBIENTE', name: 'Ambiente' },
    description: 'Contenedor desbordado hace dias',
    customLocation: { localityId: 'loc-almagro', localityLabel: 'Almagro', coordinates: { lat: -34.6, lng: -58.4 } },
    status: 'DRAFT_LOCAL',
  });
  await markDraftPendingSync('csid-pendiente-anterior');
};

// REP-3811 (hallazgo) · regresión: un borrador que ya está en la cola de envío (PENDING_SYNC) no se restaura al
// abrir un reporte nuevo. Antes el reporte nuevo adoptaba su client_side_id, precargaba sus datos y lo pisaba.
describe('REP-3811: abrir un reporte nuevo con un borrador ya encolado', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    if (typeof URL.createObjectURL !== 'function') URL.createObjectURL = vi.fn(() => 'blob:http://localhost/mock-preview-url');
    if (typeof URL.revokeObjectURL !== 'function') URL.revokeObjectURL = vi.fn();
  });

  it('UT-REST-03: el reporte nuevo empieza limpio y el pendiente anterior queda intacto en la cola', async () => {
    await sembrarPendiente();
    montar();

    fireEvent.change(screen.getByTestId('gallery-file-input'), {
      target: { files: [new File(['foto nueva'], 'nueva.jpg', { type: 'image/jpeg' })] },
    });
    fireEvent.click(await screen.findByRole('button', { name: /continuar al siguiente paso/i }));
    await screen.findByRole('button', { name: /^Continuar$/i });

    // No precarga los datos del pendiente anterior
    expect(screen.getByRole('textbox').value).toBe('');

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Persona durmiendo en la calle' } });
    await new Promise((resolve) => setTimeout(resolve, 600));

    // El pendiente sigue siendo el de antes (mismo id, descripción y foto) y el nuevo es otro borrador distinto
    const anterior = await getDraftReport('csid-pendiente-anterior');
    expect(anterior).toMatchObject({ status: 'PENDING_SYNC', description: 'Contenedor desbordado hace dias' });
    expect(anterior.evidenceList).toHaveLength(1);
    expect(anterior.evidenceList[0].blob).toBeTruthy();

    const pendientes = await getAllPendingSyncReports();
    expect(pendientes.map((d) => d.client_side_id)).toEqual(['csid-pendiente-anterior']);
  }, 30000);

  it('UT-REST-04: un borrador en edición (DRAFT_LOCAL) sí se restaura al volver a abrir el reporte', async () => {
    await saveDraftReport({
      client_side_id: 'csid-en-edicion',
      evidenceList: [{ id: 'e1', file: new Blob(['foto'], { type: 'image/jpeg' }), name: 'f.jpg', mimeType: 'image/jpeg' }],
      selectedCategory: { id: 'AMBIENTE', name: 'Ambiente' },
      description: 'Bache grande frente a la escuela',
      status: 'DRAFT_LOCAL',
    });
    montar();

    fireEvent.click(await screen.findByRole('button', { name: /continuar al siguiente paso/i }));
    await screen.findByRole('button', { name: /^Continuar$/i });
    expect(screen.getByRole('textbox').value).toBe('Bache grande frente a la escuela');
  }, 30000);
});
