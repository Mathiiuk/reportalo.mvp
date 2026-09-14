# Reporte de Ejecución: REP-ICONS-SWEEP-run-001

## Identificación
- **Tarea**: REP-ICONS-SWEEP: Reemplazar iconos Material Symbols por Lucide en toda la app
- **Rama**: `fix/REP-ICONS-SWEEP-reemplazar-iconos-material-symbols-por-lucide-en-toda-la-app-fuente-externa-fallaba`
- **Fecha**: 2026-09-14
- **Estado**: Exitoso — Quality Gates 100% aprobados.

---

## 1. Resumen

Se detectó, al pedido puntual de Matías sobre el paso 2 de "Nuevo reporte", que `ReportDetailsStep.jsx` tenía una migración a íconos Lucide incompleta: la variable `IconComponent` se calculaba pero nunca se renderizaba, quedando un `<span className="material-symbols-rounded">{cat.icon}</span>` que mostraba el nombre del ícono como texto plano en vez del glifo. Al revisar el resto de la app se encontró el mismo patrón roto en **20 archivos más** (21 en total), incluida la portada pública (`WelcomePage.jsx`).

Se decidió no depender de que cargue la fuente externa (Google Fonts Material Symbols) para íconos funcionales — Reportalo es explícitamente offline-first, y una fuente remota es un punto de falla frágil para algo tan básico como un botón. Se reemplazaron todos los usos por componentes de `lucide-react` (SVG bundleado, ya dependencia del proyecto).

---

## 2. Archivos modificados (21 + 1 test)

`AppLayout.jsx`, `CitizenMap.jsx`, `AdjustLocationModal.jsx`, `ReportDetailsStep.jsx`, `ReportReviewStep.jsx`, `ReportSuccessScreen.jsx`, `BlankAppPage.jsx`, `CheckEmailPage.jsx`, `LoginPage.jsx`, `MunicipiosPage.jsx`, `NewReportPage.jsx`, `NewsPage.jsx`, `NotFoundPage.jsx`, `NotFoundReportPage.jsx`, `OnboardingPage.jsx`, `PermissionsPage.jsx`, `PlanPage.jsx`, `ProfilePage.jsx`, `ReportsPage.jsx`, `TermsAndPermissionsPage.jsx`, `WelcomePage.jsx` + `src/test/ProfileFlow.test.jsx`.

**Caso especial — `CitizenMap.jsx`**: los marcadores del mapa se arman con `el.innerHTML` sobre un nodo DOM plano (`new Marker({ element })` de MapLibre), no con JSX. Se resolvió usando `renderToStaticMarkup` de `react-dom/server` para renderizar el componente Lucide correspondiente a HTML estático, en vez de copiar SVGs a mano — mantiene un único origen de verdad para cada ícono.

**Hallazgo colateral**: `src/test/ProfileFlow.test.jsx` tenía `expect(screen.getByText('newspaper')).toBeInTheDocument()` — un test que verificaba literalmente el bug (el nombre del ícono como texto). Se corrigió para verificar que el botón contiene un `<svg>`.

**Dejado sin tocar, a propósito**: el ícono dinámico `item.icon` en `NewsPage.jsx` — hoy es código no alcanzable porque `newsItems = []` está hardcodeado en el componente. Documentado en el manifiesto de la tarea.

---

## 3. Evidencia de Quality Gates

- **Vitest**: `npx vitest run` → 25 suites, **144 tests, todos en verde** (incluye la corrección de `ProfileFlow.test.jsx`).
- **Build**: `pnpm run build` → limpio (bundle +85KB por `react-dom/server` en `CitizenMap.jsx`, aceptable).
- **`agt task:verify REP-ICONS-SWEEP`**: `unit_tests` PASS, `build` PASS.
- **Verificación visual**: capturas de `/` (Home) y `/login` en `http://localhost:3001` — íconos (Shield, Sparkles, Map, ArrowLeft, ShieldCheck) renderizan como SVG real, no como texto.

---

## 4. Qué queda pendiente

- No se pudo verificar visualmente cada una de las 21 pantallas en esta sesión — varias requieren login con magic link por correo, que no se puede completar desde acá. Se verificaron 2 pantallas públicas (Home, Login); el resto se apoya en la consistencia mecánica del cambio (mismo patrón aplicado en todos lados) + 144 tests en verde.
- `index.css` sigue teniendo la clase `.material-symbols-rounded` definida — no se removió por si en el futuro hace falta para algo puntual; no genera ningún problema estando sin uso.
- El `<link>` de Google Fonts Material Symbols en `index.html` no se removió — puede quedar como referencia o eliminarse en una pasada de limpieza aparte si Matías confirma que no se usa en ningún lado más (fuera del alcance de esta tarea, que se limitó a los usos funcionales encontrados).
