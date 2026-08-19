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

### [2026-08-19] — REP-3307: Configurar Ambiente Staging y Gobernanza de Flujo Git
- **Tipo**: DevOps / Infraestructura / Gobernanza
- **Responsable**: Matías Krepchuk (Tech Lead)
- **Destinatarios**: Carlos Ruiz (Sponsor), Leonel Nuñez (PM), Ivan Juarez (QA)
- **Estado**: Implementado (`DONE`)
- **Rama**: `feat/REP-3307-configurar-staging` / `staging`
- **Resumen**:
  - Creación de la arquitectura de 3 entornos: Previews (QA Ivan), Staging (Sponsor Carlos / PM Leonel) y Producción (Ciudadanos / Organismos).
  - Creación de rama permanente `staging` en Git.
  - Creación de la estructura formal de workflow en `docs/workflow/` para `REP-3307` (manifest, spec, plan, tests y guía operativa).
  - Actualización de los workflows de GitHub Actions `ci.yml` y `security.yml` para ejecutar quality gates automáticos en push a `staging`.
  - Configuración de subdominio fijo en Vercel Settings (`reportalo-staging.vercel.app`) vinculado a la rama `staging`.
  - Creación de plantilla oficial de Pull Request `.github/PULL_REQUEST_TEMPLATE.md` con checklist de QA.
  - Creación de formularios estructurados de Issues `.github/ISSUE_TEMPLATE/` (`bug_report.yml`, `feature_request.yml`, `config.yml`).
  - Creación de la guía de contribución `CONTRIBUTING.md`, asignación de revisores en `.github/CODEOWNERS` y manual `git-branching-strategy.md`.
  - Actualización de la Wiki en `wiki/04-roles-y-gobernanza.md` con la matriz RACI y políticas de Release.
