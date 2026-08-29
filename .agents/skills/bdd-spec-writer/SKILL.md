---
name: bdd-spec-writer
description: Experto en redacción de especificaciones de comportamiento (BDD) utilizando Gherkin estándar en inglés con explicaciones en español. Traduce requisitos de negocio en escenarios ejecutables (Happy Paths, Edge Cases y Scenario Outlines) para Cucumber.
status: active
version: 1.0.0
---

# Skill - BDD & Gherkin Feature Architect

## 1. Propósito

Definir pautas rigurosas para que el agente transforme cualquier requerimiento de software en especificaciones de comportamiento ejecutables (**BDD / Gherkin**), sirviendo como la fuente de verdad de los criterios de aceptación antes de escribir código.

## 2. Reglas no negociables

1. **Sintaxis Universal en Inglés:** Utilizar siempre palabras clave estándar de Gherkin (`Feature`, `Background`, `Scenario`, `Scenario Outline`, `Given`, `When`, `Then`, `And`, `But`, `Examples`).
2. **Comentarios y Documentación en Español:** Todas las descripciones, comentarios explicativos y bitácoras deben redactarse en español para facilitar el aprendizaje y la trazabilidad.
3. **Cobertura Mínima por Feature:** Toda feature debe incluir al menos:
   - 1 Escenario de camino feliz (*Happy Path*).
   - 1 Escenario de manejo de errores o validación (*Negative / Edge Case*).
   - 1 Escenario parametrizado cuando existan múltiples combinaciones de datos (*Scenario Outline*).
4. **Pasos Atómicos y Desacoplados:**
   - `Given`: Establece el estado inicial o contexto (sin efectos secundarios).
   - `When`: Ejecuta una acción puntual del usuario o del sistema.
   - `Then`: Asevera el resultado observable.
   - `And` / `But`: Conecta condiciones adicionales sin mezclar fases.
5. **No Mezclar UI Frágil en Pasos de Negocio:** Preferir pasos orientados al comportamiento del dominio (ej: `When the user creates task "AGT-0001"`) en lugar de detalles efímeros de implementación (ej: `When clicking the blue button with class .btn-submit-3`).

## 3. Estructura de Archivos

Cada tarea con componente funcional o de negocio debe residir en:
- `docs/workflow/features/<TASK-ID>.feature` (especificación asociada a la tarea)
- `features/<dominio>.feature` (suite principal del módulo/sistema)

Y sus correspondientes *Step Definitions* en:
- `tests/bdd/steps/<dominio>-steps.js` (o `.ts`)

## 4. Ciclo de Desarrollo BDD (Red -> Green -> Refactor)

1. **Redactar la Feature:** Escribir los escenarios en `docs/workflow/features/<TASK-ID>.feature`.
2. **Implementar Step Definitions:** Crear las funciones de paso en `tests/bdd/steps/`.
3. **Ejecutar (Rojo):** Correr `pnpm test:bdd` y verificar que los pasos fallan porque la funcionalidad aún no existe.
4. **Implementar Código (Verde):** Desarrollar la lógica en `src/` hasta que todos los escenarios pasen.
5. **Refactorizar:** Limpiar y optimizar el código manteniendo la suite en verde.
