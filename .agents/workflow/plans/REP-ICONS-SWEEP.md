# Implementation Plan — REP-ICONS-SWEEP

## 1. Resumen

Barrido mecánico: por cada `<span className="material-symbols-rounded ...">nombre_icono</span>`, identificar el equivalente Lucide más cercano semánticamente, importarlo, y reemplazar el span por el componente con las mismas dimensiones/color vía className o `style`.

## 2. Repositorio inspeccionado

- 21 archivos con `material-symbols-rounded` (`grep -rl` sobre `src/`).
- `lucide-react` ya es dependencia del proyecto; varios archivos ya lo usaban parcialmente (patrón de migración incompleta).
- Rama: `fix/REP-ICONS-SWEEP-...`, creada desde `staging` limpio (checkpoint previo: commit `dbaff43` de `ReportDetailsStep.jsx` cherry-pickeado acá).

## 3. Cambios propuestos

### [MODIFY] (21 archivos)
`src/components/layout/AppLayout.jsx`, `src/components/map/CitizenMap.jsx`, `src/components/report/AdjustLocationModal.jsx`, `src/components/report/ReportDetailsStep.jsx`, `src/components/report/ReportReviewStep.jsx`, `src/components/report/ReportSuccessScreen.jsx`, `src/pages/BlankAppPage.jsx`, `src/pages/CheckEmailPage.jsx`, `src/pages/LoginPage.jsx`, `src/pages/MunicipiosPage.jsx`, `src/pages/NewReportPage.jsx`, `src/pages/NewsPage.jsx`, `src/pages/NotFoundPage.jsx`, `src/pages/NotFoundReportPage.jsx`, `src/pages/OnboardingPage.jsx`, `src/pages/PermissionsPage.jsx`, `src/pages/PlanPage.jsx`, `src/pages/ProfilePage.jsx`, `src/pages/ReportsPage.jsx`, `src/pages/TermsAndPermissionsPage.jsx`, `src/pages/WelcomePage.jsx`.

### [MODIFY] (test)
`src/test/ProfileFlow.test.jsx` — la aserción `screen.getByText('newspaper')` probaba el bug; se reemplazó por verificar que el botón contiene un `<svg>`.

## 4. Estrategia de implementación

1. Checkpoint: commitear el fix ya hecho de `ReportDetailsStep.jsx` antes de tocar nada más (pedido explícito de Matías).
2. Rama nueva desde `staging` limpio (no mezclar con la rama de REP-2908/2909).
3. Archivo por archivo: leer, identificar cada ícono, mapear a Lucide, editar, sin cambiar layout/clases de tamaño salvo lo estrictamente necesario para adaptarlas de `text-[Npx]` (fuente) a `w-[Npx] h-[Npx]` (SVG).
4. Caso especial `CitizenMap.jsx`: marcador construido con `el.innerHTML` (DOM plano de MapLibre `Marker({element})`), no JSX — se resuelve con `renderToStaticMarkup` de `react-dom/server`.
5. `pnpm run build` después de cada 3-4 archivos para detectar errores de importación temprano.
6. `pnpm test` al final — reveló que `ProfileFlow.test.jsx` verificaba el bug; se corrigió.
7. Verificación visual en el navegador (Home, Login) para confirmar renderizado real de SVG.

## 5. Migraciones / datos

Ninguna.

## 6. Seguridad

Ninguna implicancia.

## 7. Observabilidad

N/A.

## 8. Compatibilidad / rollback

Cambio de UI puro y reversible por archivo; sin cambios de API ni de datos.

## 9. Plan de verificación

- [ ] Lint — no obligatorio en el manifiesto.
- [ ] Typecheck — no aplica (proyecto JS).
- [x] Unit — `pnpm test` (144 tests, 25 suites).
- [ ] Integration — no aplica.
- [ ] E2E — no aplica.
- [x] Build — `pnpm run build`.
- [ ] Security — no aplica.
- [ ] Smoke — verificación visual manual (Home, Login) en el navegador.

## 10. Definition of Done

- 0 ocurrencias de `material-symbols-rounded` fuera de `index.css` y el dead-code documentado de `NewsPage.jsx`.
- `pnpm test` y `pnpm run build` en verde.
- Verificación visual de al menos 2 pantallas.

## 11. Aprobación requerida

- [x] No requerida — fix de UI sin riesgo de datos/seguridad.
- [ ] Requerida

## 12. Notas de ejecución

Ver `.agents/workflow/executions/REP-ICONS-SWEEP-run-001.md`.
