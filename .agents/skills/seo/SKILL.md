---
name: seo
description: Master SEO Team Playbook & Strategy for uTurno and future SaaS applications. Covers Programmatic SEO (pSEO), Competitor Comparison & Alternatives, Technical SEO Auditing (251 rules via SEOmator), FAQ Schema Generation, and Organic Search Traffic Scaling. Use when the user asks for SEO audit, pSEO landing generation, competitor comparison pages, keyword scaling, or organic growth strategies.
metadata:
  version: 3.0.0
---

# 🚀 Master SEO Team Playbook & Strategy

Este documento actúa como el **manual central de estrategia SEO** para uTurno y futuros proyectos SaaS B2B. Integra las mejores metodologías de **Programmatic SEO (pSEO)**, **Páginas de Competencia & Alternativas**, **Auditoría Técnica Automática con SEOmator**, **Generador de FAQs con Schema.org** y **Estrategia de Dominio de Nichos**.

---

## 🛠️ Pilares del Equipo SEO

```
           ┌─────────────────────────────────────────┐
           │        ESTRATEGIA SEO INTEGRAL          │
           └────────────────────┬────────────────────┘
                                │
   ┌──────────────────┬─────────┴─────────┬──────────────────┐
   ▼                  ▼                   ▼                  ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ Programmatic │   │  Competitor  │   │  Technical   │   │ FAQ & Schema │
│     SEO      │   │ Alternatives │   │   Auditing   │   │  Generator   │
│  (11+ Nichos)│   │  (vs Pages)  │   │ (SEOmator 3) │   │ (JSON-LD)    │
└──────────────┘   └──────────────┘   └──────────────┘   └──────────────┘
```

---

## 1. 🌐 Programmatic SEO (pSEO)

### Principios Fundamentales:
- **Valor Único por Página**: Evitar plantillas vacías. Cada página debe ofrecer contexto, características y casos de uso específicos del rubro (Barberías, Canchas, Salud, Veterinarias, etc.).
- **Jerarquía de URLs Limpias**: Usar subcarpetas (`uturno.com/software-para-barberias`, `/canchas`, `/veterinaria`), nunca subdominios para consolidar autoridad de dominio.
- **Evitar Puertas Traseras (Doorway Pages)**: No crear páginas duplicadas cambiando solo una palabra. Incluir preguntas frecuentes, calculadoras de retorno de inversión (ROI) y testimonios reales.

### Patrones de Búsqueda de Nicho Implementados:
- `[Software / Sistema] para [Rubro]` (ej: `/software-para-barberias`, `/software-para-estetica`, `/software-para-salud`)
- `[Rubro / Servicio]` (ej: `/canchas`, `/veterinaria`, `/taller-mecanico`, `/consultoria`, `/academias`, `/inmobiliaria`, `/eventos`, `/gaming`)

---

## 2. ⚔️ Páginas de Competencia & Alternativas (Competitor vs Pages)

### Formatos Principales:
1. **Alternativa Singular**: `uturno.com/alternativas/[Competidor]` (ej: *Alternativa a Calendly*, *Alternativa a Fresha*, *Alternativa a SimplyBook*).
   - Estructura:
     - 1. Por qué los negocios buscan una alternativa a [Competidor] (Puntos de dolor: comisiones altas, sin cobro de señas por Mercado Pago en ARS).
     - 2. Por qué uTurno es la mejor opción.
     - 3. Tabla comparativa de funciones (Precios en ARS, soporte por WhatsApp, integraciones).
     - 4. Migración transparente en 5 minutos.
     - 5. CTA a Prueba Gratis.

2. **Alternativas Múltiples (Plural)**: `uturno.com/alternativas/mejores-sistemas-de-turnos-argentina`
   - Criterios de evaluación imparciales.
   - Posicionar a uTurno en #1 destacando automatización por WhatsApp y Mercado Pago.

---

## 3. 🔍 Auditoría Técnica Automática (SEOmator 3.0 CLI)

Analiza **251 reglas** distribuidas en **20 categorías**:
- **Core SEO**: URLs canónicas, indexing, meta titles únicos.
- **Performance**: Core Web Vitals (LCP, CLS, INP, TTFB).
- **Structured Data**: Schema.org JSON-LD (SoftwareApplication, Organization, FAQPage, BreadcrumbList).
- **JavaScript Rendering**: SSR vs Client-side hydration.
- **AI/GEO Readiness**: Robots.txt, sitemap.xml, llms.txt.

### Comando para Ejecutar Auditoría:
```bash
npx @seomator/seo-audit audit https://www.uturno.com --format llm
```

---

## 4. ❓ Generador de FAQs con Schema.org (FAQ Generator)

Cada página pública debe contar con una sección de **Preguntas Frecuentes** parseada en formato `FAQPage` de Schema.org en el `<head>`:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [{
    "@type": "Question",
    "name": "¿Cómo funcionan las señas con Mercado Pago?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Al reservar un turno, el cliente abona la seña configurada a través de Mercado Pago antes de confirmar el horario."
    }
  }]
}
</script>
```

---

## 🚀 Plan de Acción SEO para uTurno

1. **Mantener `sitemap.xml` y `robots.txt` actualizados** con todas las rutas de nicho y de alternativas.
2. **Generar landings de comparación de competidores** (`/alternativa-calendly`, `/alternativa-fresha`).
3. **Optimizar tiempo de carga (Core Web Vitals)**: Preconnect a fuentes de Google e imágenes en formato moderno `.png` / `.webp`.
4. **Seguimiento con Google Ads / Analytics**: Etiqueta `AW-18386242156` activa midiendo conversiones de reserva y registro.
