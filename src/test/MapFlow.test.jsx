import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { toast } from 'sonner';
import { AppLayout } from '../components/layout/AppLayout';
import { CitizenMap } from '../components/map/CitizenMap';
import { MapPage } from '../pages/MapPage';
import { ReportsPage } from '../pages/ReportsPage';
import { NewsPage } from '../pages/NewsPage';
import { ProfilePage } from '../pages/ProfilePage';
import { AuthContext } from '../context/AuthContext';

// Mock de sonner
vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
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
    })),
    GeolocateControl: vi.fn(),
    Marker: vi.fn(({ element } = {}) => {
      if (element && typeof document !== 'undefined') {
        document.body.appendChild(element);
      }
      return {
        setLngLat: vi.fn().mockReturnThis(),
        addTo: vi.fn().mockReturnThis(),
        remove: vi.fn(() => {
          if (element && element.parentNode) {
            element.parentNode.removeChild(element);
          }
        }),
      };
    }),
  };
});

describe('REP-2600: Visualizar /mapa como pantalla principal ciudadana', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  const mockAuthContext = {
    session: { user: { id: 'usr-123', email: 'vecino@reportalo.com.ar' } },
    user: { id: 'usr-123', email: 'vecino@reportalo.com.ar' },
    loading: false,
    signOut: vi.fn(),
  };

  it('UT-MP-01: Renderiza el Header de AppLayout con logo, título y campana de notificaciones con badge', () => {
    render(
      <MemoryRouter initialEntries={['/mapa']}>
        <AppLayout activeTab="mapa">
          <div>Contenido de Mapa</div>
        </AppLayout>
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: /reportalo/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ver alertas y notificaciones/i })).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('UT-MP-02: Renderiza los 5 botones de navegación en la barra inferior flotante (Mapa, Reportes, Cámara, Alertas, Perfil)', () => {
    render(
      <MemoryRouter initialEntries={['/mapa']}>
        <AppLayout activeTab="mapa">
          <div>Contenido</div>
        </AppLayout>
      </MemoryRouter>
    );

    const nav = screen.getByRole('navigation', { name: /navegación principal/i });
    expect(within(nav).getByRole('button', { name: /mapa/i })).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: /reportes/i })).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: /tomar foto y reportar/i })).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: /alertas/i })).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: /perfil/i })).toBeInTheDocument();
  });

  it('UT-MP-03: CitizenMap renderiza el contenedor MapLibre, botón de filtros y leyenda Menos/Más', () => {
    render(<CitizenMap />);

    expect(screen.getByTestId('maplibre-container')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filtros del mapa/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /centrar en mi ubicación/i })).toBeInTheDocument();
    expect(screen.getByText('Menos')).toBeInTheDocument();
    expect(screen.getByText('Más')).toBeInTheDocument();
  });

  it('UT-MP-04: ReportsPage renderiza el empty state con ilustración, mensaje de calma, píldoras y botón Cargar demo', () => {
    render(
      <MemoryRouter initialEntries={['/reportes']}>
        <ReportsPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /mis reportes/i, level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cargar demo/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /aún no has reportado nada/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /explorar mapa/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ver reportes de ejemplo/i })).toBeInTheDocument();

    // Activar modo demo
    fireEvent.click(screen.getByRole('button', { name: /ver reportes de ejemplo/i }));
    expect(screen.getByText(/bache en calzada principal/i)).toBeInTheDocument();
  });

  it('UT-MP-05: NewsPage renderiza el listado de novedades municipales', () => {
    render(
      <MemoryRouter initialEntries={['/alertas']}>
        <NewsPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /novedades/i, level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/reparación de calzada finalizada/i)).toBeInTheDocument();
    expect(screen.getByText(/nuevo operativo de recolección/i)).toBeInTheDocument();
  });

  it('UT-MP-06: ProfilePage renderiza los datos del usuario, versión vigente y botón de cerrar sesión', () => {
    render(
      <AuthContext.Provider value={mockAuthContext}>
        <MemoryRouter initialEntries={['/perfil']}>
          <ProfilePage />
        </MemoryRouter>
      </AuthContext.Provider>
    );

    expect(screen.getByRole('heading', { name: /mi perfil/i, level: 1 })).toBeInTheDocument();
    expect(screen.getByText('vecino@reportalo.com.ar')).toBeInTheDocument();
    expect(screen.getByText(/v1.3/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cerrar sesión/i })).toBeInTheDocument();
  });

  it('UT-MP-07: Permite alternar vistas navegando entre pestañas', () => {
    render(
      <AuthContext.Provider value={mockAuthContext}>
        <MemoryRouter initialEntries={['/mapa']}>
          <Routes>
            <Route path="/mapa" element={<MapPage />} />
            <Route path="/reportes" element={<ReportsPage />} />
            <Route path="/alertas" element={<NewsPage />} />
            <Route path="/perfil" element={<ProfilePage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    // Clic en Reportes en la barra de navegación
    const nav = screen.getByRole('navigation', { name: /navegación principal/i });
    const reportsBtn = within(nav).getByRole('button', { name: /reportes/i });
    fireEvent.click(reportsBtn);
    expect(screen.getByRole('heading', { name: /mis reportes/i })).toBeInTheDocument();

    // Clic en Alertas en la barra de navegación
    const navAfter = screen.getByRole('navigation', { name: /navegación principal/i });
    const alertsBtn = within(navAfter).getByRole('button', { name: /alertas/i });
    fireEvent.click(alertsBtn);
    expect(screen.getByRole('heading', { name: /novedades/i })).toBeInTheDocument();

    // Clic en Perfil en la barra de navegación
    const navProfile = screen.getByRole('navigation', { name: /navegación principal/i });
    const profileBtn = within(navProfile).getByRole('button', { name: /perfil/i });
    fireEvent.click(profileBtn);
    expect(screen.getByRole('heading', { name: /mi perfil/i })).toBeInTheDocument();
  });

  it('UT-MP-08: Renderiza marcadores de reportes de prueba sobre el mapa', async () => {
    render(<CitizenMap />);

    await waitFor(() => {
      expect(screen.getByTestId('marker-REP-101')).toBeInTheDocument();
      expect(screen.getByTestId('marker-REP-102')).toBeInTheDocument();
      expect(screen.getByTestId('marker-REP-103')).toBeInTheDocument();
    });
  });

  it('UT-MP-09: Al hacer clic en un pin, despliega la tarjeta flotante con categoría, título y estado', async () => {
    render(<CitizenMap />);

    const markerBtn = await screen.findByTestId('marker-REP-101');
    fireEvent.click(markerBtn);

    await waitFor(() => {
      expect(screen.getByText(/Infraestructura vial/i)).toBeInTheDocument();
      expect(screen.getByText(/Bache profundo en calzada principal/i)).toBeInTheDocument();
      expect(screen.getByText(/Av. Corrientes 1050, San Nicolás/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cerrar detalle de reporte/i })).toBeInTheDocument();
    });

    // Cerrar tarjeta
    fireEvent.click(screen.getByRole('button', { name: /cerrar detalle de reporte/i }));
    await waitFor(() => {
      expect(screen.queryByText(/Bache profundo en calzada principal/i)).not.toBeInTheDocument();
    });
  });

  it('UT-MP-10: Filtrado reactivo de reportes en el mapa y mensaje de estado vacío al filtrar', async () => {
    render(<CitizenMap />);

    // Abrir menú de filtros
    fireEvent.click(screen.getByRole('button', { name: /filtros del mapa/i }));
    expect(screen.getByText(/Filtrar reclamos/i)).toBeInTheDocument();

    // Seleccionar filtro "En curso"
    fireEvent.click(screen.getByRole('button', { name: /^En curso$/i }));

    await waitFor(() => {
      expect(screen.getByTestId('marker-REP-101')).toBeInTheDocument();
      expect(screen.getByTestId('marker-REP-104')).toBeInTheDocument();
      expect(screen.queryByTestId('marker-REP-102')).not.toBeInTheDocument(); // Enviado no debe aparecer
    });
  });

  it('UT-MP-11: Clic en el botón central de cámara notifica que la creación se habilitará en Sprint 11', () => {
    render(
      <MemoryRouter initialEntries={['/mapa']}>
        <AppLayout activeTab="mapa">
          <div>Contenido</div>
        </AppLayout>
      </MemoryRouter>
    );

    const cameraBtn = screen.getByRole('button', { name: /tomar foto y reportar/i });
    fireEvent.click(cameraBtn);

    expect(toast.info).toHaveBeenCalledWith(
      'Creación de reportes disponible en Sprint 11',
      expect.objectContaining({
        description: expect.stringContaining('Sprint 11'),
      })
    );
  });
});
