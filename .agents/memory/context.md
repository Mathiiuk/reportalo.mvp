# 🧠 Contexto y Memoria del Proyecto: reportalo.mvp

> **Última sincronización:** 2026-09-08T17:12:54.480Z | **Nodos:** 89 | **Tareas:** 18

## 📦 Mapa de Módulos y Dependencias

| Módulo | Líneas | Dependencias Principales |
|---|---|---|
| `src/App.jsx` | 235 | react, react-router-dom, sonner |
| `src/components/common/AppLoadingScreen.jsx` | 49 | react, framer-motion |
| `src/components/layout/AppLayout.jsx` | 225 | react, react-router-dom, framer-motion |
| `src/components/map/CitizenMap.jsx` | 576 | react, maplibre-gl, maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url |
| `src/components/report/AdjustLocationModal.jsx` | 219 | react, maplibre-gl, maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url |
| `src/components/report/EvidenceCaptureStep.jsx` | 362 | react, lucide-react, framer-motion |
| `src/components/report/EvidencePreviewScreen.jsx` | 267 | react, framer-motion |
| `src/components/report/ReportDetailsStep.jsx` | 230 | react, lucide-react, framer-motion |
| `src/components/report/ReportProcessingScreen.jsx` | 450 | react, ../../services/quarantinePipelineService |
| `src/components/report/ReportReviewStep.jsx` | 479 | react, lucide-react, framer-motion |
| `src/components/report/ReportSuccessScreen.jsx` | 249 | react |
| `src/context/AuthContext.jsx` | 282 | react, sonner, ../lib/supabaseClient |
| `src/data/mockReports.js` | 70 | ninguna |
| `src/hooks/useAuth.js` | 12 | react, ../context/AuthContext |
| `src/hooks/useEvidenceCapture.js` | 137 | react, ../types/evidence |
| `src/hooks/useGeolocation.js` | 65 | react, ../services/locationService |
| `src/hooks/useNetworkStatus.js` | 58 | react |
| `src/lib/supabaseClient.js` | 42 | @supabase/supabase-js |
| `src/main.jsx` | 25 | react, react-dom/client, ./App |
| `src/pages/BlankAppPage.jsx` | 127 | react, react-router-dom, sonner |
| `src/pages/CheckEmailPage.jsx` | 281 | react, react-router-dom, framer-motion |
| `src/pages/LoginPage.jsx` | 401 | react, react-router-dom, framer-motion |
| `src/pages/MapPage.jsx` | 12 | react, ../components/layout/AppLayout, ../components/map/CitizenMap |
| `src/pages/MunicipiosPage.jsx` | 371 | react, react-router-dom, framer-motion |
| `src/pages/NewReportPage.jsx` | 522 | react, react-router-dom, framer-motion |
| `src/pages/NewsPage.jsx` | 94 | react, ../components/layout/AppLayout, framer-motion |
| `src/pages/NotFoundPage.jsx` | 75 | react, react-router-dom |
| `src/pages/NotFoundReportPage.jsx` | 89 | react, react-router-dom |
| `src/pages/OnboardingPage.jsx` | 353 | react, react-router-dom, framer-motion |
| `src/pages/PermissionsPage.jsx` | 284 | react, react-router-dom, framer-motion |
| `src/pages/PlanPage.jsx` | 148 | react, react-router-dom |
| `src/pages/ProfilePage.jsx` | 444 | react, react-router-dom, sonner |
| `src/pages/ReportsPage.jsx` | 234 | react, react-router-dom, ../components/layout/AppLayout |
| `src/pages/TermsAndPermissionsPage.jsx` | 136 | react, react-router-dom |
| `src/pages/WelcomePage.jsx` | 285 | react, react-router-dom, framer-motion |
| `src/services/categoriesService.js` | 87 | ../lib/supabaseClient |
| `src/services/legalRagService.js` | 691 | ../lib/supabaseClient.js |
| `src/services/locationService.js` | 284 | ninguna |
| `src/services/metadataSanitizer.js` | 199 | ninguna |
| `src/services/notificationService.js` | 169 | ninguna |
| `src/services/offlineStorageService.js` | 401 | ../types/evidence |
| `src/services/quarantinePipelineService.js` | 428 | ../lib/supabaseClient, ./metadataSanitizer |
| `src/services/termsService.js` | 339 | ../lib/supabaseClient |
| `src/test/AdjustLocationModal.test.jsx` | 134 | react, vitest, @testing-library/react |
| `src/test/AppLoadingScreen.test.jsx` | 16 | react, vitest, @testing-library/react |
| `src/test/AuthFlow.test.jsx` | 312 | react, vitest, @testing-library/react |
| `src/test/EvidenceCaptureFlow.test.jsx` | 227 | react, vitest, @testing-library/react |
| `src/test/EvidenceGallery.test.jsx` | 47 | react, vitest, @testing-library/react |
| `src/test/EvidencePreviewScreen.test.jsx` | 175 | react, vitest, @testing-library/react |
| `src/test/LegalRagService.test.js` | 250 | vitest, ../services/legalRagService |
| `src/test/LocationFlow.test.jsx` | 162 | react, vitest, @testing-library/react |
| `src/test/LocationService.test.jsx` | 151 | vitest, @testing-library/react, ../services/locationService |
| `src/test/MapFlow.test.jsx` | 260 | react, vitest, @testing-library/react |
| `src/test/MetadataProtection.test.jsx` | 167 | vitest, ../services/metadataSanitizer, ../services/quarantinePipelineService |
| `src/test/NewReportFlow.test.jsx` | 57 | react, vitest, @testing-library/react |
| `src/test/OfflineReportFlow.test.jsx` | 218 | react, vitest, @testing-library/react |
| `src/test/OfflineStorageService.test.js` | 161 | vitest, ../services/offlineStorageService, ../types/evidence |
| `src/test/OnboardingFlow.test.jsx` | 145 | react, vitest, @testing-library/react |
| `src/test/PermissionsFlow.test.jsx` | 143 | react, vitest, @testing-library/react |
| `src/test/ProfileFlow.test.jsx` | 241 | react, vitest, @testing-library/react |
| `src/test/QuarantinePipelineFlow.test.jsx` | 146 | react, vitest, @testing-library/react |
| `src/test/QuarantinePipelineService.test.js` | 277 | vitest, ../services/quarantinePipelineService |
| `src/test/ReportDetailsStep.test.jsx` | 88 | react, vitest, @testing-library/react |
| `src/test/ReportPostSubmissionFlow.test.jsx` | 135 | react, vitest, @testing-library/react |
| `src/test/ReportReviewGallery.test.jsx` | 49 | react, vitest, @testing-library/react |
| `src/test/ReportReviewStep.test.jsx` | 117 | react, vitest, @testing-library/react |
| `src/test/setup.js` | 14 | @testing-library/jest-dom, vitest, fake-indexeddb/auto |
| `src/test/SupabaseSeedValidation.test.js` | 78 | vitest, fs, path |
| `src/test/TermsFlow.test.jsx` | 36 | react, vitest, @testing-library/react |
| `src/types/evidence.js` | 64 | ninguna |
| `src/utils/userUtils.js` | 50 | ninguna |

## 📋 Tareas Registradas

- **REP-2100: Iniciar sesión con Google (OAuth Supabase)** `[READY_FOR_PR]`
- **REP-2101: Iniciar sesión con Magic Link (Email OTP Supabase / Resend)** `[READY_FOR_PR]`
- **REP-2200: Iniciar un nuevo reporte ciudadano** `[READY_FOR_PR]`
- **REP-2201: Sacar foto desde la app** `[READY_FOR_PR]`
- **REP-2300: Detectar ubicación del ciudadano** `[READY_FOR_PR]`
- **REP-2401: HU | Proteger metadatos de la evidencia** `[READY_FOR_PR]`
- **REP-2402: HU | Previsualizar imagen anonimizada** `[READY_FOR_PR]`
- **REP-2404: T | Implementar pipeline server-side de cuarentena de imágenes** `[READY_FOR_PR]`
- **REP-2600: Visualizar /mapa como pantalla principal ciudadana** `[READY_FOR_PR]`
- **REP-2703: Persistir borrador y evidencia offline en IndexedDB** `[READY_FOR_PR]`
- **REP-2907: rag-vertical-slice** `[READY_FOR_PR]`
- **REP-3304: Configurar Vercel preview por rama** `[IN_PROGRESS]`
- **REP-3307: Configurar ambiente staging** `[IN_PROGRESS]`
- **REP-3471: Implementar script SQL/seed del MVP en Supabase** `[READY_FOR_PR]`
- **REP-3519: Finalizar Onboarding Ciudadano de 3 pasos (Mobile & Desktop)** `[READY_FOR_PR]`
- **REP-3532: Sincronización Asíncrona de Consentimiento de Términos y Activación de Permisos PWA** `[READY_FOR_PR]`
- **REP-3544: Manejo de Términos No Tildados, Rechazo y Validación Visual de Consentimiento** `[READY_FOR_PR]`
- **REP-4100: Mapa Ciudadano con MapLibre GL JS y Navegación Principal de 5 Botones** `[READY_FOR_PR]`
