import { describe, it, expect, vi, beforeEach } from 'vitest';

// Supabase mockeado: el servicio solo usa el backend real si detecta el mock de storage.from
vi.mock('../lib/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: { getSession: vi.fn() },
    storage: { from: vi.fn() },
  },
}));

import { supabase } from '../lib/supabaseClient';
import { uploadToQuarantine } from '../services/quarantinePipelineService';

// REP-2501: la política de Storage y la Edge Function solo aceptan la carpeta del propio usuario
describe('REP-2501: uploadToQuarantine sube a la carpeta del usuario', () => {
  const USER_ID = '3f6c1c1e-8f0a-4b0e-9d5c-1a2b3c4d5e6f';
  const CLIENT_SIDE_ID = '11111111-2222-3333-4444-555555555555';
  const upload = vi.fn(async (path) => ({ data: { path }, error: null }));
  const foto = new Blob(['jpeg'], { type: 'image/jpeg' });

  beforeEach(() => {
    vi.clearAllMocks();
    supabase.storage.from.mockReturnValue({ upload });
  });

  it('UT-QUP-01: la ruta empieza con el id del usuario con sesión', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: USER_ID } } } });

    const result = await uploadToQuarantine(foto, CLIENT_SIDE_ID);

    expect(result.success).toBe(true);
    expect(result.quarantinePath).toMatch(new RegExp(`^${USER_ID}/temp_${CLIENT_SIDE_ID}_\\d+\\.`));
    expect(upload).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`^${USER_ID}/`)),
      foto,
      expect.anything()
    );
  });

  it('UT-QUP-02: sin sesión no sube a la cuarentena', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } });

    const result = await uploadToQuarantine(foto, CLIENT_SIDE_ID);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/sesión/i);
    expect(upload).not.toHaveBeenCalled();
  });

  it('UT-QUP-03: si no se puede leer la sesión tampoco sube', async () => {
    supabase.auth.getSession.mockRejectedValue(new Error('sin red'));

    const result = await uploadToQuarantine(foto, CLIENT_SIDE_ID);

    expect(result.success).toBe(false);
    expect(upload).not.toHaveBeenCalled();
  });
});
