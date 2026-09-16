# 🚀 Guía de Replicación del Sistema y Continuidad Operativa
## Reportalo™ MVP — Manual de Onboarding, Arquitectura y Continuidad (Bus Factor 0)

> [!IMPORTANT]
> **Propósito de esta guía:** Permitir que cualquier desarrollador del equipo (especialmente **Iván**, **Hernán** o cualquier nuevo integrante) pueda clonar, configurar, levantar, depurar, testear y continuar el desarrollo de **Reportalo™** desde cero sin depender de la presencia o intervención directa de **Matías**.

---

## 1. 🏗️ Ficha Técnica del Stack y Arquitectura

Reportalo es una **Progressive Web App (PWA)** pensada para funcionar en condiciones adversas de conectividad (offline-first), con altos estándares de privacidad ciudadana y fundamentación jurídica asistida por IA.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ARQUITECTURA REPORTALO                          │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   [ CLIENTE PWA ] (React 18 + Vite + Tailwind CSS + Framer Motion)     │
│   ├── UI & Rutas: React Router v7 (Hash/BrowserRouter)                 │
│   ├── Mapas: MapLibre GL + Geolocation API nativa                      │
│   ├── Offline & Borradores: IndexedDB (reportalo_offline_db)           │
│   └── Sanitización Local: Parser binario JPEG/EXIF (metadataSanitizer) │
│                                                                        │
│   ↕ HTTPS / WSS                                                        │
│                                                                        │
│   [ BACKEND / CLOUD ] (Supabase BaaS + Edge Functions Deno)            │
│   ├── Base de Datos: PostgreSQL 17 + Extensión pgvector                │
│   ├── Seguridad: Row Level Security (RLS) habilitado en 100% de tablas │
│   ├── Storage:                                                         │
│   │   ├── evidence-quarantine (Bucket privado transitorio)             │
│   │   └── report-evidences (Bucket público de evidencias protegidas)   │
│   ├── Edge Function: quarantine-anonymize (Deno / TypeScript)          │
│   │   └── Integración: Google Cloud Vision API (Rostros / Patentes)    │
│   └── Motor RAG: pgvector RPC match_normativas + Gemini 768d           │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 💻 Requisitos Previos en la Máquina de Desarrollo

Antes de comenzar, asegúrate de tener instalado en tu sistema:
1. **Node.js**: Versión `18.x` o `20.x` LTS ([Descargar](https://nodejs.org/)).
2. **pnpm**: Gestor de paquetes obligatorio del proyecto:
   ```bash
   npm install -g pnpm
   ```
3. **Git**: Cliente de control de versiones.
4. *(Opcional)* **Supabase CLI**: Para desarrollo local de Edge Functions ([Instrucciones](https://supabase.com/docs/guides/cli)).

---

## 3. ⚡ Puesta en Marcha en 5 Minutos (Paso a Paso)

### Paso 1: Clonar el Repositorio
```bash
git clone https://github.com/Mathiiuk/reportalo.mvp.git
cd reportalo.mvp
```

### Paso 2: Instalar Dependencias
```bash
# IMPORTANTE: Usar pnpm para respetar el archivo pnpm-lock.yaml
pnpm install
```

### Paso 3: Configuración de Variables de Entorno (`.env`)
Crea un archivo `.env` en la raíz del proyecto (puedes tomar de base las variables ya validadas para el entorno Staging de CiudadAR):

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://<tu-proyecto>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_<tu-clave-aqui>

# Google OAuth (Public Client ID)
VITE_GOOGLE_CLIENT_ID=<tu-google-client-id>.apps.googleusercontent.com

# Google reCAPTCHA v3
VITE_RECAPTCHA_SITE_KEY=<tu-recaptcha-site-key>
RECAPTCHA_SECRET_KEY=<tu-recaptcha-secret-key>

# Resend API Key (Servicio de correos / notificaciones)
RESEND_API_KEY=re_<tu-resend-api-key>
```

### Paso 4: Levantar el Servidor de Desarrollo
```bash
pnpm dev
```
La aplicación estará corriendo inmediatamente en: `http://localhost:5173`.

---

## 4. 🗄️ Configuración y Replicación de la Base de Datos (Supabase)

> [!WARNING]
> **`supabase/schema.sql`, `supabase/seed.sql` y `supabase/rag_normativas.sql` son HISTÓRICOS** (spike de REP-2907, Sprint 10). El sistema real en CiudadAR usa el corpus jurídico de producción (REP-2908) y la tabla `normativas`/RPC `match_normativas` que crean ya no está en el camino activo — el RAG real usa `knowledge_fragments`/`match_knowledge_fragments`. No los ejecutes contra un proyecto nuevo salvo que quieras reproducir el spike viejo a propósito.

Para levantar un entorno nuevo equivalente a CiudadAR (P-08), el orden real y verificado (REP-2908-VERIF ronda 5, R5-09) es:

1. **Migraciones versionadas**: `supabase db push` (o aplicar cada archivo de [`supabase/migrations/`](https://github.com/Mathiiuk/reportalo.mvp/blob/staging/supabase/migrations) en orden de versión). Trae el schema base, RLS, las funciones del RAG (`match_knowledge_fragments`, `persist_rag_analysis`, `dispatch_rag_analysis_queue`, `enqueue_rag_analysis`) y las políticas de privacidad de `citizen_reports`/`report_images`/Storage.
   * Verificá que no haya desfasaje entre lo local y lo remoto con `supabase migration list` **antes** de pushear — si una fila remota no tiene archivo local, hay que crearlo con la misma versión/nombre (`supabase_migrations.schema_migrations.statements`), nunca reejecutar SQL ya aplicado.
2. **Catálogo y corpus normativo**: PARTES 2 a 8 de `docs/REP-3769_seed_y_RAG.sql` (servicios, agencias, localidades, `knowledge_sources`/`knowledge_fragments`/`fragment_services`).
3. **Embeddings del corpus**: script de generación de embeddings (no se versiona el vector literal en migraciones — ver la nota en `supabase/migrations/20260914152746_backfill_fragment_embeddings_batch_1.sql`). Usa `gemini-embedding-2` con `outputDimensionality: 768`, el mismo modelo que `EMBEDDING_MODEL_CODE` en `supabase/functions/analizar-reporte/index.ts`.
4. **Secrets** (nunca se versionan sus valores, solo se documentan los nombres):
   * Vault (SQL Editor → `vault.create_secret(valor, nombre)`): `rag_analizar_reporte_url`, `rag_service_role_key`, `rag_dispatch_token`.
   * Edge Functions (Project Settings → Edge Functions → Secrets): `GEMINI_API_KEY`, `RAG_DISPATCH_TOKEN` (mismo valor que `rag_dispatch_token` de Vault), `SUPABASE_SERVICE_ROLE_KEY` (la inyecta Supabase automáticamente).
5. **Despliegue de las Edge Functions**: `quarantine-anonymize` y `analizar-reporte` (`supabase functions deploy <nombre>` o el equivalente del panel).
6. **Usuarios y datos demo** (opcional, solo para entornos de prueba): `scripts/rag-local-dev/create-demo-auth-users.mjs` (usuarios de Auth) + las migraciones `v04_seed_demo_profiles_and_reports` y `p02_status_reason`.

### Configuración de Almacenamiento (Supabase Storage)
Verifica que en **Storage** existan los siguientes dos buckets:
* **`evidence-quarantine`**: Público: **NO** (Privado). Usado exclusivamente para fotos en tránsito antes de anonimizar. Política real: solo `INSERT` para `authenticated` (el ciudadano sube con sesión, sin `upsert`); la lectura/movimiento/borrado los hace `quarantine-anonymize` con `SUPABASE_SERVICE_ROLE_KEY`, nunca el cliente.
* **`report-evidences`**: Público: **SÍ** para lectura. Guarda las imágenes anonimizadas finales — la escritura (`INSERT`/`UPDATE`/`DELETE`) es exclusiva del servidor (misma Edge Function), no tiene política pública.

---

## 5. 🗺️ Mapa del Código: ¿Dónde está cada funcionalidad?

| Módulo / Funcionalidad | Ubicación en el Código | Responsabilidad |
| :--- | :--- | :--- |
| **Borradores & Modo Offline** | [`src/services/offlineStorageService.js`](https://github.com/Mathiiuk/reportalo.mvp/blob/staging/src/services/offlineStorageService.js) | Maneja IndexedDB (`reportalo_offline_db`), guarda Blobs sin Base64 y gestiona estado `PENDING_SYNC`. |
| **Sanitización EXIF (GPS)** | [`src/services/metadataSanitizer.js`](https://github.com/Mathiiuk/reportalo.mvp/blob/staging/src/services/metadataSanitizer.js) | Parser binario de cabeceras JPEG. Remueve tags `APP1` (`0xFFE1`) donde viajan las coordenadas. |
| **Cuarentena & Privacidad** | [`src/services/quarantinePipelineService.js`](https://github.com/Mathiiuk/reportalo.mvp/blob/staging/src/services/quarantinePipelineService.js) | Orquestador cliente de cuarentena y purgado Fail-Safe. |
| **Edge Function de Anonimización** | [`supabase/functions/quarantine-anonymize/index.ts`](https://github.com/Mathiiuk/reportalo.mvp/blob/staging/supabase/functions/quarantine-anonymize/index.ts) | Backend Deno server-side: detecta caras/patentes con Vision API y difumina la imagen. |
| **RAG Jurídico & pgvector** | [`src/services/legalRagService.js`](https://github.com/Mathiiuk/reportalo.mvp/blob/staging/src/services/legalRagService.js) | Vectorización léxica (64d spike / 768d Gemini), similitud coseno, cascada jurisdiccional y descarte de distractores. |
| **Permisos & Notificaciones PWA** | [`src/services/notificationService.js`](https://github.com/Mathiiuk/reportalo.mvp/blob/staging/src/services/notificationService.js) | Gestión de permisos de notificación de navegador, fallback a ajustes del SO y disparos locales. |
| **Términos y Condiciones** | [`src/services/termsService.js`](https://github.com/Mathiiuk/reportalo.mvp/blob/staging/src/services/termsService.js) | Control de aceptación de términos v1.0 en `localStorage` y en `terms_consents` de Supabase. |
| **Flujo de Creación de Reportes** | [`src/pages/NewReportPage.jsx`](https://github.com/Mathiiuk/reportalo.mvp/blob/staging/src/pages/NewReportPage.jsx) | Asistente de 3 pasos: 1) Fotos/Cámara, 2) Categoría/Detalle, 3) Ubicación/Envío. |

---

## 6. 🧪 Quality Gates: Cómo Verificar que Todo Funcione

Antes de hacer cambios o enviar código a producción, ejecuta los siguientes comandos de validación:

```bash
# 1. Correr la suite completa de pruebas unitarias e integración (25 archivos / 144 tests):
npx vitest run

# 2. Correr pruebas en modo interactivo (watch):
npx vitest

# 3. Validar compilación de producción con Vite:
pnpm run build
```
> **Criterio de Aprobación:** La suite de tests debe estar **100% en verde (144 pasados, 0 fallos)** y el build de Vite debe completarse en menos de 10 segundos.

---

## 7. 🌿 Flujo Git y Reglas de Desarrollo Autónomo

Para mantener la integridad del proyecto y no romper funcionalidades probadas:

1. **Gestión Estricta de Ramas:**
   * Nunca trabajes directamente sobre `main` ni `staging`.
   * Crea siempre una rama temática:
     * Para nuevas funcionalidades: `git checkout -b feat/REP-XXXX_nombre_tarea`
     * Para corrección de bugs: `git checkout -b fix/REP-XXXX_nombre_tarea`
2. **Formato de Commits (Conventional Commits):**
   * `feat(...)`: Nueva característica.
   * `fix(...)`: Corrección de un fallo.
   * `docs(...)`: Cambios en documentación o runbooks.
   * `test(...)`: Incorporación o mejora de pruebas.
3. **Control de Calidad Pre-Commit:**
   * Ejecuta siempre `npx vitest run` antes de commitear.
4. **Push y Pull Request:**
   * Realiza el push a GitHub: `git push -u origin feat/REP-XXXX_nombre_tarea`
   * Abre un Pull Request apuntando a `staging` o `main` referenciando el ticket Jira.

---

## 8. 🚨 Matriz de Troubleshooting: Solución de Problemas Frecuentes

### Problema A: Fallo de conexión o RLS en Supabase
* **Síntoma:** Consultas a `normativas`, `profiles` o `citizen_reports` devuelven array vacío o error `403/401`.
* **Causa:** Las políticas de Row Level Security (RLS) impiden la lectura pública o anónima.
* **Solución:** Revisa que las políticas en [`supabase/rag_normativas.sql`](https://github.com/Mathiiuk/reportalo.mvp/blob/staging/supabase/rag_normativas.sql#L27-L38) estén aplicadas. En desarrollo local, el cliente conmuta automáticamente a emuladores en memoria para no bloquearte.

### Problema B: Los borradores no persisten tras recargar F5
* **Síntoma:** Al recargar la pantalla se pierde la foto cargada.
* **Causa:** Se guardó una URL efímera (`blob:http...`) en vez del objeto binario `File` o `Blob`.
* **Solución:** Comprueba en [`src/services/offlineStorageService.js`](https://github.com/Mathiiuk/reportalo.mvp/blob/staging/src/services/offlineStorageService.js#L114) que el campo `blob` contenga el objeto real.

### Problema C: La Edge Function no difumina o da error
* **Síntoma:** `quarantine-anonymize` arroja `Fallo al procesar imagen`.
* **Causa:** La función no tiene configurada `SUPABASE_SERVICE_ROLE_KEY` en los secrets del proyecto.
* **Solución:** En el panel de Supabase -> Project Settings -> Edge Functions -> Secrets, añade `SUPABASE_SERVICE_ROLE_KEY` con la clave `service_role` de API Keys. Recuerda que el frontend cuenta con fallback local seguro.

### Problema D: El RAG normativo descarta todas las leyes
* **Síntoma:** La búsqueda semántica devuelve 0 normativas (`hasGrounding: false`).
* **Causa:** El umbral de similitud es demasiado exigente o la jurisdicción no coincide.
* **Solución:** El umbral calibrado es **`0.45`**. Asegúrate de enviar la jurisdicción correcta (`Avellaneda` o `CABA`) para que la cascada jurisdiccional filtre las leyes elegibles.

---

## 9. 📞 Accesos y Herramientas del Proyecto

* **Tablero Jira:** [unlz2026.atlassian.net/jira/software/projects/REP](https://unlz2026.atlassian.net/jira/software/projects/REP)
* **Confluence:** [unlz2026.atlassian.net/wiki](https://unlz2026.atlassian.net/wiki)
* **Repositorio GitHub:** [github.com/Mathiiuk/reportalo.mvp](https://github.com/Mathiiuk/reportalo.mvp)
* **Supabase Cloud Dashboard:** [supabase.com/dashboard/project/yryuhyiujyignkdhiyua](https://supabase.com/dashboard/project/yryuhyiujyignkdhiyua)
* **Runbook Técnico Sprint 11:** [`docs/REP-3765-runbook-handoff-sprint11.md`](https://github.com/Mathiiuk/reportalo.mvp/blob/staging/docs/REP-3765-runbook-handoff-sprint11.md)
* **Informe Handoff RAG REP-2907:** [`docs/REP-2907-informe-tecnico-rag-handoff.md`](https://github.com/Mathiiuk/reportalo.mvp/blob/staging/docs/REP-2907-informe-tecnico-rag-handoff.md)

---
*Documento mantenido para garantizar la continuidad operativa y la soberanía técnica del equipo de desarrollo de Reportalo™.*
