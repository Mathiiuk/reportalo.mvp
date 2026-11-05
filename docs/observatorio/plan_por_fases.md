# Observatorio y tablero de gestión · plan de implementación por fases

> Base: [observatorio_v5.html](observatorio_v5.html) (POC v5, datos simulados de REP-3906, identidad de Iván del 03/11).
> Encuadre del PM (REP-3906/3907, 31/10): **post-MVP**. Se adelanta en la rama
> `feat/OBS-observatorio-del-vecino-y-tablero-del-organismo` (desde `staging`, 04/11/2026) sin tocar los sprints 19–21.

## 0. Decisiones (Matías, 04/11/2026)

| # | Tema | Decisión | Consecuencia en el plan |
|---|---|---|---|
| 1 | Dónde | Rama aparte para ir adelantando | Todo vive en esta rama; nada se aplica en staging sin OK |
| 2 | ¿Sin cuenta? | **No.** Para ver hay que iniciar sesión (la infraestructura no aguanta tráfico abierto) | Ninguna vista ni RPC para `anon`. Todas las rutas `/observatorio/*` van con `ProtectedRoute` |
| 3 | Datos | **Los reportes reales** de la base | Sin dataset simulado ni esquema demo. Sin la franja «Datos simulados» |
| 4 | Organismos | Los dos de hoy: **CABA** (`jurisdiction_level = state_province`) y **Avellaneda** (`subdivision`) | Se reusa la regla de jurisdicción del panel (REP-3747) |
| 5 | Orden | **Primero el vecino, después el organismo** | F0a → F1 → F2 → F3 → F4 → F0b → F5 → F6 |

## 1. Tableros por usuario u organismo

| # | Quién | Pantallas del POC | Alcance territorial | Qué ve | Vista principal |
|---|---|---|---|---|---|
| T1 | **Vecino con sesión** | Mapa (D57/M50), Metodología (D61/M54), estados vacíos (D60/M53) | País › Provincia › Comuna/Partido › Barrio/Localidad | Solo agregados con `open311_status` (open/closed). Sin fotos, sin descripciones, zoom máx. 15, nada de % ni días con menos de 5 casos | Escritorio y teléfono por igual |
| T2 | **Vecino con sesión · Mi barrio** | Mi barrio (D56/M49) | 1 zona por día, comparada con su jurisdicción | % resueltos, mediana/p90 de días, problemas que vuelven, qué se reporta, lo que más se reporta | **Teléfono** |
| T3 | **Vecino con sesión · Comparar** | Comparar (D59/M52) | Hasta 3 zonas de cualquier nivel | Lo de T2 lado a lado + días por categoría con plazo | Escritorio; en el teléfono, chips y gráficos apilados |
| T4 | **Organismo Avellaneda** (`Reportalo Avellaneda`, `oficial.avellaneda`) | Tablero de gestión (D55/M48) | Su partido › localidades; no puede subir | Lo público + estados internos: cumplimiento de plazo, atraso, fuera de plazo, embudo, primera respuesta, escalados/discrepancia | **Escritorio**; en el teléfono sin embudo ni primera respuesta |
| T5 | **Organismo CABA** (`Reportalo CABA`, `oficial.caba`, `operador_caba`) | Tablero de gestión (D55/M48) | Ciudad › comunas › barrios | Igual que T4 | Escritorio |

Fuera de este plan: el admin de Reportalo (no está en el POC) y la Bandeja/Operadores, que ya existen en `/panel` (REP-3000/3001/3747/3749).

Regla que atraviesa todo: **mismos números para todos**. Las tarjetas «Público» del tablero del organismo salen de las mismas funciones que ve el vecino.

## 2. Qué hay hoy en `staging` (relevado el 04/11/2026)

**Datos reales:** 553 reportes, ago–nov 2026, 223 en Avellaneda y 330 en 13 comunas de CABA. Estados: 330 EN_ANALISIS, 174 RECIBIDO, 25 INFORMADO, 17 DERIVADO, **5 RESUELTO, 2 DESESTIMADO**. 464 filas en `report_state_history`.

Consecuencia: volumen, categorías, evolución mensual y mapa tienen datos; **% resueltos, días y cumplimiento de plazo van a salir casi siempre «—»** (menos de 5 casos). Es el comportamiento correcto, no un error: los estados vacíos del POC (D60) pasan a ser lo que más se ve al principio.

| Necesidad del POC | Estado | Brecha |
|---|---|---|
| Territorio de 4 niveles | `countries › states_provinces › subdivisions › localities` | OK |
| 8 estados y Open311 | `report_states.open311_status` cargado | OK |
| Historia de estados | `report_state_history(state_code, changed_at, actor_type, actor_agency_id)` | OK |
| Categorías | `services.service_code`: INFRAESTRUCTURA, TRANSITO, AMBIENTE, COMERCIO_IRREGULAR, VULNERABILIDAD_SOCIAL | VULNERABILIDAD_SOCIAL queda **siempre afuera** (REP-3906) |
| Prestaciones (37) | **No están en el reporte** (la app no pregunta la prestación) | «Lo que más se reporta» y los filtros van por **categoría**; prestación queda para cuando exista el dato |
| Plazos por categoría (PO 03/11: 90 / 7 / 7 / 30) | No existen | Tabla `observatorio_plazos` |
| Jurisdicción del organismo | `agencies.jurisdiction_level` + `profile_attends_report` (REP-3747/3000) | Reusar la misma regla de jurisdicción, sin la de elegibilidad de la bandeja |
| Guard del organismo | `OperatorRoute`, `PanelShell` en `/panel` | El tablero va en `/panel/tablero` |
| Población | No hay | Columna «cada 10.000 hab.» en «s/d» hasta cargar Censo 2022 (F6) |
| Polígonos | No hay; centroides en `localityCentroids.js` | Círculos en el centroide, como el POC |
| Agregados | No hay | F0a |
| Gráficos | Ninguna librería | Chart.js 4 (el POC ya está hecho con él) |
| Íconos | La app usa Lucide; el POC Material Symbols | Traducir a Lucide |

## 3. Fases

Mobile y escritorio van en la misma fase: es el mismo componente con dos grillas.

### F0a · Funciones de agregados para el vecino
- `observatorio_plazos(service_code, plazo_dias)` con los plazos del PO.
- RPCs `security definer`, solo `authenticated`, que devuelven **solo agregados**:
  - `obs_resumen(nivel, zona_id, desde, hasta, service_code)` → reportes, resueltos, mediana/p90 de días, problemas que vuelven, cumplimiento.
  - `obs_por_mes(...)`, `obs_por_categoria(...)`, `obs_hijos(...)` (zonas hijas con sus métricas).
- Regla de < 5 **en el servidor**: con n < 5 la cantidad sale, % y días salen `null`.
- Excluye VULNERABILIDAD_SOCIAL y los reportes sin localidad.
- «Resuelto» = estado actual RESUELTO; días = primer RESUELTO en `report_state_history` − `created_at`.
- Pruebas: consultas de solo lectura contra staging y tests de Vitest de los servicios.

### F1 · Esqueleto del observatorio + Metodología + estados vacíos (T1)
- Rutas `/observatorio/*` con `ProtectedRoute`; barra superior en escritorio y **tabs inferiores Mi barrio · Mapa · Comparar · Metodología** en el teléfono.
- Componentes: `Kpi`, `ObsCard` con sello Público / Solo organismo, franja sin conexión, filtros (período, categoría), chips, migas, `EmptyState` de la app.
- Metodología con las fórmulas reales. Estados: sin reportes, menos de 5, sin dato oficial, sin conexión.
- Entrada al observatorio desde la app del vecino (a definir: perfil o navegación).

### F2 · Mi barrio (T2) · teléfono primero
- Selector de zona, KPIs de a dos (teléfono) o de a cuatro (escritorio), % resueltos por mes con franja «Todavía abiertos», torta por categoría que filtra, «Cómo leer estos datos».
- Cuota de 1 consulta por día **en el servidor** (`obs_consultas(user_id, fecha, zona)`).

**Hecho (05/11/2026), con estos cambios contra el POC por los datos reales:**
- «% resueltos por mes» → **«Reportes por mes» con la parte resuelta adentro**: con 5 resueltos en toda la base, la línea
  de porcentajes salía vacía casi siempre. La franja «Todavía abiertos» es un rayado (en oscuro un fondo liso se
  confundía con las columnas).
- «Problemas que vuelven» → **«Cumplimiento de plazo»** (la reincidencia espera la definición del PO).
- «Top 5 prestaciones» → **«Cómo se resuelve cada categoría»** (el reporte no guarda la prestación).
- **Sin la cuota diaria todavía**: es una hipótesis comercial (REP-3407) sin decidir, y 1 o 2 zonas está pendiente con
  Hernán. Se agrega cuando se decida (migración + RPC, no en el cliente).
- Gráficos en HTML/SVG propios, sin Chart.js: con 2 gráficos simples no justificaba sumar la librería. Se revisa en F3/F5.
- Orden fijo de categorías **Infraestructura · Ambiente · Tránsito · Comercio**: con el orden alfabético, en oscuro el
  naranja y el amarillo quedaban juntos y no se distinguían (validador de paleta: ΔE 11,8 < 15).
- **Para Iván:** en oscuro los 4 colores de categoría quedan más claros que la banda recomendada para gráficos
  (L 0,72–0,83). Se compensa con leyenda y números siempre visibles; si quiere, que los ajuste en la guía.

### F3 · Mapa de calor con bajada de 4 niveles (T1)
- MapLibre con un círculo por zona hija, escala monocromo azul, gris si n < 5; tocar baja un nivel; migas para subir.
- Tabla de zonas hijas por número o alfabética (nunca ranking), hasta 3 casillas y «Comparar».
- Teléfono: mapa a lo ancho, tabla debajo, sin selector de nivel.

### F4 · Comparar (T3)
- Hasta 3 zonas; «Primero, la respuesta» contra su jurisdicción; % resueltos por mes; días por categoría con marca de plazo.
- Teléfono: chips de color, tres cifras por fila, gráficos apilados. Sin precio ni pago.

### F0b · Funciones del organismo
- RPCs `obs_org_*` que **fijan la jurisdicción desde el perfil** (`profiles.agency_id → agencies`), con la misma regla de alcance que `profile_attends_report` (provincia o subdivisión), sobre **todos** los reportes de la jurisdicción (no solo los de la bandeja).
- Estados internos: fuera de plazo, atraso por antigüedad, embudo, primera respuesta (días hasta DERIVADO), escalados y discrepancia.

### F5 · Tablero de gestión (T4, T5)
- `/panel/tablero` dentro de `OperatorRoute` + `PanelShell` (pestaña «Tablero» junto a la bandeja).
- Migas bloqueadas por encima de la jurisdicción.
- KPIs de 6, barras de cumplimiento con meta 80 %, cumplimiento mes a mes, atraso, fuera de plazo por mes, embudo, primera respuesta, días por categoría, tabla de zonas (rojo si > 25 % fuera de plazo), mapa de abiertos.
- Teléfono: KPIs de a dos, barras de plazo y atraso; embudo y primera respuesta solo en escritorio.
- «Compromiso social»: lugar reservado vacío.

### F6 · Endurecimiento y pendientes
- Censo 2022, polígonos reales, duplicados / reincidencia / puntos crónicos con celda espacial fija, prestaciones cuando el reporte las tenga.
- Vistas materializadas si alguna RPC pasa de ~300 ms.
- QA de Iván: lector de pantalla, teléfono chico, sin conexión, oscuro; auditoría de privacidad (ninguna respuesta con id, coordenada o texto de reporte).

### Dependencias
```
F0a ─> F1 ─┬─> F2
           ├─> F3 ─> F4
           └─> F0b ─> F5 ─> F6
```

## 4. Decisiones pendientes del POC (no frenan F0a–F1)

| Tema | Propuesta del POC | Decide |
|---|---|---|
| Zonas por día | 1 (¿o 2: casa y trabajo?) | Hernán (PO) |
| Umbral de casos | 5 | Hernán + Matías |
| Reincidencia / crónicos / duplicados | 90 y 30 días · 3+ en 30 días · mismo lugar y categoría | Hernán |
| Escala del mapa | Monocromo azul en lugar del verde-rojo de la guía §7.4 | Iván |
| Dónde entra el vecino al observatorio | Pestaña en la navegación o acceso desde el perfil | Matías / Iván |
