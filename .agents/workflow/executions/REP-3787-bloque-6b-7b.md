# Reporte de Ejecución — REP-3787 · Bloques 6-B y 7-B (Perfil, onboarding y permisos)

- **Tarea:** REP-3787 · **Bloques:** 6-B (M19 / D20) y 7-B (M04–M07 / D04–D07)
- **Rama:** `feat/REP-3787-bloques-6b-7b`, desde `staging` en `44649f5`
- **Base declarada por el handoff:** `8ab36de` (31 commits detrás de `staging`)
- **Fecha:** 24/09/2026 · **Estado:** READY_FOR_PR

---

## 1. Aplicación

`git am --3way` de los dos parches de Iván, sin conflictos pese a la base vieja. Quedan como dos
commits con autoría de Iván.

| Commit | Bloque | Archivos |
|---|---|---|
| `c2f80a6` | 6-B | `ProfilePage.jsx` |
| `8bc8c33` | 7-B | `OnboardingPage.jsx`, `PermissionsPage.jsx`, `OnboardingFlow.test.jsx` |

Revisados antes de aplicar: colores a tokens del Bloque 0, pictograma en el paso 1 del onboarding y
fila «Apariencia» oculta en Perfil. Sin cambios de lógica. Todos los tokens usados existen en el CSS
compilado.

## 2. Tema por dispositivo (H-09)

| Archivo | Cambio |
|---|---|
| `src/lib/themePreference.js` | Nuevo. Guarda el tema en `localStorage`, arranca en claro y tolera almacenamiento bloqueado. Ahora aloja `THEME_TOGGLE_ENABLED`. |
| `src/main.jsx` | `initTheme()` antes del primer render. |
| `src/components/layout/AppLayout.jsx` | El botón de la barra guarda la preferencia y su ícono ahora cambia al tocarlo (antes no tenía estado y no se actualizaba). Reexporta la constante. |
| `src/pages/ProfilePage.jsx` | La fila «Apariencia» guarda la preferencia. |
| `src/test/ThemePreference.test.js` | Nuevo. 7 tests. |

**El conmutador sigue apagado** (`THEME_TOGGLE_ENABLED = false`): quedan pantallas sin tokens. Con
la constante apagada, el arranque fuerza claro aunque haya un oscuro guardado.

## 3. Quality Gates

| Gate | Resultado |
|---|---|
| `pnpm test` | **434 / 434 en verde** (62 archivos) |
| `pnpm build` | Compila |
| `pnpm test:bdd` | No existe el script en `package.json` |

No se verificó en navegador: Perfil, onboarding y permisos exigen sesión iniciada.

## 4. Datos reales en Perfil y Mis reportes

| Archivo | Cambio |
|---|---|
| `src/pages/ProfilePage.jsx` | Métricas reales (enviados y cerrados desde `citizen_reports`, «sin enviar» desde la cola local); «Resueltos» usa el mismo criterio que Mis reportes para que los números coincidan. Términos reales. Descarga de datos sin estadísticas ni consentimiento inventados. |
| `src/pages/ReportsPage.jsx` | Se quita «Cargar demo» y sus tres reportes ficticios. |
| `src/pages/NewsPage.jsx` · `NewsDetailPage.jsx` · `services/newsService.js` | Se quita la demo de Novedades (`DEMO_NEWS`, «Cargar demo», `?demo=1`). Sin origen de datos (H-46) la pantalla queda en su estado vacío. Los tests de diseño usan publicaciones de prueba definidas en el propio test. |
| `src/test/ProfileFlow.test.jsx` · `MapFlow.test.jsx` | Simulan las fuentes de datos (sin red ni `.env`). Tests nuevos: UT-PF-10 (sin conexión muestra «–») y UT-PF-11 (sin términos aceptados). |

`pnpm test`: **436 / 436**. `pnpm build`: compila.

## 5. Observaciones

| ID | Observación | Responsable |
|---|---|---|
| **Privacidad** | Onboarding (paso 2 y lateral) y permisos siguen prometiendo que «los rostros y las patentes se difuminan automáticamente». El servidor no lo hace (REP-3793). Los parches no agregan la promesa, pero tampoco la corrigen. Definir texto provisorio con el PO. | Hernán / Leo |
| H-09 | Por dispositivo implementado. Falta que Hernán confirme, y decidir cuándo se enciende el conmutador. | Hernán |
| PA-01 | Sin cambios: el código ya sigue el UJ v3.3. Falta corregir criterios de aceptación. | Hernán |
| H-55 | «Descargar mis datos» sigue visible. Iván lo dio por fuera del MVP. | Hernán |
| H-57 | **Resuelta.** Perfil ya no muestra datos fijos: métricas desde `getMyReports` y la cola local (con «–» si no se pueden leer), términos con la versión y fecha reales de la aceptación o «Todavía no los aceptaste», sin nombre ni correo de relleno. «Mis reportes» ya no tiene modo demo. | Matías |
| H-54 · H-56 | Colores sueltos fuera de paleta en onboarding, permisos y perfil (`bg-white` en tarjetas de escritorio incluido): no responden al tema oscuro. | Iván (UX) |

---

*Reportalo · REP-3787 · Sprint 13 · Matías Krepchuk*
