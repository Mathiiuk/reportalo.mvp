# Reporte de Ejecución — REP-3787 · Bloque 8 (Novedades)

- **Tarea:** REP-3787 · **Bloque:** 8 · **Pantallas:** M24 · M25 / D31 · D32
- **Rama:** `feat/REP-3787-uj33` · **Base declarada:** `a549ba5` (Bloque 5)
- **Fecha:** 22/09/2026 · **Estado:** READY_FOR_PR

---

## 1. Aplicación

El parche falló en **`src/App.jsx`**. Era previsible: su base era `a549ba5`, y el Bloque 6
agregó después la ruta `/notificaciones` en el mismo registro. El propio Ivo lo anticipó en el
README del Bloque 9.

Se resolvió a mano en lugar de con `git apply -3`, porque eran dos agregados sin ambigüedad: el
import diferido de `NewsDetailPage` y la ruta `/novedades/:id`. El resto del bloque aplicó limpio.

| Archivo | Cambio |
|---|---|
| `src/pages/NewsPage.jsx` | Capa visual nueva: una novedad destacada, el resto compactas y filtros por origen. |
| `src/components/news/NewsCard.jsx` | Nuevo. Variante destacada y compacta. |
| `src/pages/NewsDetailPage.jsx` | Nueva. Nota completa con origen, fecha, organismo y compartir. |
| `src/services/newsService.js` | Nuevo. Punto único donde enchufar la consulta real. |
| `src/App.jsx` | Ruta `/novedades/:id`. **Resuelto a mano.** |
| `src/test/Bloque8NovedadesUJ33.test.jsx` | Nuevo. 3 tests. |

## 2. Quality Gates

| Gate | Comando | Resultado |
|---|---|---|
| Unit tests | `pnpm test` | **298 / 298 en verde** (46 archivos) |
| Build | `pnpm build` | **Compila.** PWA con service worker propio |

## 3. Observación principal

**H-46 — no hay origen de datos para Novedades.** No existe tabla de publicaciones ni panel
donde el municipio las cargue, así que la pantalla muestra su estado vacío, con contenido de
demostración detrás de un botón. El servicio deja `NEWS_SOURCE_READY` y `getPublishedNews` como
punto único de enganche.

Definir el modelo —origen, organismo, fecha, cuerpo, imagen, ubicación— es trabajo de producto.
Es el mismo patrón que el mapa tenía hasta hoy: pantalla lista, datos ausentes. La diferencia es
que acá el bloque **no** finge tenerlos.

---

*Reportalo · REP-3787 · Sprint 13 · Matías Krepchuk*
