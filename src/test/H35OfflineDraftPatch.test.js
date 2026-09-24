/**
 * @file H35OfflineDraftPatch.test.js
 * @description H-35: actualizar un borrador de la cola (completar la descripción, guardar el motivo del último
 * fallo) sin perder las fotos ni cambiar la fecha que se le muestra al ciudadano. IndexedDB real (fake-indexeddb).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  clearAllDrafts,
  saveDraftReport,
  getDraftReport,
  getAllPendingSyncReports,
  updateDraftReport,
  recordDraftSyncError,
  DRAFT_STATUS,
} from '../services/offlineStorageService';

const foto = () => new Blob(['foto-original'], { type: 'image/jpeg' });

const guardarPendiente = (extra = {}) =>
  saveDraftReport({
    client_side_id: 'draft-h35',
    status: DRAFT_STATUS.PENDING_SYNC,
    description: '',
    selectedCategory: { id: 'AMBIENTE', name: 'Ambiente' },
    customLocation: { localityId: 'loc-1' },
    evidenceList: [{ id: 'e1', name: 'f.jpg', mimeType: 'image/jpeg', file: foto() }],
    createdAt: '2026-09-01T10:00:00.000Z',
    ...extra,
  });

describe('H-35: updateDraftReport y recordDraftSyncError', () => {
  beforeEach(async () => {
    await clearAllDrafts();
  });

  it('UT-H35-10: completar la descripción conserva las fotos y sigue en la cola', async () => {
    await guardarPendiente();

    const updated = await updateDraftReport('draft-h35', { description: 'Contenedor desbordado' });

    expect(updated.description).toBe('Contenedor desbordado');
    const stored = await getDraftReport('draft-h35');
    expect(stored.evidenceList).toHaveLength(1);
    expect(stored.evidenceList[0].blob).toBeTruthy();
    const pendientes = await getAllPendingSyncReports();
    expect(pendientes.map((d) => d.client_side_id)).toEqual(['draft-h35']);
  });

  it('UT-H35-11: al editar el borrador se borra el motivo del fallo anterior', async () => {
    await guardarPendiente();
    await recordDraftSyncError('draft-h35', { code: 'DESCRIPTION', kind: 'invalid', message: 'Escribí una descripción.' });

    const updated = await updateDraftReport('draft-h35', { description: 'Contenedor desbordado' });

    expect(updated.lastSyncError).toBeNull();
  });

  it('UT-H35-12: guarda el motivo del último fallo con su fecha, y sobrevive a releer el borrador', async () => {
    await guardarPendiente();

    await recordDraftSyncError('draft-h35', { code: 'DESCRIPTION', kind: 'invalid', message: 'Escribí una descripción.' });

    const [pendiente] = await getAllPendingSyncReports();
    expect(pendiente.lastSyncError).toMatchObject({ code: 'DESCRIPTION', kind: 'invalid', message: 'Escribí una descripción.' });
    expect(Number.isNaN(Date.parse(pendiente.lastSyncError.at))).toBe(false);
  });

  it('UT-H35-13: registrar un fallo NO cambia la fecha de actualización del borrador', async () => {
    const guardado = await guardarPendiente();
    await new Promise((resolve) => setTimeout(resolve, 15));

    await recordDraftSyncError('draft-h35', { code: 'DESCRIPTION', kind: 'invalid', message: 'x' });

    const stored = await getDraftReport('draft-h35');
    expect(stored.updatedAt).toBe(guardado.updatedAt);
  });

  it('UT-H35-14: conserva las fotos al registrar el fallo', async () => {
    await guardarPendiente();
    await recordDraftSyncError('draft-h35', { code: 'CATEGORY', kind: 'invalid', message: 'x' });

    const stored = await getDraftReport('draft-h35');
    expect(stored.evidenceList[0].blob).toBeTruthy();
  });

  it('UT-H35-15: sobre un borrador que no existe devuelve null y no crea nada', async () => {
    expect(await updateDraftReport('no-existe', { description: 'algo suficientemente largo' })).toBeNull();
    expect(await recordDraftSyncError('no-existe', { code: 'X', kind: 'invalid', message: 'x' })).toBeNull();
    expect(await getAllPendingSyncReports()).toEqual([]);
  });
});
