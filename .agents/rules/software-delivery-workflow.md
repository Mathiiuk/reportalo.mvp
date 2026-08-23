# Regla Maestra de Flujo de Trabajo: Software Delivery Workflow (DT de Todo)

Toda tarea o desarrollo en Reportalo debe seguir obligatoriamente este marco metodológico antes, durante y después de escribir código.

---

## 1. Stack de Skills Integradas en `.agents/skills/`

1. **`software-delivery-workflow` (DT / Director Técnico)**:
   - Toda feature debe contar con su tarea en `docs/workflow/tasks/`, su especificación en `docs/workflow/specs/`, su plan en `docs/workflow/plans/`, su matriz de pruebas en `docs/workflow/tests/` y su reporte de ejecución en `docs/workflow/executions/`.
   - La bitácora `resume.md` debe mantenerse siempre sincronizada con el estado real de cada tarea.

2. **`spec-to-plan`**:
   - Traduce especificaciones funcionales a planes de implementación técnicos rigurosos y accionables paso a paso.

3. **`mobile-pwa-architect`**:
   - Enfoque Mobile-First estricto, compatibilidad PWA (manifest, service workers, standalone), safe areas (`--sat`, `--sab`), touch targets $\ge 48\times 48\text{px}$, responsive para pantallas de 320px en adelante y compatibilidad con iOS y Android.

4. **`react-patterns` & `ux-ui-design-system`**:
   - Componentes modulares, desacoplamiento de lógica en Custom Hooks y Contextos, consistencia de diseño con Tailwind CSS y accesibilidad WCAG AA.

5. **`security-guardian` & `auth-implementation-patterns`**:
   - Arquitectura Zero Trust y Secure by Design.
   - Jamás exponer secretos o service roles en el frontend.
   - Limpieza de URLs ante redirecciones OAuth y protección estricta de rutas.

---

## 2. Ciclo de Ejecución de Tareas

1. **Planificación y Especificación:** Validar requisitos y crear artefactos en `docs/workflow/`.
2. **Desarrollo TDD & Clean Code:** Escribir código comentado en español en cada línea relevante para aprendizaje y trazabilidad.
3. **Quality Gates:** Ejecutar pruebas automáticas (`npx vitest run`) y build de producción (`npx vite build`).
4. **Auditoría:** Revisar performance, PWA y seguridad antes de confirmar.
5. **Git & PR:** Commits semánticos y ramas feature dirigidas a `staging`.
