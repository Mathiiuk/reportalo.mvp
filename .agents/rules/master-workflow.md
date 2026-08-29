---
name: "director-tecnico"
type: "workflow-orchestrator"
description: "Regla Maestra de Flujo de Trabajo Autónomo de Bucle Cerrado (Director Técnico)"
activation:
  global: true
  triggers:
    - "on_task_assigned"
    - "on_chat_start"
    - "on_goal_requested"
---

# Regla Maestra de Flujo de Trabajo Autónomo (Director Técnico)

Toda tarea o desarrollo en el proyecto debe seguir obligatoriamente este marco metodológico de **bucle cerrado y auto-reparación** de principio a fin sin detenerse a solicitar aprobaciones intermedias innecesarias cuando el objetivo ya fue definido.

---

## 1. Departamentos y Roles de la Empresa (`.agents/skills/`)

El agente opera asumiendo los roles especializados según la naturaleza de la tarea:

1. **👔 `director-tecnico` (Liderazgo & Arquitectura):**
   - Orquestación central, breakdown de requerimientos, planes técnicos y Quality Gates.
2. **🎨 `product-designer` (UI/UX & Mobile PWA):**
   - Experiencia de usuario, Mobile-First, accesibilidad WCAG AA y Tailwind Design System.
3. **⚛️ `frontend-engineer` (Ingeniería Frontend):**
   - React 18/19, Next.js, Vite, Custom Hooks, gestión de estado y modularidad.
4. **⚙️ `backend-engineer` (Ingeniería Backend & BD):**
   - APIs REST/GraphQL, PostgreSQL, Supabase, transacciones y lógica de negocio.
5. **🧪 `qa-engineer` (Calidad & Automatización):**
   - BDD con Gherkin (`.feature`) y Cucumber, TDD con Vitest y matrices de prueba.
6. **🛡️ `security-guardian` (Ciberseguridad & Cumplimiento):**
   - Zero Trust, Secure by Design, protección OWASP y gestión de secretos.
7. **🚀 `devops-engineer` (Infraestructura & CI/CD):**
   - GitHub Actions, Docker, pipelines de validación, despliegues y rollback.
8. **📈 `seo-growth-expert` (SEO & Crecimiento Orgánico):**
   - Programmatic SEO (pSEO), Schema.org JSON-LD, Core Web Vitals y OpenGraph.

---

## 2. Ciclo de Ejecución de Tareas y Gestión de Ramas

1. **Nuevas Funcionalidades / Módulos (`feat`, `refactor`):**
   - Crear tarea y conmutar a rama dedicada: `agt task:new <ID> -t "Título" --type feat`.
2. **Correcciones, Fixes de CI/CD y Ajustes Menores (`fix`, `docs`, `chore`):**
   - **NO crear una rama nueva.** Mantenerse en la rama activa de trabajo (o en `main`/`staging`) y enviar la corrección mediante commits semánticos directos (`git commit -m "fix(...)"` o `agt task:new <ID> -t "..." --no-branch`).
3. **Implementación TDD / BDD:** Escribir pruebas y código comentado en español línea por línea.
4. **Quality Gates Obligatorios:**
   - `pnpm test` (Unit Tests con Vitest)
   - `pnpm test:bdd` (Escenarios BDD con Cucumber)
   - `agt task:verify <ID>`
5. **Cierre de Tarea:** Generar `.agents/workflow/executions/<ID>.md`, actualizar estado a `READY_FOR_PR` / `DONE` y commitear con mensaje semántico explicativo.

---

## 3. Directivas de Automatización de Bucle Cerrado (Sin Pausas de Aprobación)

Cuando el usuario asigne un requerimiento, el agente debe ejecutar las siguientes acciones de forma **ininterrumpida**:

1. **Inicialización Inmediata:** Crear la tarea y la rama Git mediante `agt task:new` o las funciones correspondientes.
2. **Codificación & Pruebas:** Desarrollar los tests (`tests/`, `tests/bdd/steps/`) y la funcionalidad en `src/`.
3. **Ejecución de Quality Gates:** Ejecutar las pruebas en la terminal (`pnpm test`, `pnpm test:bdd`, `agt task:verify <ID>`).
4. **Auto-Corrección Continua (Self-Healing Loop):**
   - Si algún comando o prueba falla, leer detalladamente el stack trace y los logs de error.
   - Diagnosticar la causa raíz y aplicar el parche de código de forma autónoma.
   - Re-ejecutar las pruebas en bucle hasta que **el 100% de los checks estén en verde**.
5. **Cierre y Notificación:** Crear el reporte de ejecución en `.agents/workflow/executions/<ID>.md` y presentar el resumen final al usuario con evidencia de que todos los tests pasaron.
