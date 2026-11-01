/**
 * @file Rep3843Envio.test.js
 * @description REP-3843: el alta guarda la dirección aproximada cuando existe y la manda vacía cuando no; nunca
 * bloquea el envío por falta de dirección.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

let enviado = null;
vi.mock('../lib/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: () => ({
      upsert: (fila) => {
        enviado = fila;
        return { select: () => ({ maybeSingle: async () => ({ data: { id: 'r1', client_side_id: 'c1' }, error: null, status: 201 }) }) };
      },
    }),
  },
}));

import { createCitizenReport, toAddressColumns } from '../services/reportSubmissionService';

const BASE = { clientSideId: 'c1', userId: 'u1', serviceId: 's1', localityId: 'l1', description: 'Bache enorme en la esquina', latitud: -34.6, longitud: -58.4 };

describe('REP-3843 · alta con dirección aproximada', () => {
  beforeEach(() => {
    enviado = null;
  });

  it('UT-3843-E1: con dirección sugerida guarda calle, altura, tipo de vía y origen', async () => {
    const res = await createCitizenReport({
      ...BASE,
      address: { street: 'Avenida Bartolomé Mitre', number: '745', roadType: 'avenida', source: 'sugerida' },
    });
    expect(res.success).toBe(true);
    expect(enviado).toMatchObject({
      address_street: 'Avenida Bartolomé Mitre',
      address_number: '745',
      address_road_type: 'avenida',
      address_source: 'sugerida',
    });
  });

  it('UT-3843-E2: sin dirección el reporte se envía igual, con las columnas vacías', async () => {
    const res = await createCitizenReport({ ...BASE });
    expect(res.success).toBe(true);
    expect(enviado).toMatchObject({ address_street: null, address_number: null, address_road_type: null, address_source: null });
  });

  it('UT-3843-E3: limpia lo que la base rechazaría en vez de fallar el envío', () => {
    // Altura que no es número de puerta → vacía; sin calle → todo vacío; tipo recalculado si el vecino cambió la calle
    expect(toAddressColumns({ street: '  Jean Jaures ', number: '1200 bis', roadType: 'secundaria', source: 'corregida' })).toEqual({
      address_street: 'Jean Jaures', address_number: null, address_road_type: 'secundaria', address_source: 'corregida',
    });
    expect(toAddressColumns({ street: '   ', number: '745' })).toEqual({
      address_street: null, address_number: null, address_road_type: null, address_source: null,
    });
    expect(toAddressColumns({ street: 'Av. Corrientes', number: '1234', source: 'corregida' }).address_road_type).toBe('avenida');
  });
});
