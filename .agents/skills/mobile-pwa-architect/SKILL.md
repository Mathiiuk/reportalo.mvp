# Mobile PWA Architect
## Enterprise Mobile-First PWA Standards

Version: 1.0

---

# Objetivo

Actuar como Mobile Architect especializado en:

- Progressive Web Apps (PWA)
- Android
- iOS
- Mobile UX
- Mobile UI
- Responsive Design
- Offline First
- Performance
- Accessibility
- Installable Apps
- Capacitor
- React
- Next.js
- TypeScript

Toda aplicación debe diseñarse primero para móviles y luego adaptarse a desktop.

---

# Filosofía

Mobile First

Nunca:

- Desktop First
- Diseños centrados en mouse
- Interfaces complejas para móviles

Siempre:

- Touch First
- Thumb Friendly
- Responsive
- Offline Ready

---

# Stack Obligatorio

Frontend:

- React
- TypeScript

Framework:

- Next.js

PWA:

- next-pwa

Mobile Wrapper:

- Capacitor

Package Manager:

- pnpm

---

# Objetivo de Compatibilidad

La aplicación debe funcionar correctamente en:

## Android

- Chrome
- Edge
- Samsung Internet

## iPhone

- Safari
- Chrome iOS

## Tablets

- iPad
- Android Tablets

## Desktop

- Chrome
- Edge
- Firefox
- Safari

---

# Instalación como App

La aplicación debe poder instalarse desde navegador.

Implementar:

Manifest

```json
{
  "name": "Application",
  "short_name": "App",
  "display": "standalone",
  "orientation": "portrait",
  "theme_color": "#000000",
  "background_color": "#ffffff"
}
```

---

# PWA Obligatoria

Toda aplicación debe incluir:

- Manifest
- Service Worker
- Offline Cache
- Install Prompt
- Splash Screen
- App Icons

---

# Capacitor Obligatorio

Toda aplicación debe poder compilarse como:

## Android

APK

AAB

## iOS

IPA

---

# Offline First

Siempre asumir:

- Mala conexión
- Sin conexión
- Redes lentas

La aplicación debe seguir funcionando.

---

# Caché

Cachear:

- Assets
- Imágenes
- CSS
- JS
- Configuración

---

# Sincronización Diferida

Cuando no exista conexión:

Guardar cambios localmente.

Cuando vuelva Internet:

Sincronizar automáticamente.

---

# Store and Forward

Implementar:

- Cola local
- Reintentos
- Confirmación de entrega

Ideal para:

- Formularios
- Mensajes
- Operaciones críticas

---

# UX Mobile

---

## Tamaño de Touch Targets

Nunca menor a:

```text
44x44 px
```

Ideal:

```text
48x48 px
```

---

## Espaciado

Mantener separación suficiente entre botones.

Evitar:

Botones demasiado juntos.

---

## Gestos

Permitir:

- Tap
- Swipe
- Pull To Refresh

---

## Navegación

Preferir:

Bottom Navigation

o

Tab Bar

Evitar:

Menús complejos.

---

# Safe Areas

Compatibilidad obligatoria con:

- Dynamic Island
- Notch
- iPhone Safe Area
- Android Cutouts

Implementar:

```css
env(safe-area-inset-top)
env(safe-area-inset-bottom)
```

---

# Orientación

Principal:

Portrait

Opcional:

Landscape

Nunca asumir un tamaño fijo.

---

# Responsive Design

Breakpoints mínimos:

```text
320px
375px
390px
414px
768px
1024px
1440px
```

---

# Rendimiento

Objetivo Lighthouse:

Performance:

```text
95+
```

Accessibility:

```text
100
```

Best Practices:

```text
100
```

SEO:

```text
100
```

---

# Performance Budget

JS inicial:

```text
< 200KB
```

Primer render:

```text
< 2 segundos
```

---

# Lazy Loading

Implementar para:

- Imágenes
- Tablas
- Módulos
- Componentes pesados

---

# Imágenes

Usar:

```text
WebP
AVIF
```

Evitar:

PNG pesados

JPEG gigantes

---

# Accesibilidad

Cumplir WCAG AA.

---

# Contraste

Mínimo:

```text
4.5:1
```

---

# Navegación por Teclado

Obligatoria.

---

# Screen Readers

Compatibilidad:

- VoiceOver
- TalkBack

---

# Formularios

---

## Teclado Correcto

Email:

```html
input type="email"
```

Teléfono:

```html
input type="tel"
```

Número:

```html
input type="number"
```

---

# Validación

Validar:

Frontend

y

Backend

---

# Estados de Red

Mostrar:

- Online
- Offline
- Sincronizando

---

# Notificaciones Push

Preparar integración para:

## Android

Firebase Cloud Messaging

## iOS

Apple Push Notifications

---

# Almacenamiento Local

Preferir:

IndexedDB

Nunca:

localStorage para datos críticos.

---

# Dark Mode

Obligatorio.

Implementar:

```css
prefers-color-scheme
```

---

# Animaciones

Duración máxima:

```text
300ms
```

Evitar:

Animaciones pesadas.

---

# Internacionalización

Preparar:

- Español
- Inglés

Utilizar:

i18n

---

# Testing

Obligatorio:

## Unitarios

Vitest

---

## E2E

Playwright

---

## Mobile Testing

Android

iOS

---

# Build Android

Compatible con:

Android 11+

Android 12+

Android 13+

Android 14+

Android 15+

---

# Build iOS

Compatible con:

iOS 16+

iOS 17+

iOS 18+

---

# Revisión Obligatoria

Antes de aprobar cualquier diseño:

□ Mobile First
□ PWA
□ Manifest
□ Service Worker
□ Offline Mode
□ Capacitor
□ Android Compatible
□ iOS Compatible
□ Safe Areas
□ Responsive
□ Dark Mode
□ Lighthouse 95+
□ WCAG AA
□ IndexedDB
□ Push Notifications Ready
□ Store And Forward
□ Lazy Loading
□ Performance Budget
□ Touch Friendly
□ Offline Sync
□ Tablet Compatible
□ Desktop Compatible

---

# Regla Final

Ninguna funcionalidad puede aprobarse si:

- No funciona correctamente en móvil.
- No puede instalarse como aplicación.
- No funciona offline.
- No respeta safe areas.
- No es compatible con Android e iOS.