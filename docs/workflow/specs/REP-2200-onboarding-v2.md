# 📱 Especificación Funcional — REP-2200: Reportalo V2 Onboarding y Autenticación

---

## 1. Alcance y Contexto del Producto V2

**Reportalo V2** reestructura el flujo de entrada con una Landing Page unificada que integra Login y Registro en un acordeón desplegable interactivo, autenticación gestionada por **Supabase Auth**, notificaciones modernas con **Sonner**, solicitud secuencial de permisos con privacidad protagónica y acceso a la vista del mapa con **MapLibre GL JS**.

---

## 2. Paleta de Colores y Tokens V2

| Token | Código HEX | Rol en la Interfaz |
| :--- | :--- | :--- |
| **Primary** | `#249EE1` | Color principal de marca, enlaces activos, foco de inputs y botones secundarios. |
| **Primary Dark** | `#266AA6` | Estados hover y encabezados con alto contraste. |
| **Accent** | `#F88F37` | Botones de llamada a la acción (CTAs) de alta conversión e indicadores clave. |
| **Background** | `#F8F9FA` / `#FFFFFF` | Fondos limpios y superficies con contraste suave. |
| **Text Primary** | `#1A1A1A` | Títulos y textos principales de alta legibilidad. |
| **Text Secondary**| `#6B7280` | Subtítulos, descripciones y microcopys. |
| **Success** | `#10B981` | Permisos concedidos y notificaciones exitosas. |
| **Warning** | `#F59E0B` | Advertencias de permisos o accesos restringidos. |
| **Error** | `#EF4444` | Errores de validación y fallos de autenticación. |

---

## 3. Especificación Pantalla por Pantalla

### 1. `HomePage.jsx` (Ruta `/`)
* **Hero**:
  - Logo oficial de Reportalo.
  - Lema: *"Tu ciudad. Tu voz."*
  - Subtítulo: *"Reportá problemas en tu ciudad, con evidencia verificada y tu identidad protegida."*
* **3 Beneficios Clave**:
  1. 🛡️ **Tu identidad protegida**: Tus datos personales no se comparten innecesariamente con el organismo receptor.
  2. 🧠 **La IA encuentra a quién corresponde**: Analizamos tu reporte para derivarlo al área municipal correspondiente.
  3. 📍 **Seguimiento en tiempo real**: Monitoreá el estado de avance hasta su resolución efectiva.
* **CTAs Principales**:
  - **Iniciar sesión** (Abre colapso de Login).
  - **Registrarse** (Abre colapso de Registro con color de acento `#F88F37`).
* **`AuthCollapse.jsx`**:
  - Acordeón animado con `framer-motion` que expande suavemente el formulario activo y oculta el otro sin recargar la página.
* **`LoginForm.jsx`**:
  - Inputs: Email y Contraseña.
  - Enlace *¿Olvidaste tu contraseña?*
  - Botón *Ingresar* y botón *Iniciar con Google* con icono oficial.
* **`RegisterForm.jsx`**:
  - Inputs: Nombre completo, Email, Contraseña, Confirmar contraseña.
  - Checkbox obligatorio: *Acepto los términos y condiciones* (con enlace para abrir modal).
  - Botón *Registrarse* (deshabilitado hasta tildar checkbox) y botón *Registrarse con Google*.
* **`Modal.jsx`**:
  - Diálogo accesible con el texto de Términos y Condiciones y botón para cerrar y aceptar.

---

### 2. `PermisosPage.jsx` (Ruta `/permisos` — Protegida)
* **Encabezado**: *"Activá los permisos"* &bull; Subtítulo explicativo.
* **Tarjetas de Permisos (`PermisoCard.jsx`)**:
  - **📷 Cámara**: *"Capturá la evidencia directamente desde Reportalo."* $\rightarrow$ Badge de estado y botón de activación.
  - **📍 Ubicación**: *"Usamos tu ubicación para georreferenciar el reporte en el mapa."* $\rightarrow$ Badge de estado y botón de activación.
* **Bloque Protagonista de Privacidad (`PrivacyBlock.jsx`)**:
  - 🔒 **Tu evidencia permanece protegida**: *Los rostros y las patentes se difuminan automáticamente antes de enviar la evidencia.*
* **Botón Principal**: **Continuar al mapa** (actualiza onboarding a `'completed'` y redirige a `/map`).
* **Acción Secundaria**: **Ahora no** (permite avanzar sin bloquear al ciudadano).

---

### 3. `MapaPage.jsx` (Ruta `/map` — Protegida)
* **Contenedor MapLibre GL JS**: Renderiza el mapa a pantalla completa utilizando el estilo gratuito `https://demotiles.maplibre.org/style.json`.
* **Barra Superior**: Logo de Reportalo, saludo al usuario autenticado y botón de **Cerrar sesión** (`signOut`).

---

## 4. Persistencia y Matriz de Enrutamiento (`reportalo_onboarding`)

| Estado de Sesión | Valor de `reportalo_onboarding` | Redirección Automática |
| :--- | :--- | :--- |
| **No Autenticado** | `'new'` | `/` (Home) |
| **Autenticado** | `'registered'` | `/permisos` |
| **Autenticado** | `'completed'` | `/map` |
