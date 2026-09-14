# Test Plan — REP-ICONS-SWEEP

## 1. Objetivo

Confirmar que ningún ícono se renderiza como texto literal en ninguna pantalla, y que el barrido no rompió ningún flujo existente.

## 2. Riesgos a validar

- Que ningún test quede verificando el nombre del ícono como texto (síntoma del bug original).
- Que el ícono dinámico de `NewsPage.jsx` (dead code) no se rompa si algún día se activa `newsItems`.
- Que los marcadores del mapa (`CitizenMap.jsx`, `innerHTML`) sigan mostrando un ícono coherente por categoría.

## 3. Unit tests

- [x] `pnpm test` completo del repo — 25 suites, 144 tests, en verde.
- [x] `ProfileFlow.test.jsx` corregido: ya no verifica `screen.getByText('newspaper')`, ahora verifica que el botón contiene un `<svg>`.
- [x] Verificación estática: `grep -rl material-symbols-rounded src/` solo devuelve `index.css` (definición de clase, sin uso funcional) y `NewsPage.jsx` (dead code documentado).

## 4. Integration tests

- [ ] Fuera de alcance — no hay entorno con login real disponible en esta sesión.

## 5. E2E tests

- [ ] Fuera de alcance.

## 6. Regression tests

- [x] `pnpm test` completo (no solo los archivos tocados) — 144/144 en verde.

## 7. Security checks

- [ ] No aplica.

## 8. Smoke tests

- [x] Verificación visual manual en el navegador: Home (`/`) y Login (`/login`) — íconos renderizan como SVG (Shield, Sparkles, Map, ArrowLeft, ShieldCheck), no como texto.

## 9. Evidencia requerida

- comando: `pnpm test`; resultado: 25 suites, 144 tests en verde; entorno: local.
- comando: `pnpm run build`; resultado: build sin errores; entorno: local.
- captura: Home y Login en `http://localhost:3001` mostrando íconos reales.

## 10. Resultado

`PASS`
