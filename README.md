# 🏙️ Reportalo™ MVP

> Sistema de Reportes e Incidencias Urbanas con Privacidad por Diseño, Capacidad Offline-First y Fundamentación Jurídica Inteligente (RAG).

[![Vite](https://img.shields.io/badge/Vite-6.4-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%2017%20%2B%20pgvector-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Tests](https://img.shields.io/badge/Vitest-144%20Passing-success)](https://vitest.dev/)
[![CI](https://github.com/Mathiiuk/reportalo.mvp/actions/workflows/ci.yml/badge.svg?branch=staging)](https://github.com/Mathiiuk/reportalo.mvp/actions/workflows/ci.yml)
[![Security](https://github.com/Mathiiuk/reportalo.mvp/actions/workflows/security.yml/badge.svg?branch=staging)](https://github.com/Mathiiuk/reportalo.mvp/actions/workflows/security.yml)

---

## 🎯 Sobre el proyecto

**Reportalo** es una plataforma de auditoría ciudadana: el vecino fotografía una infracción o un daño en la vía pública y la app identifica, con IA, **qué norma se incumple y qué organismo es competente**, para enviar un reclamo con evidencia estructurada y fundamento legal.

- 🎓 **Proyecto de tesis** de la Licenciatura en Gestión de la Información (UNLZ). MVP previsto para **diciembre de 2026**, con alcance en CABA y Avellaneda.
- 👥 Equipo de 5 integrantes con roles formales (PM, líder técnico, QA, datos/RAG, offline/privacidad) y matriz RACI — ver [`wiki/04-roles-y-gobernanza.md`](wiki/04-roles-y-gobernanza.md).
- 🧑‍💻 **Líder técnico:** [Matias Krepchuk](https://www.linkedin.com/in/krepchuk-matias/) — arquitectura, componentes críticos, code review, CI/CD y despliegues.

### Funcionalidades clave

| Área | Implementación |
|---|---|
| **IA jurídica (RAG)** | Corpus de normativa oficial indexado con **pgvector**; recuperación semántica + **Gemini** para citar la norma y el organismo aplicables. |
| **Privacidad por diseño** | Pipeline de cuarentena en una Edge Function (Deno): detecta rostros y patentes con Google Vision y los pixela, elimina metadatos EXIF y purga el original; si algo falla, no se guarda nada (fail-safe). |
| **Offline-first (PWA)** | Los reportes se guardan localmente y se sincronizan al recuperar conexión. |
| **Mapa público** | Mapa de reportes con MapLibre GL y estados trazables por reporte. |
| **Calidad** | 25 suites / 144 tests en Vitest, escenarios BDD, CI y escaneo de seguridad en GitHub Actions, previews por rama en Vercel. |

**Stack:** React 18 · Vite · Tailwind · Supabase (PostgreSQL 17, Auth, Edge Functions, pgvector) · Gemini · MapLibre GL · Vitest · GitHub Actions · Vercel

> 🚧 **Estado:** en desarrollo activo. La demo pública estará disponible en el lanzamiento del MVP.

---

## 📖 Documentación Esencial para el Equipo

* 🚀 [**Guía de Replicación del Sistema y Continuidad Operativa**](docs/GUIA-REPLICACION-Y-CONTINUIDAD-DEL-SISTEMA.md): Manual paso a paso para clonar, configurar, levantar y continuar el proyecto desde cero sin dependencias (*Bus Factor 0*).
* 📘 [**Runbook Técnico de Handoff — Sprint 11 (REP-3765)**](docs/REP-3765-runbook-handoff-sprint11.md): Guía de arquitectura y validación autónoma para **Iván** (Offline y Privacidad) y **Hernán** (RAG y Corpus).
* 📑 [**Informe Técnico RAG Handoff (REP-2907)**](docs/REP-2907-informe-tecnico-rag-handoff.md): Resultados, benchmarking A-F y trazabilidad jurídica con fuentes oficiales.

---

## ⚡ Inicio Rápido (Quick Start)

### 1. Requisitos
- Node.js 18+ o 20+
- `pnpm` (`npm install -g pnpm`)

### 2. Instalación
```bash
git clone https://github.com/Mathiiuk/reportalo.mvp.git
cd reportalo.mvp
pnpm install
```

### 3. Variables de Entorno
Configurar `.env` en la raíz (ver detalle completo en la [Guía de Replicación](docs/GUIA-REPLICACION-Y-CONTINUIDAD-DEL-SISTEMA.md)).

### 4. Ejecución en Desarrollo
```bash
pnpm dev
```
La aplicación estará disponible en `http://localhost:5173`.

### 5. Suite de Pruebas
```bash
npx vitest run
```
*Salida esperada:* **25 suites pasadas, 144 tests en verde**.

---

## 🏛️ Estructura del Proyecto

```
reportalo.mvp/
├── src/
│   ├── components/     # Componentes UI reutilizables
│   ├── pages/          # Páginas y vistas principales de la PWA
│   ├── services/       # Lógica de negocio (Offline, Privacidad, RAG, Notificaciones)
│   ├── test/           # Pruebas unitarias y de integración (Vitest)
│   └── types/          # Constantes y contratos de datos
├── supabase/
│   ├── functions/      # Edge Functions (quarantine-anonymize)
│   ├── schema.sql      # DDL de la base de datos
│   ├── seed.sql        # Datos semilla iniciales
│   └── rag_normativas.sql # Infraestructura pgvector y corpus oficial
├── docs/               # Informes técnicos, runbooks y guías de continuidad
└── wiki/               # Documentación metodológica y actas del proyecto
```
