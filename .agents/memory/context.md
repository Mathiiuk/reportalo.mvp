# 🧠 Contexto y Memoria del Proyecto: reportalo.mvp

> **Última sincronización:** 2026-09-20T22:27:13.983Z | **Nodos:** 125 | **Tareas:** 26

## 📦 Mapa de Módulos y Dependencias

| Módulo | Líneas | Dependencias Principales |
|---|---|---|
| `src/App.jsx` | 260 | react, react-router-dom, sonner |
| `src/components/common/AppLoadingScreen.jsx` | 49 | react, framer-motion |
| `src/components/common/ErrorBoundary.jsx` | 54 | react, lucide-react |
| `src/components/common/PwaUpdater.jsx` | 7 | ../../hooks/usePwaUpdate |
| `src/components/layout/AppLayout.jsx` | 225 | react, react-router-dom, framer-motion |
| `src/components/map/CitizenMap.jsx` | 604 | react, react-dom/server, maplibre-gl |
| `src/components/report/AdjustLocationModal.jsx` | 281 | react, maplibre-gl, maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url |
| `src/components/report/EvidenceCaptureStep.jsx` | 362 | react, lucide-react, framer-motion |
| `src/components/report/EvidencePreviewScreen.jsx` | 264 | react, framer-motion, lucide-react |
| `src/components/report/LocalitySelector.jsx` | 154 | react, lucide-react, ../../services/localitiesService |
| `src/components/report/ReportAiAnalysisPanel.jsx` | 165 | react, lucide-react |
| `src/components/report/ReportDetailsStep.jsx` | 227 | react, lucide-react, framer-motion |
| `src/components/report/ReportProcessingScreen.jsx` | 450 | react, ../../services/quarantinePipelineService |
| `src/components/report/ReportReviewStep.jsx` | 491 | react, lucide-react, framer-motion |
| `src/components/report/ReportSuccessScreen.jsx` | 239 | react, lucide-react |
| `src/components/report/ReportTimeline.jsx` | 104 | react, lucide-react |
| `src/context/AuthContext.jsx` | 282 | react, sonner, ../lib/supabaseClient |
| `src/data/mockReports.js` | 70 | ninguna |
| `src/hooks/useAuth.js` | 12 | react, ../context/AuthContext |
| `src/hooks/useEvidenceCapture.js` | 137 | react, ../types/evidence |
| `src/hooks/useGeolocation.js` | 65 | react, ../services/locationService |
| `src/hooks/useNetworkStatus.js` | 58 | react |
| `src/hooks/usePwaUpdate.js` | 37 | react, virtual:pwa-register/react, sonner |
| `src/hooks/useReportAnalysisLive.js` | 180 | react, ../lib/supabaseClient, ../services/reportAiAnalysisService |
| `src/lib/supabaseClient.js` | 42 | @supabase/supabase-js |
| `src/main.jsx` | 25 | react, react-dom/client, ./App |
| `src/pages/BlankAppPage.jsx` | 126 | react, react-router-dom, sonner |
| `src/pages/CheckEmailPage.jsx` | 270 | react, react-router-dom, framer-motion |
| `src/pages/LoginPage.jsx` | 390 | react, react-router-dom, framer-motion |
| `src/pages/MapPage.jsx` | 12 | react, ../components/layout/AppLayout, ../components/map/CitizenMap |
| `src/pages/MunicipiosPage.jsx` | 368 | react, react-router-dom, framer-motion |
| `src/pages/NewReportPage.jsx` | 663 | react, react-router-dom, framer-motion |
| `src/pages/NewsPage.jsx` | 95 | react, ../components/layout/AppLayout, framer-motion |
| `src/pages/NotFoundPage.jsx` | 76 | react, react-router-dom, lucide-react |
| `src/pages/NotFoundReportPage.jsx` | 84 | react, react-router-dom, lucide-react |
| `src/pages/OnboardingPage.jsx` | 346 | react, react-router-dom, framer-motion |
| `src/pages/PermissionsPage.jsx` | 303 | react, react-router-dom, framer-motion |
| `src/pages/PlanPage.jsx` | 149 | react, react-router-dom, lucide-react |
| `src/pages/ProfilePage.jsx` | 447 | react, react-router-dom, sonner |
| `src/pages/ReportDetailPage.jsx` | 265 | react, react-router-dom, framer-motion |
| `src/pages/ReportsPage.jsx` | 303 | react, react-router-dom, ../components/layout/AppLayout |
| `src/pages/TermsAndPermissionsPage.jsx` | 135 | react, react-router-dom, lucide-react |
| `src/pages/WelcomePage.jsx` | 276 | react, react-router-dom, framer-motion |
| `src/services/categoriesService.js` | 120 | ../lib/supabaseClient |
| `src/services/geminiClient.js` | 183 | ninguna |
| `src/services/legalRagService.js` | 322 | ninguna |
| `src/services/localitiesService.js` | 107 | ../lib/supabaseClient |
| `src/services/localityCentroids.js` | 183 | ./localitiesService |
| `src/services/locationService.js` | 259 | ninguna |
| `src/services/metadataSanitizer.js` | 352 | ninguna |
| `src/services/notificationService.js` | 169 | ninguna |
| `src/services/offlineStorageService.js` | 401 | ../types/evidence |
| `src/services/pushSubscriptionService.js` | 106 | ../lib/supabaseClient |
| `src/services/quarantinePipelineService.js` | 431 | ../lib/supabaseClient, ./metadataSanitizer |
| `src/services/reportAiAnalysisPersistence.js` | 99 | ninguna |
| `src/services/reportAiAnalysisService.js` | 54 | ninguna |
| `src/services/reportDetailService.js` | 202 | ../lib/supabaseClient |
| `src/services/reportSubmissionService.js` | 200 | ../lib/supabaseClient, ./quarantinePipelineService |
| `src/services/termsService.js` | 339 | ../lib/supabaseClient |
| `src/services/validateLlmAnalysis.js` | 65 | ninguna |
| `src/sw.js` | 85 | workbox-precaching, workbox-core, workbox-routing |
| `src/test/AdjustLocationModal.test.jsx` | 181 | react, vitest, @testing-library/react |
| `src/test/AppLoadingScreen.test.jsx` | 16 | react, vitest, @testing-library/react |
| `src/test/AuthFlow.test.jsx` | 312 | react, vitest, @testing-library/react |
| `src/test/EvidenceCaptureFlow.test.jsx` | 335 | react, vitest, @testing-library/react |
| `src/test/EvidenceGallery.test.jsx` | 47 | react, vitest, @testing-library/react |
| `src/test/EvidencePreviewScreen.test.jsx` | 175 | react, vitest, @testing-library/react |
| `src/test/fixtures/ragTestFixtures.js` | 258 | ninguna |
| `src/test/LegalRagService.test.js` | 356 | node:fs, node:path, vitest |
| `src/test/LocalitiesService.test.js` | 86 | vitest, ../services/localitiesService |
| `src/test/LocationFlow.test.jsx` | 162 | react, vitest, @testing-library/react |
| `src/test/LocationService.test.jsx` | 151 | vitest, @testing-library/react, ../services/locationService |
| `src/test/MapFlow.test.jsx` | 260 | react, vitest, @testing-library/react |
| `src/test/MetadataProtection.test.jsx` | 167 | vitest, ../services/metadataSanitizer, ../services/quarantinePipelineService |
| `src/test/NearestLocality.test.js` | 60 | vitest, ../services/localityCentroids |
| `src/test/NewReportFlow.test.jsx` | 57 | react, vitest, @testing-library/react |
| `src/test/OfflineReportFlow.test.jsx` | 218 | react, vitest, @testing-library/react |
| `src/test/OfflineStorageService.test.js` | 161 | vitest, ../services/offlineStorageService, ../types/evidence |
| `src/test/OnboardingFlow.test.jsx` | 145 | react, vitest, @testing-library/react |
| `src/test/PermissionsFlow.test.jsx` | 143 | react, vitest, @testing-library/react |
| `src/test/ProfileFlow.test.jsx` | 242 | react, vitest, @testing-library/react |
| `src/test/QuarantinePipelineFlow.test.jsx` | 146 | react, vitest, @testing-library/react |
| `src/test/QuarantinePipelineService.test.js` | 277 | vitest, ../services/quarantinePipelineService |
| `src/test/ReportAiAnalysisPanel.test.jsx` | 100 | react, vitest, @testing-library/react |
| `src/test/ReportAiAnalysisPersistence.test.js` | 112 | vitest, ../services/reportAiAnalysisPersistence |
| `src/test/ReportAnalysisLive.test.js` | 127 | vitest, @testing-library/react, ../hooks/useReportAnalysisLive |
| `src/test/ReportDetailFlow.test.jsx` | 273 | react, vitest, @testing-library/react |
| `src/test/ReportDetailsStep.test.jsx` | 88 | react, vitest, @testing-library/react |
| `src/test/ReportPostSubmissionFlow.test.jsx` | 135 | react, vitest, @testing-library/react |
| `src/test/ReportReviewGallery.test.jsx` | 49 | react, vitest, @testing-library/react |
| `src/test/ReportReviewStep.test.jsx` | 191 | react, vitest, @testing-library/react |
| `src/test/ReportSubmissionService.test.js` | 186 | vitest, ../services/reportSubmissionService |
| `src/test/ReportTimeline.test.jsx` | 120 | react, vitest, @testing-library/react |
| `src/test/setup.js` | 14 | @testing-library/jest-dom, vitest, fake-indexeddb/auto |
| `src/test/SupabaseSeedValidation.test.js` | 78 | vitest, fs, path |
| `src/test/TermsFlow.test.jsx` | 36 | react, vitest, @testing-library/react |
| `src/test/ValidateLlmAnalysis.test.js` | 74 | vitest, ../services/validateLlmAnalysis |
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
- **REP-2500: Conservar el reporte enviado para consultarlo despues** `[PLANNED]`
- **REP-2500-PRESEL: Preseleccionar la localidad detectada para agilizar el envio del reporte** `[MERGED]`
- **REP-2600: Visualizar /mapa como pantalla principal ciudadana** `[READY_FOR_PR]`
- **REP-2703: Persistir borrador y evidencia offline en IndexedDB** `[READY_FOR_PR]`
- **REP-2907: rag-vertical-slice** `[READY_FOR_PR]`
- **REP-2908: RAG juridico de produccion: knowledge_fragments, embeddings Gemini y Edge Function analizar-reporte** `[READY_FOR_PR]`
- **REP-2908-VERIF: Devolucion RAG: verificacion y remediacion de seguridad (V-01 a V-13)** `[IN_PROGRESS]`
- **REP-2909: Cerrar RAG productivo: pipeline asincrono, persistencia del analisis, RLS y pantalla del ciudadano** `[READY_FOR_PR]`
- **REP-3304: Configurar Vercel preview por rama** `[IN_PROGRESS]`
- **REP-3307: Configurar ambiente staging** `[IN_PROGRESS]`
- **REP-3471: Implementar script SQL/seed del MVP en Supabase** `[READY_FOR_PR]`
- **REP-3519: Finalizar Onboarding Ciudadano de 3 pasos (Mobile & Desktop)** `[READY_FOR_PR]`
- **REP-3532: Sincronización Asíncrona de Consentimiento de Términos y Activación de Permisos PWA** `[READY_FOR_PR]`
- **REP-3544: Manejo de Términos No Tildados, Rechazo y Validación Visual de Consentimiento** `[READY_FOR_PR]`
- **REP-3789: Preservar y visualizar en frontend el fundamento juridico del RAG textual (detalle de reporte + Realtime)** `[MERGED]`
- **REP-4100: Mapa Ciudadano con MapLibre GL JS y Navegación Principal de 5 Botones** `[READY_FOR_PR]`
- **REP-DEPLOY-RAG-SUPABASE: Desplegar RAG productivo (REP-2908/2909) contra Supabase real** `[READY_FOR_PR]`
- **REP-ICONS-SWEEP: Reemplazar iconos Material Symbols por Lucide en toda la app (fuente externa fallaba)** `[READY_FOR_PR]`
