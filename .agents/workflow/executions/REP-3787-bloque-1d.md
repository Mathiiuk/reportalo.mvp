# Reporte de Ejecución — REP-3787 · Bloque 1-D (Nuevo reporte, escritorio)

- **Tarea:** REP-3787 · **Bloque:** 1-D — Nuevo reporte escritorio
- **Pantallas UJ v3.3:** D10 «Subir la foto» · D11 «Clasificar» · D13 «Ajustar ubicación»
- **Rama:** `feat/REP-3787-uj33` (un commit por bloque)
- **Base:** `staging` en `542ec57`, sobre los commits de los Bloques 0 y 1
- **Fecha:** 21/09/2026
- **Estado:** READY_FOR_PR

---

## 1. Incidencia: el bloque llegó incompleto

El parche importa `useIsDesktopLayout` desde `../../hooks/useMediaQuery`, pero **ese módulo no
venía en la entrega**: no estaba en el repositorio, ni en el `.patch`, ni en la carpeta
`archivos/`. El primer intento de aplicación dejó el build roto:

```
Could not resolve "../../hooks/useMediaQuery" from "src/components/report/EvidenceCaptureStep.jsx"
```

Se revirtió el parche y se revisaron todos los imports relativos de los seis archivos del
bloque: era el único faltante. Con autorización de Matías, **lo escribió desarrollo**, no UX.

### `src/hooks/useMediaQuery.js` (agregado por desarrollo)

Exporta `useMediaQuery(query)`, `useIsDesktopLayout()` y la constante `DESKTOP_MEDIA_QUERY`.
El contrato no se inventó: lo fija el propio test del bloque
(`src/test/EvidenceUploadDesktop.test.jsx`), que mockea `window.matchMedia` devolviendo
`{ matches, media, addEventListener, removeEventListener }`.

Decisiones de implementación:

- **Breakpoint `(min-width: 1025px)`**, según el §10 y el README del bloque. Entre 641 y
  1024 px se usa el layout de teléfono.
- **Tolera que `matchMedia` no exista** y devuelve `false` en ese caso. Es lo que importa: el
  `afterEach` del test nuevo hace `delete window.matchMedia`, y `EvidenceCaptureFlow`,
  `NewReportFlow` y `OfflineReportFlow` renderizan `EvidenceCaptureStep` sin mockearlo. Si el
  hook no lo contemplara, esas tres suites se caerían aunque el bloque estuviese bien.
- Suscripción por `addEventListener('change', …)`, con respaldo a `addListener` para
  navegadores viejos, verificando que el método exista antes de llamarlo.
- Resincroniza el valor dentro del efecto, por si el ancho cambió entre el primer render y el
  montaje, o si un test reemplazó el mock.

**Queda pendiente que Ivo lo revise**, por si su implementación original usaba otro breakpoint
o alguna consideración de diseño que acá no se ve.

## 2. Qué se aplicó

| Archivo | Pantalla | Cambio |
|---|---|---|
| `src/hooks/useMediaQuery.js` | — | **Nuevo, agregado por desarrollo** (ver §1). |
| `src/components/report/EvidenceUploadDesktop.jsx` | D10 | Nuevo. Zona de arrastre, selector múltiple y panel lateral. Mismas props que `EvidenceCaptureStep`. |
| `src/components/report/EvidenceCaptureStep.jsx` | D10 / M09 | El export público elige cámara o carga de archivos con `useIsDesktopLayout()`. El componente de cámara no cambia. |
| `src/components/report/ReportDetailsStep.jsx` | D11 | Clases `desktop:`: categorías 2 × 2 a la izquierda, descripción en columna propia. |
| `src/components/report/ReportFlowHeader.jsx` | D10 · D11 | En escritorio, volver, título y pasos en una fila. |
| `src/components/report/AdjustLocationModal.jsx` | D13 | Mapa a todo el ancho, tarjeta flotante de confirmación. **Corrige el centrado del pin (H-12).** |
| `src/test/EvidenceUploadDesktop.test.jsx` | D10 | Nuevo. 4 tests. |

El parche aplicó sin conflictos y sin offsets.

## 3. Corrección funcional incluida (H-12)

Este bloque no es solo visual. La punta del pin de ajuste de ubicación estaba al 44 % del alto
del mapa, mientras que la coordenada que se confirma es el centro. Es decir, **el reporte se
guardaba en un punto distinto del que el usuario veía marcado**. El bloque alinea las dos cosas,
y el arreglo aplica también en teléfono.

Conviene que QA lo verifique explícitamente: es un cambio de comportamiento, no de estilo.

## 4. Quality Gates

| Gate | Comando | Resultado |
|---|---|---|
| Unit tests | `pnpm test` | **270 / 270 en verde** (38 archivos, 25,4 s) |
| Build | `pnpm build` | **Compila.** PWA `injectManifest`, `dist/sw.js`, 53 entradas de precache |

La baseline sube de 266 a 270 por los 4 tests nuevos del bloque. Sin regresiones: las suites
del recorrido mobile siguen en verde, lo que confirma que el hook agregado no las afecta.

## 5. Diferencias deliberadas con el diseño

Las declara el README del bloque y se aceptan:

| Pantalla | Diseño | Implementación | Motivo |
|---|---|---|---|
| D10 | «JPG o PNG · máx. 4 archivos» | También acepta WebP | `useEvidenceCapture` ya lo admite. |
| D10 | Miniaturas sin botón de borrar | Con «×» por foto | El borrado individual es requisito del recorrido. |
| D13 | Barra superior global, sin «volver» | Cabecera del recorrido con «volver a la revisión» | La barra global es del Bloque 5 (H-13). |
| D13 | «Av. Mitre 1240 · precisión ±8 m» | Punto marcado + localidad elegida | Sin geocodificación inversa (H-10). |

## 6. Para probar en staging (ventana ≥ 1025 px)

1. Reportar → arrastrar 2 fotos juntas y después 3 más: deben entrar 4 y aparecer el aviso de máximo.
2. Borrar una miniatura, agregar con «+», Continuar.
3. Recorrer las categorías con Tab y flechas; volver con «Atrás».
4. Revisar → Ajustar: **el pin debe marcar el centro** (H-12); confirmar desde la tarjeta flotante.
5. Achicar la ventana por debajo de 1025 px: vuelve el layout de teléfono sin perder las fotos.
6. Repetir con `document.documentElement.classList.add('dark')`.

## 7. Pendiente

- **Que Ivo revise `useMediaQuery.js`** y confirme el breakpoint.
- Recordarle que regenere los bloques siguientes contra la cabeza vigente de `staging`.
- **Push y PR: los hace Matías.** El agente no ejecutó `git push`.
- Bloque 2 (revisión, consentimiento y envío): pendiente de entrega.

---

*Reportalo · REP-3787 · Sprint 13 · Matías Krepchuk*
