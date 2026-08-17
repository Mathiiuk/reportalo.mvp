# Project Automation Kit

Kit reutilizable para automatizar el ciclo de vida de tareas de software desde el requerimiento hasta producción.

## Objetivo

Estandarizar el flujo:

`Task → Analysis → Specification → Plan → Branch → Implementation → Validation → PR → CI → Staging → Production → Health Check → Done`

Incluye recuperación ante fallos, rollback, documentación y trazabilidad.

## Estructura

```text
project-automation-kit/
├── README.md
├── skills/
│   └── software-delivery-workflow.md
├── templates/
│   ├── task-manifest.yml
│   ├── specification.md
│   ├── implementation-plan.md
│   ├── test-plan.md
│   ├── execution-report.md
│   ├── incident.md
│   ├── pull-request.md
│   └── definition-of-done.md
├── examples/
│   └── sample-task.yml
└── .github/
    └── workflows/
        ├── ci.yml
        ├── security.yml
        └── deploy-template.yml
```

## Cómo usarlo en un proyecto nuevo

1. Copiar `skills/` al directorio de skills de tu agente o herramienta.
2. Copiar `templates/` a `docs/workflow/templates/`.
3. Copiar y adaptar `.github/workflows/`.
4. Crear un `task-manifest.yml` para cada trabajo.
5. No marcar una tarea como `DONE` hasta cumplir la Definition of Done.

## Adaptación por stack

El kit no asume React, Node, .NET, Python, Java, PHP, etc. Los comandos reales de build/test/lint/typecheck/deploy deben definirse en el proyecto.

La skill usa placeholders como `PROJECT_INSTALL`, `PROJECT_TEST`, `PROJECT_BUILD` y `PROJECT_DEPLOY` para evitar acoplamiento.

## Convención de estados

```text
BACKLOG → ANALYSIS → PLANNED → READY → IN_PROGRESS → VERIFYING
VERIFYING → READY_FOR_PR → PR_OPEN → APPROVED → MERGED
MERGED → DEPLOYING → MONITORING → DONE

VERIFYING/CI/DEPLOYING → FIXING o ROLLBACK → nueva verificación
```
