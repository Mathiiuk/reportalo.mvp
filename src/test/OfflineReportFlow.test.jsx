/**
 * @file OfflineReportFlow.test.jsx
 * @description Pruebas de integración del flujo de reporte en modo offline con IndexedDB (REP-2703).
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NewReportPage } from '../pages/NewReportPage';
import {
  clearAllDrafts,
  saveDraftReport,
  getDraftReport,
  getAllPendingSyncReports,
  DRAFT_STATUS,
} from '../services/offlineStorageService';
import { EVIDENCE_STATUS } from '../types/evidence';

// Mock de useAuth para simular usuario autenticado
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-test-123', email: 'ciudadano@reportalo.ar' },
    isAuthenticated: true,
  }),
}));

// Mock de useGeolocation para coordenadas fijas
vi.mock('../hooks/useGeolocation', () => ({
  useGeolocation: () => ({
    coordinates: { lat: -34.6037, lng: -58.3816, accuracy: 10 },
    loading: false,
    error: null,
  }),
}));

// Mock de termsService para consentimientos
vi.mock('../services/termsService', () => ({
  hasAcceptedCurrentTerms: () => true,
  recordTermsAcceptance: vi.fn().mockResolvedValue({ success: true }),
}));

describe('REP-2703: Flujo de Reporte Ciudadano Offline con IndexedDB', () => {
  beforeEach(async () => {
    // Limpiamos los borradores de IndexedDB antes de cada test
    await clearAllDrafts();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('UT-OFF-FLOW-01: Restaura automáticamente un borrador existente de IndexedDB al montar', async () => {
    // Preparamos un borrador previo en IndexedDB en Paso 2
    const fakeBlob = new Blob(['foto anterior'], { type: 'image/jpeg' });
    await saveDraftReport({
      client_side_id: 'borrador-previo-uuid',
      currentStep: 2,
      description: 'Basural a cielo abierto en vereda',
      selectedCategory: { id: 'cat-3', name: 'Medio ambiente', color: '#10B981', bgLight: '#ECFDF5' },
      evidenceList: [
        {
          id: 'ev-prev-1',
          name: 'basura.jpg',
          file: fakeBlob,
          sizeBytes: fakeBlob.size,
          mimeType: 'image/jpeg',
          status: EVIDENCE_STATUS.CAPTURED_LOCAL,
        },
      ],
    });

    // Renderizamos NewReportPage
    render(
      <MemoryRouter initialEntries={['/nuevo-reporte']}>
        <NewReportPage />
      </MemoryRouter>
    );

    // Esperamos a que se restaure la descripción en el Paso 2
    await waitFor(() => {
      expect(screen.getByDisplayValue('Basural a cielo abierto en vereda')).toBeInTheDocument();
    });
  });

  it('UT-OFF-FLOW-02: Detecta evento offline y despliega banner informativo de PENDING_SYNC', async () => {
    render(
      <MemoryRouter initialEntries={['/nuevo-reporte']}>
        <NewReportPage />
      </MemoryRouter>
    );

    // Simulamos la pérdida de conexión disparando el evento offline en window
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    // Verificamos que se muestre el banner superior
    await waitFor(() => {
      const banner = screen.getByTestId('offline-status-banner');
      expect(banner).toBeInTheDocument();
      expect(banner).toHaveTextContent(/Sin conexión/i);
      expect(banner).toHaveTextContent(/PENDING_SYNC/i);
    });
  });

  it('UT-OFF-FLOW-03: En Paso 3 muestra evidencia local pendiente y botón de guardar offline', async () => {
    const fakeBlob = new Blob(['foto-prueba'], { type: 'image/jpeg' });
    const fakeEvidenceList = [
      {
        id: 'foto-1',
        name: 'foto1.jpg',
        file: fakeBlob,
        previewUrl: 'blob:http://localhost/foto1',
        status: EVIDENCE_STATUS.CAPTURED_LOCAL,
      },
    ];

    render(
      <MemoryRouter initialEntries={['/nuevo-reporte']}>
        <NewReportPage initialEvidenceList={fakeEvidenceList} />
      </MemoryRouter>
    );

    // Simulamos la pérdida de conexión después del render
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    // Esperamos a que esté listo el Paso 1
    await waitFor(() => {
      expect(screen.getByTestId('evidence-capture-step')).toBeInTheDocument();
    });

    // Avanzamos del Paso 1 al Paso 2
    const continueButtonPaso1 = screen.getByRole('button', { name: /continuar al siguiente paso/i });
    fireEvent.click(continueButtonPaso1);

    // Esperamos a que aparezca el Paso 2
    await waitFor(() => {
      expect(screen.getByTestId('report-details-step')).toBeInTheDocument();
    });

    // Avanzamos del Paso 2 al Paso 3
    const continueButtonPaso2 = screen.getByRole('button', { name: /^continuar$/i });
    fireEvent.click(continueButtonPaso2);

    // Esperamos a que aparezca el Paso 3
    await waitFor(() => {
      expect(screen.getByTestId('report-review-step')).toBeInTheDocument();
    });

    // En Paso 3 verificamos que el botón de envío indique guardado offline
    const saveOfflineBtn = screen.getByRole('button', { name: /guardar reporte offline/i });
    expect(saveOfflineBtn).toBeInTheDocument();
    expect(saveOfflineBtn).toHaveTextContent(/Guardar reporte \(Offline\)/i);

    // Verificamos el texto de la evidencia local en la tarjeta
    expect(screen.getByText(/Evidencia local \(PENDING_SYNC\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Pendiente de procesar por el servidor/i)).toBeInTheDocument();
  });

  it('UT-OFF-FLOW-04: Al guardar reporte en modo offline, persiste en IndexedDB como PENDING_SYNC', async () => {
    const fakeBlob = new Blob(['foto-offline'], { type: 'image/jpeg' });
    const fakeEvidenceList = [
      {
        id: 'foto-off-1',
        name: 'foto_off.jpg',
        file: fakeBlob,
        previewUrl: 'blob:http://localhost/foto-off',
        status: EVIDENCE_STATUS.CAPTURED_LOCAL,
      },
    ];

    render(
      <MemoryRouter initialEntries={['/nuevo-reporte']}>
        <NewReportPage initialEvidenceList={fakeEvidenceList} />
      </MemoryRouter>
    );

    // Disparamos offline después del render
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    // Esperamos el Paso 1 y avanzamos
    await waitFor(() => {
      expect(screen.getByTestId('evidence-capture-step')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /continuar al siguiente paso/i }));

    // Esperamos el Paso 2 y avanzamos
    await waitFor(() => {
      expect(screen.getByTestId('report-details-step')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /^continuar$/i }));

    // Esperamos el Paso 3
    await waitFor(() => {
      expect(screen.getByTestId('report-review-step')).toBeInTheDocument();
    });

    // Hacemos clic en guardar offline
    const saveBtn = screen.getByRole('button', { name: /guardar reporte offline/i });
    fireEvent.click(saveBtn);

    // Verificamos en IndexedDB que haya quedado un reporte en PENDING_SYNC con la evidencia original
    await waitFor(async () => {
      const pendingList = await getAllPendingSyncReports();
      expect(pendingList.length).toBeGreaterThanOrEqual(1);
      expect(pendingList[0].status).toBe(DRAFT_STATUS.PENDING_SYNC);
      expect(pendingList[0].evidenceList.length).toBe(1);
      expect(pendingList[0].evidenceList[0].name).toBe('foto_off.jpg');
    });
  });
});
