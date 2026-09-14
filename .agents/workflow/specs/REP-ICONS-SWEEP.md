# Specification — REP-ICONS-SWEEP

## 1. Objetivo

Que ningún ícono de la app dependa de que cargue una fuente externa (Google Fonts Material Symbols) para verse — reemplazarlos todos por SVGs de Lucide, ya bundleados en el build.

## 2. Problema actual

En `ReportDetailsStep.jsx` (paso 2 de "Nuevo reporte") se detectó que el componente ya calculaba `IconComponent` (el ícono Lucide correspondiente a cada categoría) pero seguía renderizando `<span className="material-symbols-rounded">{cat.icon}</span>` — mostrando literalmente el nombre del ícono ("construction", "local_shipping") como texto en vez del glifo. Al revisar el resto de la app se encontró el mismo patrón roto en 19 archivos más (páginas y componentes), incluida la portada (`WelcomePage.jsx`, donde "shield", "auto_awesome", "map" aparecían como texto plano).

## 3. Resultado esperado

Cero dependencia de `material-symbols-rounded` para íconos funcionales de la UI. Los 21 archivos afectados usan componentes Lucide (SVG), consistente con el patrón ya usado en gran parte del código (`AppLayout.jsx`, `CitizenMap.jsx` ya importaban Lucide para varios íconos).

## 4. Alcance

### Incluido
- Los 21 archivos con `material-symbols-rounded` detectados por grep.
- El caso especial de `CitizenMap.jsx` (marcadores vía `innerHTML`, no JSX): resuelto con `renderToStaticMarkup`.
- Corrección de `ProfileFlow.test.jsx`, que aserteba el nombre del ícono como texto — estaba probando el bug.

### No incluido
- El ícono dinámico de `NewsPage.jsx` (`item.icon`, dead code porque `newsItems = []` está hardcodeado) — documentado, no forzado.
- La clase `.material-symbols-rounded` en `index.css` — se deja definida (no hace daño, y podría usarse si en el futuro se decide traer de vuelta la fuente para algo específico).
- Ninguna decisión de diseño visual nueva: los íconos elegidos son equivalentes semánticos directos de los Material Symbols que reemplazan.

## 5. Criterios de aceptación

Ver `.agents/workflow/tasks/REP-ICONS-SWEEP.yml` AC-01 a AC-04.

## 6. Restricciones

- No cambiar el comportamiento de ninguna pantalla, solo el ícono.
- No introducir dependencias nuevas más allá de lo que ya está en `lucide-react` (ya en `package.json`) y `react-dom/server` (parte de `react-dom`, ya instalado).

## 7. Dependencias

Ninguna — es un fix aislado de UI, no depende del trabajo de REP-2908/2909.

## 8. Riesgos

- El tamaño del bundle creció (~85KB) por el uso de `react-dom/server` en `CitizenMap.jsx` para renderizar los íconos de los marcadores del mapa a HTML estático. Aceptable dado que ya existía una advertencia de chunk grande preexistente (MapLibre).
- No se pudo verificar visualmente cada una de las 21 pantallas en esta sesión (varias requieren login con magic link, que no se puede completar desde acá) — se verificaron 2 (Home, Login) y se confía en la consistencia mecánica del cambio + 144 tests en verde para el resto.

## 9. Impacto

### Frontend
21 archivos de páginas/componentes.

### Backend
Ninguno.

### Database
Ninguno.

### Infraestructura
Ninguno.

### Seguridad
Ninguno.

## 10. Preguntas / incertidumbres

Ninguna.

## 11. Trazabilidad

Manifest: `.agents/workflow/tasks/REP-ICONS-SWEEP.yml`
