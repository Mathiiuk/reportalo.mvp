# Reporte de Ejecución — REP-3787 · Bloque 2 (Revisión, consentimiento y envío)

- **Tarea:** REP-3787 · **Bloque:** 2
- **Pantallas UJ v3.3:** M11 · M13 · M14 → M15 (teléfono) · D12 · D14 · D15 → D16 (escritorio)
- **Tickets relacionados:** REP-2204 · REP-3543 · REP-2501
- **Rama:** `feat/REP-3787-uj33` (un commit por bloque)
- **Base:** `staging` en `542ec57`, sobre los commits de los Bloques 0, 1 y 1-D
- **Fecha:** 21/09/2026
- **Estado:** READY_FOR_PR

---

## 1. Incidencia: primer bloque que no aplicó limpio

`git apply` falló en `src/pages/NewReportPage.jsx`. Era lo previsto: el handoff se genera
contra `5898624` y ese archivo cambió en staging por REP-3789 y REP-2500-PRESEL.

En lugar de forzar el parche o de pedir la regeneración, se hizo un **3-way merge real**. El
3-way directo no funcionaba porque al repositorio le faltaba el blob base de Ivo, pero ese
blob es reconstruible: el `NewReportPage.jsx` previo al Bloque 2 en su cadena es exactamente
el que vino en `archivos/` del Bloque 1, ya que el Bloque 1-D no toca ese archivo.

```
index del parche:                     9225cc8..d15be96
hash de archivos/ del Bloque 1:       9225cc89b1fc9b59ed1ffb56b2dfd7c57e49287d   ← coincide
```

Se escribió ese blob con `git hash-object -w` y `git apply --3way` resolvió sola toda la
cadena salvo dos conflictos, ambos mecánicos. Es la primera vez que la carpeta `archivos/`
resulta útil, y no para copiar archivos sino como **pre-imagen** del 3-way.

## 2. Conflictos resueltos

### `src/pages/NewReportPage.jsx`

Un conflicto. El bloque agrega `evidencesOverride` a la selección de evidencias; staging tenía
ahí el manejo de error de adjuntos que se incorporó al arreglar la policy de INSERT de
`report_images`. Se combinaron: se toma la cascada con `evidencesOverride` del bloque y se
conserva el comentario y el acumulador `failedAttachments` de staging.

### `src/components/report/ReportReviewStep.jsx`

Un conflicto, el más delicado. El bloque reescribe la sección de ubicación con tokens, pero
**su versión no incluye el aviso de localidad autodetectada** (`auto-locality-hint`) de
REP-2500-PRESEL, porque su base no lo tenía.

Aceptar el bloque tal cual habría borrado ese aviso y roto dos tests de
`ReportReviewStep.test.jsx`. Se conservó la estructura nueva del bloque y se volvió a colocar
el aviso dentro de la `<section>`, restilado con los tokens del UJ v3.3
(`rep-accent-border`, `rep-accent-soft`, `text-rep-label`) en lugar de los hex fijos que tenía,
y con el mismo `role="status"` que usa el aviso hermano. Los tokens existen en claro y oscuro
desde el Bloque 0.

La prop `isLocalityAutoSuggested` sigue llegando desde `NewReportPage`, y los dos tests que la
cubren pasan.

## 3. Qué se aplicó

| Archivo | Pantallas | Cambio |
|---|---|---|
| `src/components/report/ConsentSheet.jsx` | M13 · D14 | Nuevo. Hoja de consentimiento versionada. Foco inicial en «Acepto y envío», cierre con Escape. |
| `src/components/report/ReportReviewStep.jsx` | M11 · D12 | Capa visual nueva, dos columnas en escritorio. **Resuelto a mano** (§2). |
| `src/components/report/ReportProcessingScreen.jsx` | M14 · D15 | Solo el `return`. El pipeline de cuarentena y el fail-safe no cambian. |
| `src/components/report/ReportSuccessScreen.jsx` | M15 · D16 | Acuse con tracker de 4 estados y constancia de consentimiento. |
| `src/pages/NewReportPage.jsx` | — | Cambio de flujo (§4). **Resuelto a mano** (§2). |
| `src/test/ReportSubmissionUJ33.test.jsx` | — | Nuevo. 4 tests. |
| 4 tests existentes | — | Ajustados al flujo nuevo. |

## 4. Cambio de flujo: se elimina el paso de vista previa

El UJ v3.3 saca el paso intermedio «Tu foto está lista y protegida» + «Confirmar y enviar». La
aceptación de M13 ya autoriza el envío y M14 encadena con M15.

| Antes | Ahora |
|---|---|
| 3 Revisión → 4 Protección → **5 Vista previa** → 6 Enviado | 3 Revisión → 4 Protección → 6 Enviado |
| La persistencia la disparaba el botón de la vista previa. | La persistencia corre sola al terminar la protección. |
| Si fallaba, quedaba en la vista previa. | Si falla, vuelve a la revisión con el aviso y el borrador intacto. |

Es un cambio de comportamiento, no de estilo: **QA tiene que reprobar el envío completo**,
incluido el camino de error.

`EvidencePreviewScreen` queda en el repositorio sin uso en el flujo (H-16).

## 5. Corrección incluida: reinicio del pipeline de cuarentena (H-17)

En staging, `onProcessingComplete` era una función nueva en cada render. `ReportProcessingScreen`
reinicia el pipeline cuando cambia la referencia de ese callback, así que un re-render durante
la protección podía **volver a subir las fotos**. El bloque lo estabiliza con `useCallback` y
`useRef`.

Vale revisarlo con atención en el PR: es el tipo de arreglo que se rompe solo si alguien
agrega una dependencia al `useCallback` sin darse cuenta.

## 6. Quality Gates

| Gate | Comando | Resultado |
|---|---|---|
| Unit tests | `pnpm test` | **274 / 274 en verde** (39 archivos, 27,1 s) |
| Build | `pnpm build` | **Compila.** PWA `injectManifest`, `dist/sw.js`, 53 entradas de precache |

La baseline sube de 270 a 274 por los 4 tests nuevos del bloque.

## 7. Observaciones nuevas del handoff

| ID | Observación | Responsable |
|---|---|---|
| H-16 | `EvidencePreviewScreen` queda sin uso y conserva el difuminado CSS (REP-3441). La foto anonimizada real debe verse en M16 (Bloque 3). | Matías · Iván |
| H-17 | Reinicio del pipeline por callback inestable. Corregido (§5). | Matías (revisar en PR) |
| H-18 | El UJ muestra términos «v1.2»; el código registra 1.3. La hoja ahora muestra la versión real. | Iván (actualizar el UJ) |
| **H-19** | **El texto de la hoja de consentimiento cambió al del UJ v3.3. Es texto legal: el PO tiene que validarlo y definir si el cambio exige una nueva versión de términos.** | **Hernán (PO)** |
| H-20 | El contador de zonas arranca en «3» fijo hasta que responde el pipeline. | Matías · Iván |
| H-21 | «Ahora no» deja el borrador «en Mis reportes»; hoy vive en IndexedDB y su listado depende del Bloque 6. | Matías |
| H-22 | Los pasos de protección por categoría requieren que el pipeline los informe. | Matías · Hernán (PO) |

**H-19 es la que más conviene mover**: se cambió texto legal de consentimiento sin validación
del PO. No bloquea el bloque, pero sí debería resolverse antes de que esto llegue a producción.

## 8. Pendiente

- **H-19: validación del texto legal por parte de Hernán.**
- Que Ivo revise `useMediaQuery.js`, agregado por desarrollo en el Bloque 1-D.
- Que regenere el Bloque 3 contra la cabeza vigente de `staging`: este ya no aplicó limpio y el
  desfase sigue creciendo.
- Bloque 3 (detalle del reporte y análisis jurídico, M16 / D17): pendiente de entrega.

---

*Reportalo · REP-3787 · Sprint 13 · Matías Krepchuk*
