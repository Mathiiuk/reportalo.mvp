---
title: "Flujo de Trabajo — Ciclo de Vida de Software"
description: "Metodología formal de entrega autónoma de software, gestión de estados, quality gates y trazabilidad desde Jira hasta producción."
---

# ⚙️ Ciclo de Vida de Software y Flujo de Trabajo

Este documento define la metodología de desarrollo estandarizada del proyecto **Reportalo MVP**, basada en la skill de entrega autónoma de software ([`skills/software-delivery-workflow.md:1-35`](https://github.com/Mathiiuk/reportalo.mvp/blob/main/skills/software-delivery-workflow.md#L1-L35)).

---

## 1. Por qué existe este flujo (First Principles)

En proyectos de software ágiles, la falta de trazabilidad y validación temprana provoca despliegues defectuosos, regresiones en producción y descoordinación entre el equipo de desarrollo y QA.

Este flujo estandariza el camino:
$$\text{Requerimiento} \longrightarrow \text{Especificación} \longrightarrow \text{Rama Aislada} \longrightarrow \text{Validación Local} \longrightarrow \text{CI/Security} \longrightarrow \text{QA Preview} \longrightarrow \text{Producción}$$

---

## 2. Máquina de Estados Operativa

Toda tarea debe progresar siguiendo la máquina de estados definida en el kit ([`skills/software-delivery-workflow.md:36-65`](https://github.com/Mathiiuk/reportalo.mvp/blob/main/skills/software-delivery-workflow.md#L36-L65)).

```mermaid
stateDiagram-v2
    [*] --> BACKLOG
    BACKLOG --> ANALYSIS: Asignación de tarea
    ANALYSIS --> PLANNED: Creación de specs y plan
    PLANNED --> IN_PROGRESS: Creación de rama feat/ o fix/
    IN_PROGRESS --> VERIFYING: Ejecución de quality gates locales
    VERIFYING --> READY_FOR_PR: Gates locales en verde
    VERIFYING --> FIXING: Falla en pruebas locales
    FIXING --> IN_PROGRESS: Corrección de código
    READY_FOR_PR --> PR_OPEN: Creación de Pull Request
    PR_OPEN --> APPROVED: CI OK + Aprobación QA (Ivo)
    PR_OPEN --> FIXING: Falla en CI o rechazo de QA
    APPROVED --> MERGED: Merge a main
    MERGED --> DEPLOYING: Despliegue automático Vercel
    DEPLOYING --> MONITORING: Verificación de salud
    MONITORING --> DONE: Criterios cumplidos (DoD)
    MONITORING --> ROLLBACK: Falla en producción
    ROLLBACK --> INCIDENT: Apertura de incidente
    INCIDENT --> FIXING: Nueva rama hotfix
    DONE --> [*]
```
<!-- Sources: skills/software-delivery-workflow.md:36-65, templates/task-manifest.yml:6-7 -->

---

## 3. Estructura de Tarea en `docs/workflow/`

Cada tarea formal iniciada debe crear los siguientes 4 documentos de trazabilidad ([`skills/software-delivery-workflow.md:66-78`](https://github.com/Mathiiuk/reportalo.mvp/blob/main/skills/software-delivery-workflow.md#L66-L78)):

| Documento | Ubicación | Propósito | Plantilla Origen |
| :--- | :--- | :--- | :--- |
| **Task Manifest** | `docs/workflow/tasks/<TASK-ID>.yml` | Define estado, tipo, quality gates activos y comandos | [`templates/task-manifest.yml`](https://github.com/Mathiiuk/reportalo.mvp/blob/main/templates/task-manifest.yml) |
| **Specification** | `docs/workflow/specs/<TASK-ID>.md` | Criterios de aceptación, alcance, restricciones y riesgos | [`templates/specification.md`](https://github.com/Mathiiuk/reportalo.mvp/blob/main/templates/specification.md) |
| **Implementation Plan** | `docs/workflow/plans/<TASK-ID>.md` | Archivos modificados/creados y estrategia técnica | [`templates/implementation-plan.md`](https://github.com/Mathiiuk/reportalo.mvp/blob/main/templates/implementation-plan.md) |
| **Test Plan** | `docs/workflow/tests/<TASK-ID>.md` | Casos de prueba automatizados y manuales para QA | [`templates/test-plan.md`](https://github.com/Mathiiuk/reportalo.mvp/blob/main/templates/test-plan.md) |

---

## 4. Secuencia de Validación y Quality Gates

Antes de crear un PR y durante la integración continua, se ejecutan las validaciones en orden estricto ([`skills/software-delivery-workflow.md:170-205`](https://github.com/Mathiiuk/reportalo.mvp/blob/main/skills/software-delivery-workflow.md#L170-L205)).

```mermaid
sequenceDiagram
    autonumber
    participant Dev as Desarrollador / PL
    participant Local as Entorno Local
    participant CI as GitHub CI Pipeline
    participant QA as QA Validator (Ivo)

    Dev->>Local: Ejecuta Lint & Formateo
    Dev->>Local: Ejecuta Typecheck (Tipado estático)
    Dev->>Local: Ejecuta Pruebas Unitarias & Integración
    Dev->>Local: Ejecuta Compilación (Build local)
    Local-->>Dev: Quality Gates Locales PASS
    Dev->>CI: Push de rama & Apertura de PR
    CI->>CI: ci.yml (Lint + Test + Build)
    CI->>CI: security.yml (Scan de dependencias)
    CI-->>QA: Disparo de Preview en Vercel
    QA->>QA: Validación en Preview URL
```
<!-- Sources: skills/software-delivery-workflow.md:170-205, .github/workflows/ci.yml:8-35, .github/workflows/security.yml:11-18 -->

---

## 5. Convenciones de Ramas y Commits

### Convención de Ramas
* `feat/<TASK-ID>-<slug>`: Nuevas funcionalidades (ej. `feat/REP-3304-vercel-preview`).
* `fix/<TASK-ID>-<slug>`: Corrección de errores.
* `hotfix/<INCIDENT-ID>-<slug>`: Correcciones urgentes de producción.
* `chore/<TASK-ID>-<slug>`: Mantenimiento o configuración de herramientas.

### Convención de Commits
Todos los mensajes de commit deben formularse en **español** siguiendo el estándar conventional commits:
```text
<tipo>(<módulo>): <descripción concisa>

- Detalle de cambios principales
- Referencia a ticket Jira o criterio de aceptación
```

---

## Related Pages

| Página | Relación |
| :--- | :--- |
| [Inicio (Home)](Home) | Portal general y visión de arquitectura |
| [Acta de Inicio](01-acta-de-inicio) | Requerimientos estratégicos y alcance del MVP |
| [Guía QA & Testing](03-guia-qa-testing) | Criterios para la aprobación de tareas por Ivan Juarez |
| [Roles y Gobernanza](04-roles-y-gobernanza) | Matriz RACI y responsabilidades por etapa |
| [CI/CD e Infraestructura](05-ci-cd-infraestructura) | Ejecución técnica de los pipelines en GitHub Actions |
