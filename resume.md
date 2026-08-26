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
- **Estado**: En progreso (`IN_PROGRESS`)
- **Rama**: `feat/REP-3307-configurar-staging` / `staging`
- **Resumen**:
  - Creación de la arquitectura de 3 entornos: Previews (QA Ivan), Staging (Sponsor Carlos / PM Leonel) y Producción (Ciudadanos / Organismos).
  - Creación de rama permanente `staging` en Git.
  - Creación de la estructura formal de workflow en `docs/workflow/` para `REP-3307` (manifest, spec, plan, tests y guía operativa).
  - Actualización de los workflows de GitHub Actions `ci.yml` y `security.yml` para ejecutar quality gates automáticos en push a `staging`.
### [2026-08-26] — REP-2100: Iniciar sesión con Google (OAuth Supabase)
- **Tipo**: Frontend / Auth / Mobile-PWA
- **Responsable**: Matías Krepchuk (Tech Lead)
- **QA Asignado**: Ivo
- **Estado**: Listo para PR (`READY_FOR_PR`)
- **Rama**: `feat/REP-2100-login-google`
- **Resumen**:
  - Implementación de pantalla de bienvenida / onboarding (Screen 1), pantalla de login (Screen 2) y portal institucional `/municipios` con estricta fidelidad de diseño (Manrope, Material Symbols Rounded, gradientes, layout desktop dual-column y estilo Mobile PWA).
  - Integración de autenticación Google OAuth mediante Supabase Auth (`signInWithOAuth` con provider `'google'`).
  - Implementación de `AuthProvider` y hook `useAuth`, con sanitización segura de tokens/hashes en la URL (`replaceState`) y captura/notificación de errores.
  - Integración de notificaciones interactivas con `sonner` y micro-interacciones fluidas con `framer-motion`.
  - Redirección automática a pantalla protegida post-login y opción de cierre de sesión.
  - Migración y estandarización completa del gestor de dependencias a `pnpm`.
  - Quality Gates superados: 9/9 tests unitarios en verde (`pnpm test`) y build de producción exitoso (`pnpm run build`).

### [2026-08-26] — REP-2101: Iniciar sesión con Magic Link (Email OTP)
- **Tipo**: Frontend / Auth / Mobile-PWA
- **Responsable**: Matías Krepchuk (Tech Lead)
- **QA Asignado**: Ivo
- **Estado**: Listo para PR (`READY_FOR_PR`)
- **Rama**: `feat/REP-2101-login-magic-link`
- **Resumen**:
  - Implementación de solicitud de Magic Link mediante `supabase.auth.signInWithOtp`.
  - Creación de la pantalla de confirmación "Revisá tu correo" (`CheckEmailPage`) con temporizador de reenvío en tiempo real, apertura de gestor de correo y diseño responsive.
  - Verificación de enlace, sanitización de tokens y manejo seguro de caducidad (15 min).
  - Auditoría de seguridad `security-guardian` superada (0 claves expuestas en cliente, control Zero Trust).
  - Quality Gates superados: 10/10 tests unitarios en verde (`pnpm test`) y compilación exitosa (`pnpm run build`).

### [2026-08-26] — REP-3519: Finalizar Onboarding Ciudadano de 3 pasos (Mobile & Desktop)
- **Tipo**: Frontend / UI / Onboarding
- **Responsable**: Matías Krepchuk (Tech Lead)
- **QA Asignado**: Ivo
- **Estado**: Listo para PR (`READY_FOR_PR`)
- **Rama**: `feat/REP-3519-finalizar-onboarding`
- **Resumen**:
  - Creación de componente interactivo `OnboardingPage` con 3 pasos educativos: "Una foto es un reclamo", "Tu foto se protege sola" y "Seguí cada reporte".
  - Transiciones fluidas con `framer-motion` y `AnimatePresence`, paginador de 3 puntos interactivo y botón "Saltar".
  - Adaptación responsive de alta fidelidad: Mobile full-bleed y Desktop con split-screen de dos columnas armonizado con el Home.
  - Control de acceso y redirección inteligente en `ProtectedRoute` y `PublicRoute`.
  - Quality Gates superados: 15/15 tests unitarios en verde (`pnpm test`) y compilación exitosa (`pnpm run build`).

### [2026-08-26] — REP-3532: Aceptar Términos, Privacidad y Permisos (Mobile & Desktop)
- **Tipo**: Frontend / Auth / Privacy / Legal
- **Responsable**: Matías Krepchuk (Tech Lead)
- **QA Asignado**: Ivo
- **Estado**: Listo para PR (`READY_FOR_PR`)
- **Rama**: `feat/REP-3532-aceptar-terminos`
- **Resumen**:
  - Implementación del servicio `termsService` para control de versión vigente (`v1.2`), verificación de consentimiento auditable (`accepted_at` + `terms_version`).
  - Creación del componente `TermsAndPermissionsPage`: Paso 1 Términos y Privacidad (con modal de texto legal completo y checkbox de consentimiento explícito) y Paso 2 Activación de Permisos (Cámara y Ubicación).
  - Bloqueo de inicio de reportes en `BlankAppPage` si el usuario no tiene la versión v1.2 aceptada, permitiendo navegación libre en el resto de la app.
  - Quality Gates superados: 24/24 tests unitarios en verde (`pnpm test`) y compilación exitosa (`pnpm run build`).
