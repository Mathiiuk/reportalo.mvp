import React, { useContext } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

/**
 * Arranque y envío con poca señal: la sesión guardada abre la app sin esperar a la red,
 * y un reporte que no se puede enviar a tiempo queda en la cola de pendientes.
 */

const STORAGE_KEY = 'sb-test-auth-token';

// Supabase simulado: getSession nunca responde, como con señal muy débil
const authCallbacks = [];
vi.mock('../lib/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      storageKey: 'sb-test-auth-token',
      getSession: vi.fn(() => new Promise(() => {})),
      onAuthStateChange: vi.fn((cb) => {
        authCallbacks.push(cb);
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

vi.mock('../services/termsService', () => ({
  syncTermsConsentWithRemote: vi.fn().mockResolvedValue(undefined),
}));

// La cola de pendientes se controla desde el test
const syncPendingReports = vi.fn();
vi.mock('../services/pendingSyncService', () => ({
  syncPendingReports: (...args) => syncPendingReports(...args),
}));

import { readStoredSession } from '../lib/storedSession';
import { AuthContext, AuthProvider } from '../context/AuthContext';
import { ReportProcessingScreen } from '../components/report/ReportProcessingScreen';
import {
  PendingSyncManager,
  PENDING_QUEUED_EVENT,
  PENDING_RETRY_INTERVAL_MS,
} from '../components/common/PendingSyncManager';

const storedSession = {
  access_token: 'token-vencido',
  refresh_token: 'refresh-token',
  expires_at: Math.floor(Date.now() / 1000) - 3600,
  user: { id: 'user-123', email: 'vecino@example.com' },
};

const saveSession = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(storedSession));

describe('Sesión guardada: la app abre sin esperar a la red', () => {
  beforeEach(() => {
    localStorage.clear();
    authCallbacks.length = 0;
  });

  it('UT-SENAL-01: lee la sesión que dejó supabase-js en el teléfono', () => {
    saveSession();
    expect(readStoredSession()?.user.id).toBe('user-123');
  });

  it('UT-SENAL-02: sin sesión, con JSON roto o sin refresh_token devuelve null', () => {
    expect(readStoredSession()).toBeNull();
    localStorage.setItem(STORAGE_KEY, '{roto');
    expect(readStoredSession()).toBeNull();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...storedSession, refresh_token: undefined }));
    expect(readStoredSession()).toBeNull();
  });

  const Probe = () => {
    const { loading, session } = useContext(AuthContext);
    return <div data-testid="probe">{loading ? 'cargando' : session?.user?.id ?? 'sin-sesion'}</div>;
  };

  it('UT-SENAL-03: con sesión guardada entra de inmediato aunque getSession no responda', () => {
    saveSession();
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    expect(screen.getByTestId('probe')).toHaveTextContent('user-123');
  });

  it('UT-SENAL-04: sin red auth-js avisa null, pero la sesión guardada se mantiene', () => {
    saveSession();
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    act(() => authCallbacks.forEach((cb) => cb('INITIAL_SESSION', null)));
    expect(screen.getByTestId('probe')).toHaveTextContent('user-123');
  });

  it('UT-SENAL-05: si la sesión se cerró de verdad (SIGNED_OUT), se sale', () => {
    saveSession();
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    localStorage.removeItem(STORAGE_KEY);
    act(() => authCallbacks.forEach((cb) => cb('SIGNED_OUT', null)));
    expect(screen.getByTestId('probe')).toHaveTextContent('sin-sesion');
  });

  it('UT-SENAL-06: sin sesión guardada se espera a Supabase como antes', () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    expect(screen.getByTestId('probe')).toHaveTextContent('cargando');
  });
});

describe('Envío con señal débil: la protección de fotos no deja trabado al ciudadano', () => {
  it('UT-SENAL-07: si el pipeline no termina a tiempo, el reporte pasa a la cola', async () => {
    const onSaveForLater = vi.fn();
    const onProcessingComplete = vi.fn();
    render(
      <ReportProcessingScreen
        evidenceList={[{ previewUrl: 'blob:foto' }]}
        processFn={() => new Promise(() => {})}
        durationMs={50}
        timeoutMs={200}
        onSaveForLater={onSaveForLater}
        onProcessingComplete={onProcessingComplete}
      />
    );
    await waitFor(() => expect(onSaveForLater).toHaveBeenCalledTimes(1), { timeout: 1000 });
    expect(onProcessingComplete).not.toHaveBeenCalled();
  });

  it('UT-SENAL-08: un resultado que llega después de pasar a la cola se ignora', async () => {
    const onSaveForLater = vi.fn();
    const onProcessingComplete = vi.fn();
    render(
      <ReportProcessingScreen
        evidenceList={[{ previewUrl: 'blob:foto' }]}
        processFn={() =>
          new Promise((resolve) => setTimeout(() => resolve({ success: true, processedEvidences: [] }), 400))
        }
        durationMs={50}
        timeoutMs={150}
        onSaveForLater={onSaveForLater}
        onProcessingComplete={onProcessingComplete}
      />
    );
    await waitFor(() => expect(onSaveForLater).toHaveBeenCalledTimes(1), { timeout: 1000 });
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(onProcessingComplete).not.toHaveBeenCalled();
  });

  it('UT-SENAL-09: si la protección falla, ofrece guardarlo para enviar cuando haya señal', async () => {
    const onSaveForLater = vi.fn();
    render(
      <ReportProcessingScreen
        evidenceList={[{ previewUrl: 'blob:foto' }]}
        processFn={() => Promise.resolve({ success: false, error: 'Failed to fetch' })}
        durationMs={50}
        timeoutMs={300}
        onSaveForLater={onSaveForLater}
        onProcessingComplete={vi.fn()}
      />
    );
    const button = await screen.findByRole('button', { name: /guardar y enviar cuando haya señal/i });
    // Mostrado el error, la espera máxima ya no manda el reporte a la cola por su cuenta
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(onSaveForLater).not.toHaveBeenCalled();
    fireEvent.click(button);
    expect(onSaveForLater).toHaveBeenCalledTimes(1);
  });
});

vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-123' } }) }));
vi.mock('../hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isOnline: true }) }));

describe('Cola de pendientes: se reintenta sola aunque el teléfono nunca pase por offline', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    syncPendingReports.mockReset();
    syncPendingReports.mockResolvedValue({ sent: 0, failed: 0, remaining: 0, offline: false, errors: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('UT-SENAL-10: un reporte que entra a la cola arranca el reintento periódico', async () => {
    render(<PendingSyncManager />);
    await act(async () => {});
    expect(syncPendingReports).toHaveBeenCalledTimes(1);

    // Sin pendientes no se reintenta
    await act(async () => {
      vi.advanceTimersByTime(PENDING_RETRY_INTERVAL_MS);
    });
    expect(syncPendingReports).toHaveBeenCalledTimes(1);

    act(() => {
      window.dispatchEvent(new Event(PENDING_QUEUED_EVENT));
    });
    await act(async () => {
      vi.advanceTimersByTime(PENDING_RETRY_INTERVAL_MS);
    });
    expect(syncPendingReports).toHaveBeenCalledTimes(2);
  });

  it('UT-SENAL-11: mientras queden pendientes sigue reintentando', async () => {
    syncPendingReports.mockResolvedValue({ sent: 0, failed: 1, remaining: 1, offline: false, errors: [] });
    render(<PendingSyncManager />);
    await act(async () => {});
    await act(async () => {
      vi.advanceTimersByTime(PENDING_RETRY_INTERVAL_MS);
    });
    await act(async () => {
      vi.advanceTimersByTime(PENDING_RETRY_INTERVAL_MS);
    });
    expect(syncPendingReports).toHaveBeenCalledTimes(3);
  });

  it('UT-SENAL-12: al volver a la app se reintenta enseguida', async () => {
    render(<PendingSyncManager />);
    await act(async () => {});
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(syncPendingReports).toHaveBeenCalledTimes(2);
  });
});
