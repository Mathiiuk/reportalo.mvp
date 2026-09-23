# Reporte de Ejecución — REP-3787 · Bloque 1 (Nuevo reporte, mobile)

- **Tarea:** REP-3787 · **Bloque:** 1 — Nuevo reporte mobile
- **Pantallas UJ v3.3:** M09 «Capturar» · M10 «Clasificar» · M12 «Ajustar ubicación»
- **Tickets relacionados:** REP-2202 · REP-2203 · REP-2301
- **Rama:** `feat/REP-3787-uj33` (un commit por bloque)
- **Base:** `staging` en `542ec57`, sobre el commit del Bloque 0
- **Fecha:** 21/09/2026
- **Estado:** READY_FOR_PR

---

## 1. Qué se aplicó

Vía `git apply` del parche `bloque-1-nuevo-reporte-mobile.patch`. **No** se usó `archivos/`.

| Archivo | Pantalla | Cambio |
|---|---|---|
| `src/components/report/ReportFlowHeader.jsx` | M10 | Nuevo. Cabecera compartida con pasos Foto → Detalle → Enviar. |
| `src/components/report/categoryTone.js` | M10 | Nuevo. Color por categoría con tokens. No toca `categoriesService`. |
| `src/components/report/EvidenceCaptureStep.jsx` | M09 | Capa visual nueva. Misma lógica de captura y límite de 4 fotos. |
| `src/components/report/ReportDetailsStep.jsx` | M10 | Capa visual nueva + navegación por teclado en la grilla. |
| `src/components/report/AdjustLocationModal.jsx` | M12 | Solo el bloque `return`. La lógica del mapa no cambia. |
| `src/components/report/LocalitySelector.jsx` | M12 | Capa visual + etiquetado accesible. |
| `src/pages/NewReportPage.jsx` | — | Tres clases de fondo a tokens. Sin cambios de lógica. |

Aplicación sin conflictos. Dos hunks de `NewReportPage.jsx` entraron con offset de 81 y 85
líneas, por REP-3789 y REP-2500-PRESEL.

## 2. Verificación de no regresión sobre NewReportPage.jsx

Era el archivo de mayor riesgo: cambió 99 líneas en staging después de que se generara el
bloque. El parche tocó **exactamente tres clases de fondo** y nada más:

```
- ? 'bg-[#0E1116]'      + ? 'bg-rep-camera'
- : 'bg-[#F4F7FB]'      + : 'bg-rep-bg'
- className="fixed inset-0 z-50 bg-white"
+ className="fixed inset-0 z-50 bg-rep-surface"
```

Los 6 marcadores de REP-2500-PRESEL y REP-3789 (`findNearestLocality`, `buildShortCode`,
`reportDetailService`) siguen presentes. Sin pérdida de trabajo mergeado.

## 3. Quality Gates

| Gate | Comando | Resultado |
|---|---|---|
| Unit tests | `pnpm test` | **266 / 266 en verde** (37 archivos, 27,8 s) |
| Build | `pnpm build` | **Compila.** PWA `injectManifest`, `dist/sw.js`, 53 entradas de precache |

## 4. Incidente de verificación: fallos por timeout, no por código

Las dos primeras corridas de la suite dieron rojo, primero 3 fallos y después 6, en
`OfflineReportFlow.test.jsx` y otros, con mensajes de `Test timed out in 5000ms`. La duración
había saltado de 27 s a 364 y 413 s.

Diagnóstico, en este orden:

1. `OfflineReportFlow.test.jsx` **aislado**: 4/4 en verde.
2. Los fallos **no eran los mismos** entre corridas: 3 y después 6. No determinista.
3. Se apartó el Bloque 1 (`git stash` de los archivos tocados) y se corrió la suite **sin él**:
   también falló, 2 tests, 311 s. **El bloque no era la causa.**
4. Con `--testTimeout=30000`: 266/266 en verde, 52 s.
5. Restaurado el bloque y repetido `pnpm test` estándar: 266/266 en verde, 27,8 s.

Conclusión: carga transitoria de la máquina, no regresión. Queda anotado porque con la suite
al límite de los 5 s por test, cualquier equipo lento o un CI cargado va a dar rojos
intermitentes en `OfflineReportFlow`, `LocationFlow` y `AdjustLocationModal`, que montan
MapLibre en jsdom. Vale la pena subir el `testTimeout` del proyecto antes de conectar CI (H-07).

## 5. Diferencias deliberadas con el diseño

Las declara el README del bloque y se aceptan:

| Pantalla | Diseño | Implementación | Motivo |
|---|---|---|---|
| M09 | Flash y cambio de cámara | No se muestran | Con `<input capture>` los maneja la cámara del sistema (H-11). |
| M10 | Textos de 10 a 11,5 px | 12 a 16 px | Escala real del §10; los mockups están dibujados a escala reducida. |
| M12 | «Av. Mitre 1240 · precisión ±8 m» | Punto marcado + localidad elegida | No hay geocodificación inversa ni precisión real (H-10). |
| M12 | Sin selector de localidad | Con selector | Reglas R-1 a R-5 de REP-2500, aprobadas por PO. |

## 6. Pendiente de definición de producto

Sin resolver, no bloquean el bloque pero sí la prueba de QA de M10:

- **H-03:** el seed y el respaldo offline usan «Infraestructura vial»; el UJ v3.3 dice «Infraestructura».
- **H-04:** producción tiene una 5ª categoría, «Vulnerabilidad social», que el UJ reemplaza por «Comercio irregular». La grilla de M10 mostraría 5 opciones.
- **H-05:** `NewReportPage` preselecciona «Infracción de tránsito», por lo que el caso negativo de REP-2202 no ocurre. El bloque ya trae el aviso «Elegí una categoría para continuar.» si llega vacía.

Los tres necesitan definición de Hernán.

## 7. Para probar en staging

1. Mapa → Reportar → 1 a 4 fotos: contador, visor, borrar una y borrar todas.
2. Continuar → elegir categoría con toque y con flechas; la ayuda cambia de color.
3. Escribir la descripción en iPhone: el campo no debe hacer zoom (16 px).
4. Revisar → Ajustar: arrastrar el mapa, elegir localidad, provocar el aviso de barrio lejano.
5. Repetir con `document.documentElement.classList.add('dark')`.

## 8. Pendiente

- **Push y PR: los hace Matías.** El agente no ejecutó `git push`.
- Bloque 1-D (escritorio, D10 · D11 · D13): pendiente de entrega por parte de Ivo.

---

*Reportalo · REP-3787 · Sprint 13 · Matías Krepchuk*
