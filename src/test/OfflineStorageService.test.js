/**
 * @file OfflineStorageService.test.js
 * @description Suite de pruebas unitarias para el servicio de persistencia local en IndexedDB (REP-2703).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  openDatabase,
  saveDraftReport,
  getDraftReport,
  getActiveDraftReport,
  markDraftPendingSync,
  deleteDraftReport,
  getAllPendingSyncReports,
  clearAllDrafts,
  DRAFT_STATUS,
  STORE_DRAFTS,
} from '../services/offlineStorageService';
import { EVIDENCE_STATUS } from '../types/evidence';

describe('REP-2703: Servicio de Almacenamiento Offline en IndexedDB', () => {
  // Limpiamos la base de datos antes de cada caso de prueba
  beforeEach(async () => {
    await clearAllDrafts();
  });

  it('UT-OFF-01: Inicializa la base de datos y crea el object store draft_reports con índices', async () => {
    // Abrimos la base de datos
    const db = await openDatabase();

    // Verificamos que la base de datos contenga el almacén de borradores
    expect(db.objectStoreNames.contains(STORE_DRAFTS)).toBe(true);

    // Verificamos los índices configurados
    const transaction = db.transaction([STORE_DRAFTS], 'readonly');
    const store = transaction.objectStore(STORE_DRAFTS);
    expect(store.indexNames.contains('by_status')).toBe(true);
    expect(store.indexNames.contains('by_updatedAt')).toBe(true);
  });

  it('UT-OFF-02: Guarda un borrador con fotografía binaria Blob y asigna client_side_id único', async () => {
    // Creamos un Blob simulando una foto capturada
    const fakeBlob = new Blob(['fake image content'], { type: 'image/jpeg' });

    // Definimos los datos iniciales del reporte
    const draftInput = {
      description: 'Bache peligroso en la esquina',
      selectedCategory: { id: 'cat-1', name: 'Infraestructura vial' },
      geolocation: { lat: -34.6037, lng: -58.3816 },
      evidenceList: [
        {
          id: 'foto-1',
          name: 'bache.jpg',
          file: fakeBlob,
          sizeBytes: fakeBlob.size,
          mimeType: 'image/jpeg',
        },
      ],
    };

    // Guardamos el borrador
    const saved = await saveDraftReport(draftInput);

    // Validamos que se haya generado el identificador único UUID
    expect(saved.client_side_id).toBeDefined();
    expect(typeof saved.client_side_id).toBe('string');
    expect(saved.status).toBe(DRAFT_STATUS.DRAFT_LOCAL);
    expect(saved.isProcessedByBackend).toBe(false);

    // Validamos que la evidencia conserve el blob binario
    expect(saved.evidenceList.length).toBe(1);
    expect(saved.evidenceList[0].blob).toBeDefined();
    expect(saved.evidenceList[0].status).toBe(EVIDENCE_STATUS.CAPTURED_LOCAL);
  });

  it('UT-OFF-03: Recupera un borrador existente por su client_side_id', async () => {
    // Guardamos un borrador
    const saved = await saveDraftReport({
      client_side_id: '11111111-1111-4111-8111-111111111111',
      description: 'Semáforo apagado en Av. Mitre',
    });

    // Consultamos por clave primaria
    const retrieved = await getDraftReport('11111111-1111-4111-8111-111111111111');

    // Comprobamos la coincidencia exacta
    expect(retrieved).not.toBeNull();
    expect(retrieved.client_side_id).toBe('11111111-1111-4111-8111-111111111111');
    expect(retrieved.description).toBe('Semáforo apagado en Av. Mitre');
  });

  it('UT-OFF-04: Obtiene el borrador activo más reciente ante recarga', async () => {
    // Guardamos primer borrador
    await saveDraftReport({
      client_side_id: 'draft-antiguo',
      description: 'Reporte 1',
    });

    // Esperamos un breve intervalo para asegurar marca de tiempo posterior
    await new Promise((r) => setTimeout(r, 10));

    // Guardamos segundo borrador
    await saveDraftReport({
      client_side_id: 'draft-reciente',
      description: 'Reporte 2 reciente',
    });

    // Consultamos el borrador activo
    const active = await getActiveDraftReport();

    // Debe ser el más reciente
    expect(active).not.toBeNull();
    expect(active.client_side_id).toBe('draft-reciente');
    expect(active.description).toBe('Reporte 2 reciente');
  });

  it('UT-OFF-05: Transiciona el estado del borrador y sus fotos a PENDING_SYNC al perder conexión', async () => {
    const fakeBlob = new Blob(['foto evidencia'], { type: 'image/jpeg' });
    const draft = await saveDraftReport({
      client_side_id: 'draft-offline-1',
      evidenceList: [{ id: 'f1', file: fakeBlob }],
    });

    // Marcamos como pendiente de sincronización
    const updated = await markDraftPendingSync(draft.client_side_id);

    // Verificamos la transición de estado en el reporte y en la evidencia
    expect(updated.status).toBe(DRAFT_STATUS.PENDING_SYNC);
    expect(updated.evidenceList[0].status).toBe(EVIDENCE_STATUS.PENDING_SYNC);
  });

  it('UT-OFF-06: Lista todos los reportes guardados que están en espera de sincronización', async () => {
    // Guardamos un borrador normal y dos pendientes de sincronización
    await saveDraftReport({ client_side_id: 'd1', status: DRAFT_STATUS.DRAFT_LOCAL });
    await saveDraftReport({ client_side_id: 'd2', status: DRAFT_STATUS.PENDING_SYNC });
    await saveDraftReport({ client_side_id: 'd3', status: DRAFT_STATUS.PENDING_SYNC });

    const pending = await getAllPendingSyncReports();

    // Deben ser exactamente 2
    expect(pending.length).toBe(2);
    const ids = pending.map((p) => p.client_side_id);
    expect(ids).toContain('d2');
    expect(ids).toContain('d3');
    expect(ids).not.toContain('d1');
  });

  it('UT-OFF-07: Elimina el borrador de IndexedDB al cancelarse o post-sincronización exitosa', async () => {
    // Guardamos borrador
    await saveDraftReport({ client_side_id: 'draft-para-borrar', description: 'Temporal' });

    // Eliminamos
    const deleted = await deleteDraftReport('draft-para-borrar');
    expect(deleted).toBe(true);

    // Comprobamos que ya no exista
    const check = await getDraftReport('draft-para-borrar');
    expect(check).toBeNull();
  });
});
