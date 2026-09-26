import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { createEvidenceItem, EVIDENCE_STATUS } from '../types/evidence';
import { useEvidenceCapture } from '../hooks/useEvidenceCapture';
import { EvidenceCaptureStep } from '../components/report/EvidenceCaptureStep';
import { NewReportPage } from '../pages/NewReportPage';

// REP-2204: espía del alta del reporte, para verificar que un doble toque no lo crea dos veces
const { upsertReportSpy } = vi.hoisted(() => ({
  upsertReportSpy: vi.fn(() => ({
    select: () => ({
      single: () => Promise.resolve({
        data: { id: 'report-e2e-1', client_side_id: 'csid-e2e-1' },
        error: null,
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

describe('REP-2201: Captura de evidencia desacoplada con diseño Journey v2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    if (typeof URL.createObjectURL !== 'function') {
      URL.createObjectURL = vi.fn(() => 'blob:http://localhost/mock-preview-url');
    }
    if (typeof URL.revokeObjectURL !== 'function') {
      URL.revokeObjectURL = vi.fn();
    }
    // REP-2500: attachReportEvidence hace fetch(sanitizedUrl) antes de re-subir — jsdom no tiene
    // acceso de red real, así que se mockea para resolver en memoria en vez de colgarse.
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['sanitized-bytes'], { type: 'image/jpeg' })),
    });
  });

  describe('Modelo / Factory: createEvidenceItem', () => {
    it('UT-EVD-01: Genera un objeto EvidenceItem con estado CAPTURED_LOCAL y coordenadas GPS', () => {
      const mockFile = new File(['fake image binary'], 'bache.jpg', { type: 'image/jpeg' });
      const mockCoords = { lat: -34.6037, lng: -58.3816, accuracy: 10 };

      const evidence = createEvidenceItem(mockFile, mockCoords);

      expect(evidence.id).toBeDefined();
      expect(evidence.status).toBe(EVIDENCE_STATUS.CAPTURED_LOCAL);
      expect(evidence.name).toBe('bache.jpg');
      expect(evidence.mimeType).toBe('image/jpeg');
      expect(evidence.geolocation).toEqual({
        lat: -34.6037,
        lng: -58.3816,
        accuracy: 10,
      });
      expect(evidence.previewUrl).toBeDefined();
    });
  });

  describe('Hook: useEvidenceCapture con soporte multifoto', () => {
    it('UT-EVD-02: captureFile permite agregar hasta 4 fotos y calcula photoCount correctamente', async () => {
      const { result } = renderHook(() => useEvidenceCapture());
      const mockFile1 = new File(['img1'], 'foto1.jpg', { type: 'image/jpeg' });
      const mockFile2 = new File(['img2'], 'foto2.jpg', { type: 'image/jpeg' });

      await act(async () => {
        await result.current.captureFile(mockFile1);
      });

      expect(result.current.photoCount).toBe(1);
      expect(result.current.hasEvidence).toBe(true);

      await act(async () => {
        await result.current.captureFile(mockFile2);
      });

      expect(result.current.photoCount).toBe(2);
      expect(result.current.evidenceList.length).toBe(2);
    });

    it('UT-EVD-03: rechaza formatos no admitidos (e.g. PDF)', async () => {
      const { result } = renderHook(() => useEvidenceCapture());
      const invalidFile = new File(['text'], 'doc.pdf', { type: 'application/pdf' });

      let res;
      await act(async () => {
        res = await result.current.captureFile(invalidFile);
      });

      expect(res.success).toBe(false);
      expect(result.current.error).toMatch(/Formato de imagen no admitido/i);
    });

    it('UT-EVD-04: removePhoto elimina una foto específica y clearEvidence remueve todas', async () => {
      const { result } = renderHook(() => useEvidenceCapture());
      const mockFile1 = new File(['img1'], 'foto1.jpg', { type: 'image/jpeg' });

      await act(async () => {
        await result.current.captureFile(mockFile1);
      });

      const photoId = result.current.evidenceList[0].id;
      act(() => {
        result.current.removePhoto(photoId);
      });

      expect(result.current.photoCount).toBe(0);
    });
  });

  describe('Componente UI: EvidenceCaptureStep (Journey v2)', () => {
    it('UT-EVD-05: Renderiza topbar de privacidad, badge de ubicación y disparador de cámara', () => {
      render(
        <EvidenceCaptureStep
          evidenceList={[]}
          error={null}
          onCaptureFile={vi.fn()}
          onClearEvidence={vi.fn()}
          onCancel={vi.fn()}
          onContinue={vi.fn()}
        />
      );

      expect(screen.getByText(/Privacidad activada/i)).toBeInTheDocument();
      expect(screen.getByText(/Los rostros y patentes se difuminan/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /tomar fotografía/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cerrar cámara/i })).toBeInTheDocument();
    });

    it('UT-EVD-06: Muestra miniatura acumulada con contador cuando existen fotos', () => {
      const mockList = [
        { id: '1', previewUrl: 'blob:mock1', name: 'foto1.jpg' },
        { id: '2', previewUrl: 'blob:mock2', name: 'foto2.jpg' },
      ];

      render(
        <EvidenceCaptureStep
          evidenceList={mockList}
          error={null}
          onCaptureFile={vi.fn()}
          onClearEvidence={vi.fn()}
          onCancel={vi.fn()}
          onContinue={vi.fn()}
        />
      );

      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /continuar al siguiente paso/i })).toBeInTheDocument();
    });
  });

  describe('Flujo Integrado: NewReportPage', () => {
    it('UT-EVD-07: Al tomar foto y presionar continuar, navega al paso 2 con galería de miniaturas', async () => {
      render(
        <MemoryRouter initialEntries={['/nuevo-reporte']}>
          <NewReportPage />
        </MemoryRouter>
      );

      const galleryInput = screen.getByTestId('gallery-file-input');
      const validFile = new File(['sample image'], 'bache_real.jpg', { type: 'image/jpeg' });

      fireEvent.change(galleryInput, { target: { files: [validFile] } });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /continuar al siguiente paso/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /continuar al siguiente paso/i }));

      await waitFor(() => {
        expect(screen.getByText(/Categoría del incumplimiento/i)).toBeInTheDocument();
        expect(screen.getByText('Detalle')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^Continuar$/i })).toBeInTheDocument();
      });
    });

    it(
      'UT-EVD-08: Al avanzar al Paso 3 y enviar el reporte, ejecuta la animación de "Protegiendo tus fotos…" (Paso 4) y encadena con "Reporte enviado" sin paso intermedio (UJ v3.3)',
      async () => {
        render(
        <MemoryRouter initialEntries={['/nuevo-reporte']}>
          <NewReportPage />
        </MemoryRouter>
      );

      // 1. Paso 1: Cargar foto y continuar
      const galleryInput = screen.getByTestId('gallery-file-input');
      const validFile = new File(['sample image'], 'bache_real.jpg', { type: 'image/jpeg' });
      fireEvent.change(galleryInput, { target: { files: [validFile] } });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /continuar al siguiente paso/i })).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('button', { name: /continuar al siguiente paso/i }));

      // 2. Paso 2: Llenar descripción (obligatorio) y continuar a revisión
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^Continuar$/i })).toBeInTheDocument();
      });
      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'Bache enorme en la calle' } });
      fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));

      // 3. Paso 3: Revisión — como aún no se confirmó la localidad (R-1/R-2), "Enviar reporte" abre el ajuste de ubicación
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /enviar reporte/i })).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('button', { name: /enviar reporte/i }));

      // Se elige la localidad de la zona piloto en el selector con autocompletado
      await waitFor(() => {
        expect(screen.getByTestId('locality-selector-trigger')).not.toBeDisabled();
      });
      fireEvent.click(screen.getByTestId('locality-selector-trigger'));
      fireEvent.click(await screen.findByTestId('locality-option-loc-almagro'));
      fireEvent.click(screen.getByRole('button', { name: /confirmar ubicación/i }));

      // Con la localidad ya confirmada, "Enviar reporte" ahora sí avanza
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /enviar reporte/i })).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('button', { name: /enviar reporte/i }));

      // Si es primer reporte, abre el modal "Antes de enviar" y se acepta
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /acepto y envío/i })).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('button', { name: /acepto y envío/i }));

      // 4. Paso 4: Debe renderizar la pantalla "Protegiendo tus fotos…"
      await waitFor(() => {
        expect(screen.getByText('Protegiendo tus fotos…')).toBeInTheDocument();
        expect(screen.getByText('Buscando rostros y patentes')).toBeInTheDocument();
      });

      // UJ v3.3 (REP-3791 Bloque 2): sin paso de vista previa ni «Confirmar y enviar»:
      // al terminar la protección el reporte se persiste y encadena con «Reporte enviado».
      // 6. Paso 6: Confirmación de reporte enviado
      await waitFor(
        () => {
          expect(screen.getByText('Reporte enviado')).toBeInTheDocument();
          expect(screen.getByRole('button', { name: /ver el reporte/i })).toBeInTheDocument();
          expect(screen.getByRole('button', { name: /volver al mapa/i })).toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      // REP-2204: se envía la categoría resuelta, la descripción, la localidad confirmada y nada más
      expect(upsertReportSpy).toHaveBeenCalledTimes(1);
      const enviado = upsertReportSpy.mock.calls[0][0];
      expect(enviado.service_id).toBe('service-e2e-1');
      expect(enviado.description).toBe('Bache enorme en la calle');
      expect(enviado.locality_id).toBe('loc-almagro');
      expect(Object.keys(enviado).sort()).toEqual(
        ['client_side_id', 'current_state_code', 'description', 'latitud', 'locality_id', 'longitud', 'service_id', 'user_id']
      );
    }, 15000);

    // REP-2204: un doble toque en «Acepto y envío» no debe crear dos reportes
    it(
      'UT-SND-07: dos toques seguidos en «Acepto y envío» registran el consentimiento y crean el reporte una sola vez',
      async () => {
        // El test anterior deja los términos aceptados: sin esto no aparece la hoja de consentimiento
        localStorage.clear();
        render(
          <MemoryRouter initialEntries={['/nuevo-reporte']}>
            <NewReportPage />
          </MemoryRouter>
        );

        fireEvent.change(screen.getByTestId('gallery-file-input'), {
          target: { files: [new File(['sample image'], 'bache_real.jpg', { type: 'image/jpeg' })] },
        });
        await waitFor(() => {
          expect(screen.getByRole('button', { name: /continuar al siguiente paso/i })).toBeInTheDocument();
        });
        fireEvent.click(screen.getByRole('button', { name: /continuar al siguiente paso/i }));

        await waitFor(() => {
          expect(screen.getByRole('button', { name: /^Continuar$/i })).toBeInTheDocument();
        });
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Bache enorme en la calle' } });
        fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));

        await waitFor(() => {
          expect(screen.getByRole('button', { name: /enviar reporte/i })).toBeInTheDocument();
        });
        fireEvent.click(screen.getByRole('button', { name: /enviar reporte/i }));
        await waitFor(() => {
          expect(screen.getByTestId('locality-selector-trigger')).not.toBeDisabled();
        });
        fireEvent.click(screen.getByTestId('locality-selector-trigger'));
        fireEvent.click(await screen.findByTestId('locality-option-loc-almagro'));
        fireEvent.click(screen.getByRole('button', { name: /confirmar ubicación/i }));

        await waitFor(() => {
          expect(screen.getByRole('button', { name: /enviar reporte/i })).toBeInTheDocument();
        });
        fireEvent.click(screen.getByRole('button', { name: /enviar reporte/i }));

        const accept = await screen.findByRole('button', { name: /acepto y envío/i });
        // Dos toques en el mismo cuadro, sobre el mismo botón
        fireEvent.click(accept);
        fireEvent.click(accept);

        await waitFor(
          () => {
            expect(screen.getByText('Reporte enviado')).toBeInTheDocument();
          },
          { timeout: 5000 }
        );
        expect(upsertReportSpy).toHaveBeenCalledTimes(1);
        expect(recordTermsSpy).toHaveBeenCalledTimes(1);
      },
      15000
    );
  });
});
