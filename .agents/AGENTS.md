# Reglas y Configuraciones para Antigravity AI

## 🧠 Segundo Cerebro de Obsidian (Por Defecto)
Ruta local principal: `C:\Users\krepc\Documents\Obsidian Vault`

- **Uso Automático**: Para cualquier tarea de diseño, arquitectura, flujo de autenticación, manejo de errores o pSEO, consultar primero las notas de `C:\Users\krepc\Documents\Obsidian Vault\Skills\` y `Hub.md`.
- **Habilidades Clave**:
  - `Skill - Software Delivery Workflow.md` (Flujo autónomo end-to-end con 22 etapas, Quality Gates y CI/CD)
  - `Skill - UX UI Design System.md`
  - `Skill - React Patterns.md`
  - `Skill - Error Handling Patterns.md`
  - `Skill - Security Guardian.md`
  - `Skill - Spec to Plan.md`

## 🚀 Flujo de Desarrollo Autónomo (Software Delivery Workflow & Master Workflow)
- **Uso Obligatorio y Predeterminado**: Aplicar estrictamente `D:\Proyectos\turnar.app\.agents\rules\master-workflow.md` y `software-delivery-workflow` (ubicada en `.agents/skills/software-delivery-workflow/SKILL.md`).
- **No Suposiciones**: Si hay requerimientos abiertos o decisiones de diseño, PREGUNTAR explícitamente y alinear con el usuario.
- **Sin Código Suelto / No Romper lo Existente**: Mantener 100% de retrocompatibilidad, no tocar código funcional probado sin motivo, y asegurar integración end-to-end completa por fases.
- **Gestión Estricta de Ramas Git**:
  - Para CADA nueva tarea, feature o bugfix, se DEBE crear y cambiar a una rama específica (`feat/XXX_nombre_tarea`, `fix/XXX_nombre_tarea`, `hotfix/XXX_nombre_tarea`).
  - No reutilizar la misma rama para requerimientos o tareas distintas.
- **Ejecución Autónoma de Quality Gates y Tests**:
  - Los comandos de validación (lint, typecheck, ejecución de tests de backend y frontend, `npm run build`) se ejecutan de manera 100% autónoma e inmediata sin pedir permiso ni confirmación al usuario.
- **Control de Push a GitHub**:
  - El asistente NO debe ejecutar `git push origin <rama>` automáticamente; ÚNICAMENTE solicitará autorización/confirmación al usuario antes de hacer el push final a GitHub.
- **Garantías de Calidad**:
  - Respetar el ciclo de vida por fases (Task → Spec → Plan → Rama → Implementación → Quality Gates → DoD) documentado en `docs/workflow/`.
  - Generar evidencia de ejecución y no declarar éxito sin pruebas.

## 🌐 Reglas de Idioma y Código
- Responde siempre en español.
- Comenta el código en español para verificación y aprendizaje.
