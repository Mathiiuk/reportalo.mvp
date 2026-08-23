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

