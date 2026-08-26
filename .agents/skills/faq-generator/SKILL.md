---
name: faq-generator
description: Generate structured FAQ sections and valid JSON-LD FAQPage schemas for SEO rich snippets on Google.
metadata:
  version: 1.0.0
---

# FAQ & Schema.org Generator Skill

Generación de secciones de Preguntas Frecuentes parseadas en formato estructurado `FAQPage` (JSON-LD) para destacar con Rich Snippets en los resultados de Google.

## Estructura JSON-LD:
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "¿Pregunta frecuente?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Respuesta clara y optimizada."
      }
    }
  ]
}
</script>
```
