# 🧠 Contexto y Memoria del Proyecto: reportalo.mvp

> **Última sincronización:** 2026-09-01T16:04:36.494Z | **Nodos:** 52 | **Tareas:** 12

## 📦 Mapa de Módulos y Dependencias

| Módulo | Líneas | Dependencias Principales |
|---|---|---|
| `src/App.jsx` | 218 | react, react-router-dom, sonner |
| `src/components/layout/AppLayout.jsx` | 158 | react, react-router-dom, framer-motion |
| `src/components/map/CitizenMap.jsx` | 508 | react, maplibre-gl, maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url |
| `src/components/report/EvidenceCaptureStep.jsx` | 254 | react, lucide-react, framer-motion |
| `src/components/report/ReportDetailsStep.jsx` | 230 | react, lucide-react, framer-motion |
| `src/components/report/ReportReviewStep.jsx` | 366 | react, lucide-react, framer-motion |
| `src/context/AuthContext.jsx` | 282 | react, sonner, ../lib/supabaseClient |
| `src/data/mockReports.js` | 70 | ninguna |
| `src/hooks/useAuth.js` | 12 | react, ../context/AuthContext |
| `src/hooks/useEvidenceCapture.js` | 124 | react, ../types/evidence |
| `src/hooks/useGeolocation.js` | 65 | react, ../services/locationService |
| `src/lib/supabaseClient.js` | 37 | @supabase/supabase-js |
| `src/main.jsx` | 25 | react, react-dom/client, ./App |
| `src/pages/BlankAppPage.jsx` | 127 | react, react-router-dom, sonner |
| `src/pages/CheckEmailPage.jsx` | 281 | react, react-router-dom, framer-motion |
| `src/pages/LoginPage.jsx` | 401 | react, react-router-dom, framer-motion |
| `src/pages/MapPage.jsx` | 12 | react, ../components/layout/AppLayout, ../components/map/CitizenMap |
| `src/pages/MunicipiosPage.jsx` | 215 | react, react-router-dom, framer-motion |
| `src/pages/NewReportPage.jsx` | 171 | react, react-router-dom, framer-motion |
| `src/pages/NewsPage.jsx` | 92 | react, ../components/layout/AppLayout, framer-motion |
| `src/pages/OnboardingPage.jsx` | 345 | react, react-router-dom, framer-motion |
| `src/pages/ProfilePage.jsx` | 132 | react, react-router-dom, ../components/layout/AppLayout |
| `src/pages/ReportsPage.jsx` | 263 | react, react-router-dom, ../components/layout/AppLayout |
| `src/pages/TermsAndPermissionsPage.jsx` | 135 | react, react-router-dom |
| `src/pages/WelcomePage.jsx` | 285 | react, react-router-dom, framer-motion |
| `src/services/categoriesService.js` | 80 | ../lib/supabaseClient |
| `src/services/locationService.js` | 158 | ninguna |
| `src/services/termsService.js` | 336 | ../lib/supabaseClient |
| `src/test/AuthFlow.test.jsx` | 312 | react, vitest, @testing-library/react |
| `src/test/EvidenceCaptureFlow.test.jsx` | 161 | react, vitest, @testing-library/react |
| `src/test/LocationFlow.test.jsx` | 162 | react, vitest, @testing-library/react |
| `src/test/LocationService.test.jsx` | 151 | vitest, @testing-library/react, ../services/locationService |
| `src/test/MapFlow.test.jsx` | 260 | react, vitest, @testing-library/react |
| `src/test/NewReportFlow.test.jsx` | 57 | react, vitest, @testing-library/react |
| `src/test/OnboardingFlow.test.jsx` | 123 | react, vitest, @testing-library/react |
| `src/test/ReportDetailsStep.test.jsx` | 88 | react, vitest, @testing-library/react |
| `src/test/ReportReviewStep.test.jsx` | 117 | react, vitest, @testing-library/react |
| `src/test/setup.js` | 11 | @testing-library/jest-dom, vitest |
| `src/test/TermsFlow.test.jsx` | 36 | react, vitest, @testing-library/react |
| `src/types/evidence.js` | 64 | ninguna |

## 📋 Tareas Registradas

- **REP-2100: Iniciar sesión con Google (OAuth Supabase)** `[READY_FOR_PR]`
- **REP-2101: Iniciar sesión con Magic Link (Email OTP Supabase / Resend)** `[READY_FOR_PR]`
- **REP-2200: Iniciar un nuevo reporte ciudadano** `[READY_FOR_PR]`
- **REP-2201: Sacar foto desde la app** `[READY_FOR_PR]`
- **REP-2300: Detectar ubicación del ciudadano** `[READY_FOR_PR]`
- **REP-2600: Visualizar /mapa como pantalla principal ciudadana** `[READY_FOR_PR]`
- **REP-3304: Configurar Vercel preview por rama** `[IN_PROGRESS]`
- **REP-3307: Configurar ambiente staging** `[IN_PROGRESS]`
- **REP-3519: Finalizar Onboarding Ciudadano de 3 pasos (Mobile & Desktop)** `[READY_FOR_PR]`
- **REP-3532: Sincronización Asíncrona de Consentimiento de Términos con Supabase y Auditoría Multi-dispositivo** `[READY_FOR_PR]`
- **REP-3544: Manejo de Términos No Tildados, Rechazo y Validación Visual de Consentimiento** `[READY_FOR_PR]`
- **REP-4100: Mapa Ciudadano con MapLibre GL JS y Navegación Principal de 5 Botones** `[READY_FOR_PR]`
