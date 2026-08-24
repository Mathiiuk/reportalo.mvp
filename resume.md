# Bitácora de Proyecto y Tareas — Reportalo MVP

Documento histórico de actividades, tareas desarrolladas, decisiones técnicas y estado de entregas del proyecto.

---

## Registro de Tareas

### [2026-08-18] — REP-3304: Configurar Vercel Preview por Rama
- **Tipo**: DevOps / Infraestructura / CI-CD
- **Responsable**: Matias Krepchuk (PL)
- **QA Asignado**: Ivo
- **Estado**: En progreso (`IN_PROGRESS`)
- **Rama**: `feat/REP-3304-vercel-preview`
- **Resumen**:
  - Corrección de sintaxis YAML en workflows de GitHub Actions (`ci.yml`, `security.yml`, `deploy-template.yml`).
  - Creación de la estructura formal de workflow en `docs/workflow/` para la tarea `REP-3304` (manifest, especificación, plan de pruebas y plan de implementación).
  - Configuración base en `vercel.json` para despliegues de preview por rama.
  - Creación de guía operativa para la integración de Vercel Git (Plan Hobby/Free) y acceso de QA (Ivo) sin necesidad de asientos pagos.

### [2026-08-18] — Documentación y Wiki Automatizada (Skill: wiki-page-writer)
- **Tipo**: Documentación / DevOps
- **Responsable**: Matias Krepchuk (PL)
- **Estado**: Implementado (`DONE`)
- **Resumen**:
  - Adopción de la skill de Microsoft `wiki-page-writer` para documentación basada en evidencias y citación directa de código.
  - Creación de estructura de Wiki en `wiki/` (`Home.md`, `_Sidebar.md`, `_Footer.md`, `01-acta-de-inicio.md`, `02-flujo-de-trabajo.md`, `03-guia-qa-testing.md`, `04-roles-y-gobernanza.md`, `05-ci-cd-infraestructura.md`).
  - Integración completa del **Acta de Inicio v3.0** (`RAR-2026`) en `docs/project/acta-de-inicio-v3.md` y `wiki/01-acta-de-inicio.md`.
  - Formalización del equipo oficial (Carlos Ruiz, Leonel Nuñez, Matías Krepchuk, Hernán Gregorini, Ivan Juarez), alcance MVP CABA/Avellaneda, IA Jurídica y métricas de éxito.
  - Creación del pipeline de sincronización continua `.github/workflows/wiki-sync.yml` para publicación automática en la GitHub Wiki al hacer push a `main`.

### [2026-08-19] — REP-3307: Configurar Ambiente Staging
- **Tipo**: DevOps / Infraestructura / Staging
- **Responsable**: Matías Krepchuk (Tech Lead)
- **Destinatarios**: Carlos Ruiz (Sponsor) & Leonel Nuñez (PM)
- **Estado**: Implementado (`DONE`)
- **Rama**: `feat/REP-3307-configurar-staging` / `staging`
- **Resumen**:
  - Creación de la arquitectura de 3 entornos: Previews (QA Ivan), Staging (Sponsor Carlos / PM Leonel) y Producción (Ciudadanos / Organismos).
  - Creación de rama permanente `staging` en Git.
  - Creación de la estructura formal de workflow en `docs/workflow/` para `REP-3307` (manifest, spec, plan, tests y guía operativa).
  - Actualización de los workflows de GitHub Actions `ci.yml` y `security.yml` para ejecutar quality gates automáticos en push a `staging`.
  - Elaboración de guía paso a paso para asignar subdominio fijo en Vercel Settings (`reportalo-staging.vercel.app`) vinculado a la rama `staging`.

### [2026-08-23] — REP-2200: Reportalo V2 — Onboarding, Autenticación Supabase y MapLibre
- **Tipo**: Frontend / V2 / Supabase Auth / MapLibre / UX-UI
- **Responsable**: Matías Krepchuk (Líder Técnico)
- **QA Asignado**: Ivan Juarez
- **Estado**: Implementado y Validado (`DONE`)
- **Rama**: `feature/onboarding-v2`
- **Resumen**:
  - Construcción del frontend desde cero en la rama `feature/onboarding-v2` con React 18, Vite 6, Tailwind CSS, Supabase Auth y MapLibre GL JS.
  - Landing con acordeón interactivo (`AuthCollapse`) que despliega `LoginForm` o `RegisterForm` de forma fluida con Framer Motion sin recarga de página.
  - Integración de Supabase Auth con credenciales de base de datos activas y soporte de registro, login y Google OAuth.
  - Modal obligatorio de Términos y Condiciones para habilitar el botón de registro.
  - Solicitud secuencial de permisos nativos (Cámara y GPS) con bloque destacado de difuminado facial/patentes y botón "Ahora no".
  - Ruta protegida `/map` con contenedor de MapLibre GL JS, visualización de usuario y botón de cierre de sesión.
  - Notificaciones enriquecidas con Sonner y 100% de éxito en Quality Gates de Vitest y Vite Build.
  - Optimización PWA y Rendimiento: Code Splitting con `React.lazy` y `<Suspense>` para `MapaPage` y `PermisosPage`, atributos semánticos para teclado móvil (`autoComplete`, `inputMode`), validación reforzada de contraseñas (8 caracteres mínimo) y soporte de instalación PWA con `manifest.json` y meta tags de iOS/Android.

### [2026-08-24] — REP-3308: Auditoría Frontend UI/UX y Mejoras de Consistencia
- **Tipo**: Frontend / Refactor / UI-UX / Accessibility
- **Responsable**: Matías Krepchuk (Tech Lead)
- **Estado**: Implementado y Validado (`DONE`)
- **Rama**: `feature/design-system-uiux`
- **Resumen**:
  - Auditoría completa del frontend contra las reglas del master-workflow y skills de `react-patterns` y `ux-ui-design-system`.
  - **Seguridad**: Eliminados fallbacks hardcoded de credenciales Supabase en `src/utils/supabase.js`. Ahora lanza error si faltan env vars.
  - **PWA**: Service Worker registrado en `main.jsx` (luego eliminado por causar cache stale de chunks en Vercel). Manifest.json completado con campos `id`, `scope`, `shortcuts`.
  - **Arquitectura**: Ruta `/permisos` unificada a `PermisosPage` (eliminada `PermissionsPage` obsoleta). Agregado `ErrorBoundary` global en `main.jsx`. Validación de valores permitidos en `OnboardingContext`.
  - **Consistencia**: Fuente Manrope unificada en `tailwind.config.js` (eliminada Inter). Migrados inline styles de `HomePage`, `OnboardingPage` y `TermsPage` a clases Tailwind. Eliminado import CSS duplicado de MapLibre.
  - **Accesibilidad**: `PermisoCard` usa `<button>` semántico en vez de `div role="button"`. Agregados `aria-labels` en botones faltantes. Fix marker leak en `MapaPage` (referencia `userMarkerRef`).
  - **UX**: Loading states con spinner "Ingresando..." en botones de `TermsPage` y `PermisosPage`. Tests actualizados para la nueva estructura del HomePage.
  - Quality Gates: `npx vitest run` (3/3 pasan) + `npx vite build` (exitoso).

### [2026-08-24] — REP-3309: Auditoría y Hardening de Seguridad — Auth y Sesión
- **Tipo**: Security / Auth / Hardening
- **Responsable**: Matías Krepchuk (Tech Lead)
- **Estado**: Implementado y Validado (`DONE`)
- **Rama**: `feature/security-audit`
- **Resumen**:
  - Auditoría de autenticación contra patrones de `auth-implementation-patterns` y `security-guardian`.
  - **PKCE Flow**: Supabase client configurado con `flowType: 'pkce'` (más seguro que implicit flow, previene token interception).
  - **Redirect Validation**: Whitelist `ALLOWED_REDIRECT_ORIGINS` en `supabase.js`. Función `getSecureRedirectUrl()` valida el origin antes de redirigir en OAuth (previene open redirect attacks).
  - **OAuth Hardening**: `signInWithGoogle()` usa redirect validado + `prompt: 'select_account'` (previene session fixation).
  - **Logout Seguro**: `signOut()` usa `scope: 'global'` para invalidar TODOS los refresh tokens del usuario en todos los dispositivos. Limpieza de tokens residuales de localStorage (prefijo `sb-`).
  - **URL Cleanup**: Función `cleanOAuthCallbackUrl()` limpia hash fragments con tokens de la URL después de callbacks OAuth. AuthContext la llama al montar y después de cada `SIGNED_IN`.
  - **Security Headers**: `vercel.json` actualizado con `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera/microphone denegados, geolocation=self).
  - **Auditoría**: Logging de eventos de auth (`SIGNED_IN`, `SIGNED_OUT`, `TOKEN_REFRESHED`).
  - Quality Gates: `npx vitest run` (3/3 pasan) + `npx vite build` (exitoso).

### [2026-08-24] — REP-3310: Onboarding Persistente — Flag en Supabase Metadata
- **Tipo**: Fix / Auth / Onboarding
- **Responsable**: Matías Krepchuk (Tech Lead)
- **Estado**: Implementado y Validado (`DONE`)
- **Rama**: `feature/design-system-uiux`
- **Resumen**:
  - Corrección del flujo de onboarding: usuarios existentes ahora entran directo a `/map` sin ver onboarding.
  - **Problema**: El flag de onboarding se almacenaba solo en `localStorage`, por lo que usuarios en nuevos dispositivos o después de limpiar cache eran tratados como nuevos.
  - **Solución**: Flag persistido en `user.user_metadata.onboarding_completed` de Supabase (DB), con sincronización automática desde localStorage.
  - `PermisosPage.jsx`: `handleContinue` y `handleSkip` guardan `onboarding_completed: true` en Supabase user metadata mediante `supabase.auth.updateUser({ data: { onboarding_completed: true } })`.
  - `HomePage.jsx`: Verifica `user.user_metadata.onboarding_completed` ANTES de localStorage. Si el flag está en localStorage pero no en Supabase, se sincroniza automáticamente.
  - Quality Gates: `npx vitest run` (3/3 pasan) + `npx vite build` (exitoso).

### [2026-08-24] — REP-3311: Magic Link — Implementación Completa del Flujo
- **Tipo**: Feature / Auth / Magic Link
- **Responsable**: Matías Krepchuk (Tech Lead)
- **Estado**: Implementado y Validado (`DONE`)
- **Rama**: `feature/design-system-uiux`
- **Resumen**:
  - Implementación completa del flujo de Magic Link (autenticación por email sin contraseña).
  - **Problema**: `signInWithEmail()` no existía — HomePage la llamaba pero lanzaba error en runtime. No había ruta de callback ni verificación de tokens.
  - **Solución**:
    - `authService.js`: `signInWithEmail()` usa `supabase.auth.signInWithOtp()` con `emailRedirectTo: /auth/callback`.
    - `AuthContext.jsx`: Expone `signInWithEmail` via context provider.
    - `AuthCallback.jsx`: Componente nuevo que maneja el redirect, verifica sesión con `getSession()`, limpia URL y redirige a `/map` o `/onboarding`.
    - `routes/index.jsx`: Ruta `/auth/callback` agregada como pública.
    - `cleanAuthCallbackUrl()`: Mejorada para limpiar `token_hash`, `type`, `access_token` de query params.
  - **Configuración requerida**: Supabase Dashboard > Authentication > URL Configuration > Redirect URLs debe incluir `/auth/callback`.
  - Quality Gates: `npx vitest run` (3/3 pasan) + `npx vite build` (exitoso).
