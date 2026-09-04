# 🗄️ Supabase Database & Dataset Seed — Reportalo™ (MVP)

Este directorio contiene los scripts SQL DDL y de datos semilla para inicializar, regenerar y mantener la base de datos de **Reportalo™** en **Supabase** para entornos locales, de staging y producción.

---

## 📁 Estructura de Archivos

| Archivo | Propósito |
|---|---|
| `schema.sql` | Definición DDL de tablas (`profiles`, `report_categories`, `organismos`, `terms_consents`, `reports`, `report_evidences`), restricciones relacionales, índices y políticas de seguridad Row Level Security (RLS). |
| `seed.sql` | Dataset inicial mínimo, reproducible e idempotente para Sprint 10 (categorías oficiales v2, organismos CABA/Avellaneda, usuarios de prueba y 8 reportes georreferenciados). |
| `reset.sql` | Script de truncado seguro (`CASCADE`) para reiniciar el ambiente de pruebas antes de reaplicar el seed. |

---

## 🚀 Guía de Ejecución

### Opción 1: Desde Supabase Dashboard (SQL Editor)

1. Ingresar al panel de control de Supabase: [https://supabase.com/dashboard](https://supabase.com/dashboard).
2. Seleccionar el proyecto correspondiente a **Reportalo MVP** (o staging).
3. Ir a la pestaña **SQL Editor** en la barra lateral izquierda.
4. Crear una nueva consulta (**+ New query**), copiar el contenido de `schema.sql` y presionar **Run**.
5. Crear otra consulta, copiar el contenido de `seed.sql` y presionar **Run**.

### Opción 2: Mediante Supabase CLI (Desarrollo Local / CI)

```bash
# Iniciar Supabase local
supabase start

# Aplicar migraciones y seed
supabase db reset
```

---

## 🔒 Políticas de Seguridad (RLS)

- **Lectura Pública Consultiva:** Las tablas `report_categories`, `organismos`, `reports` y `report_evidences` permiten consultas `SELECT` públicas para alimentar la experiencia del mapa (`/mapa`) y el onboarding sin fricción.
- **Creación Autenticada:** La inserción de reportes y evidencias fotográficas está permitida para usuarios autenticados.
- **Consentimientos y Perfiles:** La tabla `terms_consents` audita la versión aceptada (`v1.3`), permisos de dispositivo (`cámara` y `geolocalización`) y metadatos de navegador para cada usuario.
