/** @type {import('tailwindcss').Config} */

// Token de color definido en src/styles/tokens.css (canales RGB) → admite opacidad (`bg-rep-accent/20`).
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  // UJ v3.3 §10 «Comportamiento del tema»: el tema oscuro se activa solo con la clase `dark`
  // en <html>. No se usa 'media' (default de Tailwind 3) porque la app no hereda la
  // preferencia del sistema operativo: arranca siempre en claro.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Paleta histórica del MVP (se conserva para no romper pantallas que todavía la usan).
        brand: {
          blue: '#1E6FCB',
          'blue-light': '#2A7BD6',
          'blue-dark': '#15539E',
          'blue-soft': '#9FD0FF',
          'blue-bg': '#EEF5FC',
          'blue-border': '#D4E6F8',
          gray: '#5B6A7A',
          'gray-dark': '#243447',
          'gray-text': '#46566B',
          'gray-muted': '#8593A2',
          'gray-light': '#DDE4EC',
          'gray-border': '#EEF1F5',
        },
        // Tokens semánticos del UJ v3.3 (REP-3791 · Bloque 0). Cambian solos con el tema.
        rep: {
          bg: token('rep-bg'),
          surface: token('rep-surface'),
          'surface-sunken': token('rep-surface-sunken'),
          border: token('rep-border'),
          divider: token('rep-divider'),
          track: token('rep-track'),
          ink: token('rep-ink'),
          'ink-body': token('rep-ink-body'),
          'ink-label': token('rep-ink-label'),
          'ink-muted': token('rep-ink-muted'),
          'ink-faint': token('rep-ink-faint'),
          accent: token('rep-accent'),
          'accent-strong': token('rep-accent-strong'),
          'accent-soft': token('rep-accent-soft'),
          'accent-border': token('rep-accent-border'),
          'on-accent': token('rep-on-accent'),
          success: token('rep-success'),
          'success-soft': token('rep-success-soft'),
          warning: token('rep-warning'),
          'warning-soft': token('rep-warning-soft'),
          'warning-ink': token('rep-warning-ink'),
          danger: token('rep-danger'),
          'danger-soft': token('rep-danger-soft'),
          notice: token('rep-notice'),
          'notice-soft': token('rep-notice-soft'),
          camera: token('rep-camera'),
          'camera-accent': token('rep-camera-accent'),
          'camera-ink-muted': token('rep-camera-ink-muted'),
        },
        // Categorías del MVP: base (ícono/borde), soft (fondo) e ink (texto sobre soft).
        cat: {
          infra: token('rep-cat-infra'),
          'infra-soft': token('rep-cat-infra-soft'),
          'infra-ink': token('rep-cat-infra-ink'),
          transito: token('rep-cat-transito'),
          'transito-soft': token('rep-cat-transito-soft'),
          'transito-ink': token('rep-cat-transito-ink'),
          ambiente: token('rep-cat-ambiente'),
          'ambiente-soft': token('rep-cat-ambiente-soft'),
          'ambiente-ink': token('rep-cat-ambiente-ink'),
          comercio: token('rep-cat-comercio'),
          'comercio-soft': token('rep-cat-comercio-soft'),
          'comercio-ink': token('rep-cat-comercio-ink'),
        },
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', '-apple-system', 'sans-serif'],
        manrope: ['Manrope', 'sans-serif'],
      },
      // UJ v3.3 §10 «Escala tipográfica real». Sin sufijo = teléfono; sufijo -d = escritorio.
      // Los mockups están dibujados a escala reducida: no copiar los px del dibujo.
      fontSize: {
        'rep-title': ['21px', { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '800' }],
        'rep-title-d': ['30px', { lineHeight: '1.2', letterSpacing: '-0.015em', fontWeight: '800' }],
        'rep-section': ['16px', { lineHeight: '1.3', fontWeight: '800' }],
        'rep-section-d': ['20px', { lineHeight: '1.3', fontWeight: '800' }],
        'rep-body': ['13px', { lineHeight: '1.5', fontWeight: '500' }],
        'rep-body-d': ['15px', { lineHeight: '1.55', fontWeight: '500' }],
        'rep-label': ['12px', { lineHeight: '1.4', fontWeight: '600' }],
        'rep-label-d': ['13px', { lineHeight: '1.4', fontWeight: '600' }],
        'rep-pill': ['12px', { lineHeight: '1.2', fontWeight: '700' }],
        // Decisiones de implementación (no figuran en la tabla del §10):
        'rep-button': ['16px', { lineHeight: '1.25', fontWeight: '800' }],
        // 16 px en campos de texto: evita el zoom automático de Safari iOS al enfocar.
        'rep-input': ['16px', { lineHeight: '1.5', fontWeight: '500' }],
      },
      // UJ v3.3 §10 «Mínimos de accesibilidad»: área táctil real de 44 × 44 px.
      minHeight: { touch: '44px' },
      minWidth: { touch: '44px' },
      // UJ v3.3 §10 «Estados de interacción»: disabled = opacidad 45%.
      opacity: { 45: '0.45' },
      transitionDuration: { 120: '120ms' },
      boxShadow: {
        'btn-white': '0px 8px 18px rgba(0, 0, 0, 0.14)',
        'btn-blue': '0px 8px 18px rgba(30, 111, 203, 0.3)',
        'input-focus': '0px 0px 0px 3px rgba(30, 111, 203, 0.12)',
        'rep-accent': '0 8px 18px rgb(var(--rep-accent) / 0.30)',
        'rep-float': '0 5px 16px rgb(var(--rep-shadow) / 0.14)',
        'rep-card': '0 1px 2px rgb(var(--rep-shadow) / 0.05)',
      },
    },
  },
  plugins: [],
};
