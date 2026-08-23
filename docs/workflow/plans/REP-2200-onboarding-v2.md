# Plan de Implementación Técnica — REP-2200: Reportalo V2 Onboarding y Autenticación

---

## 1. Arquitectura y Stack Tecnológico V2

* **Framework Base:** React 18 + Vite 6 + React Router 7.
* **Estilos y Tokens:** Tailwind CSS con paleta V2 (`primary: #249EE1`, `primary-dark: #266AA6`, `accent: #F88F37`, `background: #F8F9FA`).
* **Autenticación:** `@supabase/supabase-js` con persistencia en `localStorage` y soporte para Email/Password y Google OAuth.
* **Mapa Base:** `maplibre-gl` con tiles de demostración gratuitos.
* **Notificaciones:** `sonner` (Toasts interactivos y accesibles).
* **Formularios & Validación:** `react-hook-form`.
* **Animaciones:** `framer-motion` para el colapso suave de Login/Registro.

---

## 2. Mapa de Archivos Desarrollados

```
src/
├── main.jsx                       # Providers de Auth, Onboarding, Router y Toaster
├── App.jsx                        # Enrutador principal
├── routes/
│   ├── index.jsx                  # Rutas públicas y privadas
│   └── ProtectedRoute.jsx         # Guardián de sesión y onboarding
├── pages/
│   ├── HomePage.jsx               # Landing con Hero, 3 beneficios y AuthCollapse
│   ├── PermisosPage.jsx           # Solicitud de Cámara y GPS con PrivacyBlock
│   └── MapaPage.jsx               # Render del mapa MapLibre GL JS
├── components/
│   ├── auth/
│   │   ├── LoginForm.jsx          # Login con react-hook-form y Google OAuth
│   │   ├── RegisterForm.jsx       # Registro con validaciones, T&C obligatorio y Google OAuth
│   │   └── AuthCollapse.jsx       # Acordeón animado con framer-motion
│   ├── permisos/
│   │   ├── PermisoCard.jsx        # Tarjeta de permiso individual
│   │   └── PrivacyBlock.jsx       # Bloque destacado de difuminado facial
│   ├── common/
│   │   ├── Logo.jsx               # Render optimizado de logo
│   │   ├── Button.jsx             # Botón accesible (52-56px, rounded-2xl)
│   │   ├── Input.jsx              # Input con label, validación y eye toggle
│   │   └── Spinner.jsx            # Indicador de carga
│   └── ui/
│       └── Modal.jsx              # Modal para Términos y Condiciones
├── context/
│   ├── AuthContext.jsx            # Contexto de Supabase Auth
│   └── OnboardingContext.jsx      # Contexto de persistencia de onboarding
├── services/
│   ├── supabase.js                # Re-export del cliente Supabase
│   └── authService.js             # Métodos signUp, signIn, signInWithGoogle, signOut
├── hooks/
│   ├── useAuth.js                 # Hook para consumir AuthContext
│   └── useOnboarding.js           # Hook para consumir OnboardingContext
├── utils/
│   ├── supabase.js                # Cliente singleton Supabase
│   └── permissions.js             # Handlers para Web APIs de cámara y GPS
├── styles/
│   └── index.css                  # Directivas Tailwind, Safe Area y reset
├── test/
│   ├── setup.js                   # Configuración y mocks de Vitest
│   └── ReportaloV2Flow.test.jsx   # Suite completa de pruebas automatizadas
├── .env                           # Variables de entorno Supabase
└── .env.example                   # Plantilla de entorno
```
