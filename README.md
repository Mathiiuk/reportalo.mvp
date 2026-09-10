# 🏙️ Reportalo™ MVP

> Sistema de Reportes e Incidencias Urbanas con Privacidad por Diseño, Capacidad Offline-First y Fundamentación Jurídica Inteligente (RAG).

[![Vite](https://img.shields.io/badge/Vite-6.4-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%2017%20%2B%20pgvector-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Tests](https://img.shields.io/badge/Vitest-144%20Passing-success)](https://vitest.dev/)

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
