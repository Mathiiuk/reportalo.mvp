# Spec: Design System UI/UX de Reportalo

## Problem

La aplicación actual utiliza una paleta de colores inconsistente (Primary #249EE1, accent #F88F37), tipografía Inter, y iconos Lucide que no cumplen con el Design System definido en el prompt maestro. No existen CSS custom properties como design tokens, y la identidad visual no transmite los valores de confianza, seguridad y transparencia requeridos.

## Solution

Implementar el Design System UI/UX completo del prompt maestro, estableciendo:
- Tipografía Manrope con jerarquía clara
- Paleta Primary #1E6FCB con escala completa
- Neutrales fríos y ligeramente azulados
- Colores semánticos (Success, Warning, Error, Admin)
- Material Symbols Rounded como iconografía exclusiva
- CSS custom properties como tokens de diseño
- Componentes actualizados con la nueva paleta

## User Journeys

- Como ciudadano, quiero ver una interfaz moderna y confiable para que me sienta seguro al reportar incidentes.
- Como ciudadano, quiero que la navegación sea intuitiva y los colores me guíen hacia las acciones principales.
- Como administrador, quiero que la interfaz transmita institucionalidad moderna.

## Acceptance Criteria

- [ ] Manrope cargada desde Google Fonts (pesos 400-800)
- [ ] Material Symbols Rounded cargada desde Google Fonts
- [ ] Primary color #1E6FCB aplicado en CTA principales
- [ ] Background #F4F7FB aplicado en superficies generales
- [ ] CSS custom properties definidas para todos los tokens
- [ ] Tailwind config actualizado con nueva paleta
- [ ] Todos los componentes usan nuevos tokens de color
- [ ] Botones primarios: bg #1E6FCB, text white, radius 13-14px
- [ ] Inputs: height 48-52px, radius 12-14px, border #DDE4EC
- [ ] Cards: bg white, border #E6ECF3, radius 14-16px, shadow sutil
- [ ] Navegación inferior: bg white, border-top #EEF1F5
- [ ] build de producción compila sin errores

## Out of Scope

- Creación de nuevos componentes no existentes
- Cambios en la lógica de negocio
- Cambios en la estructura de rutas
- Modificación de hooks o servicios
- Animaciones complejas nuevas

## Open Questions

Ninguno - el prompt maestro es completo y detallado.
