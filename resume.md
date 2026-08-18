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
  - Creación de estructura de Wiki en `wiki/` (`Home.md`, `_Sidebar.md`, `_Footer.md`, `01-flujo-de-trabajo.md`, `02-guia-qa-testing.md`, `03-ci-cd-infraestructura.md`, `04-roles-y-gobernanza.md`).
  - Creación del pipeline de sincronización continua `.github/workflows/wiki-sync.yml` para publicación automática en la GitHub Wiki al hacer push a `main`.
