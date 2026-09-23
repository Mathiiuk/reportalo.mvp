# Reporte de Ejecución — REP-3787 · Bloque 0 (Fundaciones)

- **Tarea:** REP-3787 · **Bloque:** 0 — Fundaciones (§10 del UJ v3.3)
- **Rama:** `feat/REP-3787-uj33` (un commit por bloque)
- **Base:** `staging` en `542ec57` (merge del PR #95, REP-3774)
- **Origen del bloque:** REP-3791, handoff de Iván Juárez
- **Fecha:** 21/09/2026
- **Estado:** READY_FOR_PR

---

## 1. Qué se aplicó

Vía `git apply` del parche `bloque-0-fundaciones.patch`. **No** se usó la carpeta `archivos/`.

| Archivo | Cambio |
|---|---|
| `src/styles/tokens.css` | Nuevo. Colores del UJ v3.3 como variables CSS, con valor claro y oscuro. |
| `tailwind.config.js` | `darkMode: 'class'`, colores `rep-*` y `cat-*`, escala `text-rep-*`, `min-h-touch`/`min-w-touch`, `opacity-45`, `duration-120`, sombras. Se conserva la paleta `brand`. |
| `src/index.css` | Importa `tokens.css`, fondo global a `rgb(var(--rep-bg))`, clase `rep-focus`. |

Aplicación sin conflictos. Dos hunks de `index.css` entraron con offset de 13 líneas, por los
cambios que REP-3789 había dejado en ese archivo.

## 2. Quality Gates

| Gate | Comando | Resultado |
|---|---|---|
| Unit tests | `pnpm test` | **266 / 266 en verde** (37 archivos) |
| Build | `pnpm build` | **Compila.** PWA `injectManifest`, 79 módulos, `dist/sw.js` generado, 53 entradas de precache (2624,59 KiB) |

Sin regresiones. La suite quedó 100 % en verde.

## 3. Hallazgo: la observación H-06 ya no aplica

El handoff reportaba `UT-QPS-14` y `UT-QPS-15` como rojos preexistentes desde el commit
`1837432`. El merge del PR #95 (REP-3774) modificó `src/services/quarantinePipelineService.js`
y con eso los dos tests quedaron corregidos.

La baseline del ticket pasa de «242 tests, 240 verdes, 2 rojos admitidos» a
**«266 tests, 266 verdes, sin rojos admitidos»**. A partir de acá, cualquier rojo tras aplicar
un bloque es una regresión introducida por el bloque.

## 4. Desfase de base entre el handoff y staging

Los bloques se generaron contra `5898624` (18/09). Durante esta jornada staging avanzó dos
veces: primero a `f75a619` y después a `542ec57`. El Bloque 0 sigue aplicando limpio porque
solo toca archivos de estilos, pero el desfase crece.

Conviene que Ivo regenere los bloques que todavía no entregó contra la cabeza vigente.

## 5. Impacto visible

Según el README del bloque, el único cambio visible global es el fondo de `html`/`#root`:
pasa de `#F8FAFC` a `#F4F7FB`. El resto de las pantallas no cambia hasta que se migren a
tokens en los bloques siguientes.

El modo oscuro queda **apagado** y no hereda el sistema operativo, como pide el §10. Se
enciende agregando la clase `dark` al `<html>`. La preferencia «por cuenta» necesita un campo
de perfil en backend y espera su propia historia (H-09).

## 6. Diferencias postergadas

Ninguna en este bloque. Las observaciones H-03, H-04 y H-05 (categorías) afectan al Bloque 1
y dependen de una definición de Hernán.

## 7. Pendiente

- **Push y PR: los hace Matías.** El agente no ejecutó `git push`.
- Bloque 1 (mobile) ya entregado y verificado, a la espera del OK para aplicarlo.
- Bloque 1-D (escritorio) pendiente de entrega por parte de Ivo.

---

*Reportalo · REP-3787 · Sprint 13 · Matías Krepchuk*
