import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../lib/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockResolvedValue({
        data: [
          { id: 'loc-1', name: 'Retiro', subdivisions: { name: 'Comuna 1', states_provinces: { name: 'Ciudad Autónoma de Buenos Aires' } } },
          { id: 'loc-2', name: 'Piñeyro', subdivisions: { name: 'Avellaneda', states_provinces: { name: 'Buenos Aires' } } },
        ],
        error: null,
      }),
    })),
  },
}));

// Mock de maplibre-gl para entorno JSDOM
vi.mock('maplibre-gl', () => {
  return {
    supported: vi.fn(() => true),
    setWorkerUrl: vi.fn(),
    Map: vi.fn(() => ({
      on: vi.fn((event, cb) => {
        if (event === 'load' || event === 'style.load') cb();
      }),
      addControl: vi.fn(),
      remove: vi.fn(),
      resize: vi.fn(),
      flyTo: vi.fn(),
      getCenter: vi.fn(() => ({ lat: -34.6625, lng: -58.365 })),
    })),
    Marker: vi.fn(() => ({
      setLngLat: vi.fn().mockReturnThis(),
      addTo: vi.fn().mockReturnThis(),
      remove: vi.fn(),
    })),
  };
});


vi.mock('../services/offlineStorageService', () => ({
  getAllPendingSyncReports: vi.fn(),
  deleteDraftReport: vi.fn().mockResolvedValue(true),
  getActiveDraftReport: vi.fn().mockResolvedValue({ client_side_id: 'draft-1' }),
}));
vi.mock('../services/quarantinePipelineService', () => ({ processAllEvidencesThroughQuarantine: vi.fn() }));
// Solo se mockea el I/O. isServerProtectedUrl se deja real: es la regla de
// privacidad de H-30 y justamente parte de lo que estos tests verifican.
vi.mock('../services/reportSubmissionService', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, createCitizenReport: vi.fn(), attachReportEvidence: vi.fn() };
});
vi.mock('../hooks/useAuth', () => ({ useAuth: vi.fn() }));

import { getAllPendingSyncReports, deleteDraftReport } from '../services/offlineStorageService';
import { processAllEvidencesThroughQuarantine } from '../services/quarantinePipelineService';
import { createCitizenReport, attachReportEvidence } from '../services/reportSubmissionService';
import { useAuth } from '../hooks/useAuth';
import { sendPendingDraft, syncPendingReports } from '../services/pendingSyncService';
import { PendingReportsPage } from '../pages/PendingReportsPage';
import { SessionExpiredPage } from '../pages/SessionExpiredPage';
import { AdjustLocationModal } from '../components/report/AdjustLocationModal';
import { markSessionActive, clearSessionMarker } from '../lib/sessionMarker';

// Reloj fijo: PendingReportsPage formatea «hoy HH:mm» y «ayer HH:mm», y el borrador
// de prueba se construía con new Date() al cargar el módulo. Cruzar la medianoche
// entre una cosa y la otra cambiaba el texto renderizado sin que nada estuviera mal.
const AHORA = new Date('2026-09-22T15:00:00.000-03:00');

const DRAFT = {
  client_side_id: 'draft-1',
  status: 'PENDING_SYNC',
  description: 'Contenedor desbordado',
  selectedCategory: { id: 'medio_ambiente', name: 'Medio ambiente', icon: 'eco', dbId: 'srv-1' },
  customLocation: { localityId: 'loc-1', localityLabel: 'Avellaneda', coordinates: { lat: -34.66, lng: -58.36 } },
  evidenceList: [{ id: 'e1', blob: new Blob(['x'], { type: 'image/jpeg' }), name: 'f.jpg', mimeType: 'image/jpeg' }],
  updatedAt: AHORA.toISOString(),
};

describe('REP-3791 Bloque 4 · Sin conexión y errores del reporte (UJ v3.3 · M20–M23)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Solo se congela Date: los temporizadores siguen siendo reales, porque
    // waitFor y los efectos de React los necesitan.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(AHORA);
    useAuth.mockReturnValue({ user: { id: 'user-1' }, session: null, signInWithGoogle: vi.fn(), signInWithMagicLink: vi.fn().mockResolvedValue({ error: null }) });
    Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
  });
  afterEach(() => {
    clearSessionMarker();
    vi.useRealTimers();
  });

  it('UT-B4-01: envía un pendiente con foto protegida en el servidor y borra el borrador local', async () => {
    getAllPendingSyncReports.mockResolvedValue([DRAFT]);
    processAllEvidencesThroughQuarantine.mockResolvedValue({ success: true, processedEvidences: [{ sanitizedUrl: 'https://cdn.example/protegida.jpg' }] });
    createCitizenReport.mockResolvedValue({ success: true, data: { id: 'rep-1' } });
    attachReportEvidence.mockResolvedValue({ success: true });

    const result = await syncPendingReports({ userId: 'user-1' });

    expect(result.sent).toBe(1);
    expect(createCitizenReport).toHaveBeenCalledWith(expect.objectContaining({ clientSideId: 'draft-1', localityId: 'loc-1', serviceId: 'srv-1' }));
    expect(attachReportEvidence).toHaveBeenCalledWith({ reportId: 'rep-1', sanitizedUrl: 'https://cdn.example/protegida.jpg' });
    expect(deleteDraftReport).toHaveBeenCalledWith('draft-1');
  });

  it('UT-B4-02: privacidad (H-30) — si la foto no salió protegida del servidor, no se envía nada y el borrador queda en cola', async () => {
    processAllEvidencesThroughQuarantine.mockResolvedValue({ success: true, processedEvidences: [{ sanitizedUrl: 'blob:http://localhost/solo-exif' }] });

    const result = await sendPendingDraft(DRAFT, 'user-1');

    expect(result.success).toBe(false);
    expect(createCitizenReport).not.toHaveBeenCalled();
    expect(attachReportEvidence).not.toHaveBeenCalled();
    expect(deleteDraftReport).not.toHaveBeenCalled();
  });

  it('UT-B4-03: sin conexión no intenta enviar y informa cuántos quedan', async () => {
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
    getAllPendingSyncReports.mockResolvedValue([DRAFT, { ...DRAFT, client_side_id: 'draft-2' }]);

    const result = await syncPendingReports({ userId: 'user-1' });

    expect(result).toMatchObject({ sent: 0, remaining: 2, offline: true });
    expect(processAllEvidencesThroughQuarantine).not.toHaveBeenCalled();
  });

  it('UT-B4-04: M20 lista los pendientes con su estado y el reintento manual', async () => {
    getAllPendingSyncReports.mockResolvedValue([DRAFT]);
    render(<MemoryRouter><PendingReportsPage /></MemoryRouter>);

    expect(await screen.findByText('Contenedor desbordado')).toBeInTheDocument();
    expect(screen.getByText('1 reporte guardado en este teléfono')).toBeInTheDocument();
    expect(screen.getByText('Falta protegerse la foto: requiere conexión.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reintentar ahora/i })).toBeInTheDocument();
  });

  it('UT-B4-05: M23 ofrece el enlace al email de la sesión vencida y avisa del borrador guardado', async () => {
    markSessionActive('vecina@example.org');
    const { signInWithMagicLink } = useAuth();
    render(<MemoryRouter><SessionExpiredPage /></MemoryRouter>);

    expect(screen.getByText('Tu sesión venció')).toBeInTheDocument();
    expect(screen.getByText('a vecina@example.org')).toBeInTheDocument();
    expect(await screen.findByText('Tu reporte en curso quedó guardado como borrador.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /enviarme un enlace/i }));
    await waitFor(() => expect(signInWithMagicLink).toHaveBeenCalledWith('vecina@example.org'));
  });

  it('UT-B4-06: M22 muestra el aviso sin GPS con reintento; con permiso bloqueado no ofrece reintento', () => {
    const onRetryGps = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <AdjustLocationModal initialCoordinates={{ lat: -34.66, lng: -58.36 }} isGpsUnavailable onRetryGps={onRetryGps} onClose={vi.fn()} onConfirm={vi.fn()} />
    );
    expect(screen.getByText('No encontramos tu ubicación')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /volver a intentar con gps/i }));
    expect(onRetryGps).toHaveBeenCalledTimes(1);

    rerender(
      <AdjustLocationModal initialCoordinates={{ lat: -34.66, lng: -58.36 }} isGpsUnavailable isGpsDenied onRetryGps={onRetryGps} onClose={vi.fn()} onConfirm={vi.fn()} />
    );
    expect(screen.getByText(/permiso de ubicación está bloqueado/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /volver a intentar con gps/i })).not.toBeInTheDocument();
  });
});
