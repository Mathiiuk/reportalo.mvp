# 📑 Informe Técnico de Validación y Pruebas: REP-3532
## Activación de Permisos, Notificaciones PWA, Perfil Ciudadano y Adaptación Desktop

- **Ticket Jira:** [REP-3532: HU | Aceptar y registrar términos y consentimiento antes de reportar](https://unlz2026.atlassian.net/browse/REP-3532)
- **Fecha de Emisión:** 9 de Septiembre de 2026
- **Responsable Técnico:** Matías Krepchuk (Tech Lead / Desarrollador)
- **Destinatarios:** Hernán Gregorini (Arquitecto de Solución / Tech Lead), Iván Juárez (QA Automation & Quality Gates)
- **Rama de Trabajo:** `feat/REP-3532-aceptar-terminos`
- **Estado de Calidad:** ✅ **APROBADO (Quality Gates Verificados: 25/25 suites, 143/143 tests)**

---

## 1. 📊 Resultado de las Pruebas (Test Execution Summary)

La suite de pruebas fue ejecutada de manera automatizada utilizando **Vitest v3.2.7** sobre entorno **jsdom** con React Testing Library y simulación de Web APIs del navegador.

### A. Métrica Global de Calidad
| Métrica | Valor Obtenido | Umbral Mínimo Requerido | Estado |
| :--- | :---: | :---: | :---: |
| **Suites de Prueba (Test Files)** | **25 pasadas de 25** | 100% | ✅ Aprobado |
| **Casos de Prueba Totales** | **143 pasados de 143** | 100% | ✅ Aprobado |
| **Casos Fallidos / Con Errores** | **0** | 0 | ✅ Aprobado |
| **Casos Omitidos / Skipped** | **0** | 0 | ✅ Aprobado |
| **Tiempo de Ejecución de Suite Completa** | **19.02 segundos** | < 60s | ✅ Aprobado |
| **Compilación de Producción (Vite v6.4.3)** | **Exitosa (8.42s, 0 errores)** | Cero errores | ✅ Aprobado |

---

### B. Desglose Detallado por Módulo Específico de la Entrega

#### 1. Módulo de Permisos Post-Onboarding (`src/test/PermissionsFlow.test.jsx`)
| ID Caso | Escenario Evaluado | Comportamiento Verificado | Resultado |
| :--- | :--- | :--- | :---: |
| **UT-PM-01** | Renderizado inicial de pantalla `/permisos` | Verifica el título accesible de nivel 1, la descripción orientativa, los 3 bloques de permisos (Cámara, Ubicación y Notificaciones) y el banner de protección de privacidad con difuminado facial. | ✅ PASS |
| **UT-PM-02** | Interacción con switches estilo iOS | Verifica el toggle interactivo de Cámara y Ubicación, comprobando la actualización de los atributos `role="switch"` y `aria-checked`. | ✅ PASS |
| **UT-PM-03** | Activación de Notificaciones PWA | Intercepta la llamada a `requestNotificationPermission()` concedida (`'granted'`), actualiza el switch y envía una notificación local de confirmación (`sendLocalNotification`). | ✅ PASS |
| **UT-PM-04** | Persistencia mediante botón *"Continuar"* | Al presionar el botón de avance, almacena en `localStorage` las flags `reportalo_permissions_configured: 'true'`, `reportalo_perm_camera`, `reportalo_perm_location` y `reportalo_perm_notifications`, redirigiendo automáticamente a `/mapa`. | ✅ PASS |
| **UT-PM-05** | Omisión contextual mediante botón *"Ahora no"* | Valida el flujo alternativo sin fricción: marca los permisos como configurados para evitar bucles de navegación y redirige de forma segura a `/mapa`. | ✅ PASS |

#### 2. Módulo de Perfil Ciudadano y Notificaciones PWA (`src/test/ProfileFlow.test.jsx`)
| ID Caso | Escenario Evaluado | Comportamiento Verificado | Resultado |
| :--- | :--- | :--- | :---: |
| **UT-PF-01** | Renderizado de identidad y métricas | Renderiza avatar con iniciales (`LF`), nombre (`Lucía F.`), correo (`lucia.f@mail.com`), badge de *Cuenta Verificada* y los 3 contadores de reportes (7 reportes, 3 resueltos, 1 sin enviar). | ✅ PASS |
| **UT-PF-02** | Opciones del menú y nuevo ícono de noticias | Verifica que el menú contenga Notificaciones, Novedades, Permisos de la app y Descargar datos. Comprueba que Novedades utiliza el ícono `newspaper`, cediendo la campana al control de notificaciones. | ✅ PASS |
| **UT-PF-03** | Switch de notificaciones sincronizado con navegador | Al estar concedido (`'granted'`), el switch inicia activo y permite apagarlo y re-encenderlo actualizando `localStorage`. | ✅ PASS |
| **UT-PF-04** | Manejo de bloqueo de notificaciones en el SO (`denied`) | Si el usuario bloqueó el permiso en el SO o navegador, el switch NO re-solicita el diálogo nativo (ignorado por el navegador); en su lugar dispara `openSystemNotificationSettings` y levanta un modal guía instructivo. | ✅ PASS |
| **UT-PF-05** | Solicitud en estado inicial (`default`) | Si el permiso no fue decidido, al activar el switch se solicita el diálogo nativo y, ante confirmación, se envía notificación local y toast. | ✅ PASS |
| **UT-PF-06** | Navegación a Novedades | El botón de Novedades redirige correctamente a la ruta `/alertas`. | ✅ PASS |
| **UT-PF-07** | Acceso a Permisos de la app | El botón de Permisos redirige a `/permisos` permitiendo al ciudadano reconfigurar sus autorizaciones en cualquier momento. | ✅ PASS |
| **UT-PF-08** | Descarga de datos personales (Ley 25.326) | Genera un blob JSON estructurado con los datos del usuario, historial y consentimientos, disparando la descarga en el cliente y mostrando toast informativo. | ✅ PASS |
| **UT-PF-09** | Tarjeta de Términos Aceptados | Muestra el estado con check verde `task_alt`, la versión `v1.3`, la fecha y el botón de consulta que navega a `/terminos` en modo lectura. | ✅ PASS |

#### 3. Módulos Complementarios de Términos y Mapa
- **`src/test/TermsFlow.test.jsx` (2 tests):**
  - **UT-TM-01:** Renderizado de los 5 artículos normativos de privacidad y términos.
  - **UT-TM-02:** Advertencia de que la lectura no implica consentimiento diferido.
- **`src/test/MapFlow.test.jsx` (11 tests):**
  - Validación de integración entre el mapa ciudadano, la barra de navegación superior/inferior, y el acceso directo a `/perfil`.

---

### C. Evidencia Textual de Salida del Test Runner
```text
 RUN  v3.2.7 D:/Proyectos/reportalo.mvp

 ✓ src/test/ProfileFlow.test.jsx (9 tests) 696ms
 ✓ src/test/PermissionsFlow.test.jsx (5 tests) 377ms
 ✓ src/test/TermsFlow.test.jsx (2 tests) 209ms
 ✓ src/test/MapFlow.test.jsx (11 tests) 834ms
 ✓ src/test/LocationFlow.test.jsx (6 tests) 527ms
 ✓ src/test/ReportReviewStep.test.jsx (4 tests) 449ms
 ✓ src/test/NewReportFlow.test.jsx (3 tests) 787ms
 ✓ src/test/EvidencePreviewScreen.test.jsx (5 tests) 349ms
 ✓ src/test/ReportDetailsStep.test.jsx (4 tests) 273ms
 ✓ src/test/AdjustLocationModal.test.jsx (4 tests) 261ms
 ✓ src/test/EvidenceGallery.test.jsx (2 tests) 252ms
 ✓ src/test/ReportReviewGallery.test.jsx (1 test) 245ms
 ✓ src/test/LegalRagService.test.js (11 tests) 64ms
 ✓ src/test/OfflineStorageService.test.js (7 tests) 57ms
 ✓ src/test/LocationService.test.jsx (8 tests) 32ms
 ✓ src/test/QuarantinePipelineService.test.js (15 tests) 24ms
 ✓ src/test/SupabaseSeedValidation.test.js (5 tests) 17ms
 ✓ src/test/MetadataProtection.test.jsx (5 tests) 14ms
 ... (+ 7 suites adicionales)

 Test Files  25 passed (25)
      Tests  143 passed (143)
   Duration  19.02s
```

---

## 2. 🔗 Fuentes y Referencias del Proyecto (Citations & Artifacts)

### A. Archivos de Código Fuente en el Repositorio
1. **`src/pages/PermissionsPage.jsx`**:
   - Implementación de la pantalla de activación de permisos post-onboarding.
   - Integración de switches para cámara, geolocalización y notificaciones.
   - Diseño responsivo adaptado con header desktop y tarjeta modal amplia (`max-w-[560px]`).
2. **`src/pages/ProfilePage.jsx`**:
   - Rediseño de la pantalla de perfil ciudadano.
   - Layout desktop en grid de 12 columnas (`md:grid-cols-12`).
   - Toggle propio de notificaciones PWA, manejo de estado bloqueado en SO, adopción del ícono `newspaper` para novedades, descarga de datos y tarjeta de términos aceptados.
3. **`src/services/notificationService.js`**:
   - Capa de servicio para Web Notifications API y PWA push.
   - Métodos: `isNotificationSupported()`, `getNotificationPermission()`, `requestNotificationPermission()`, `sendLocalNotification()`, `openSystemNotificationSettings()`.
4. **`public/sw.js`**:
   - Service Worker de la PWA con handlers para eventos `push` y `notificationclick` para redirigir a los reportes.
5. **`src/components/layout/AppLayout.jsx`**:
   - Homologación de navegación: la campana de alertas redirige a notificaciones y el ícono de novedades pasa a `newspaper`.

### B. Archivos de Prueba en el Repositorio
- `src/test/PermissionsFlow.test.jsx` (5 casos)
- `src/test/ProfileFlow.test.jsx` (9 casos)
- `src/test/TermsFlow.test.jsx` (2 casos)
- `src/test/MapFlow.test.jsx` (11 casos)

### C. Archivos de Documentación y Trazabilidad en el Repositorio
- **`.agents/workflow/tests/REP-3532.md`**: Matriz formal de casos de prueba de REP-3532.
- **`.agents/workflow/executions/REP-3532-run-002.md`**: Reporte formal de ejecución de tests.
- **`wiki/03-guia-qa-testing.md`**: Guía oficial de QA & Testing del proyecto.
- **`wiki/01-acta-de-inicio.md`**: Acta fundacional con los umbrales de privacidad, fricción y sincronización.

### D. Referencias Visuales y Requerimientos de Diseño
- **Maqueta Móvil de Permisos**: Tarjeta compacta con escudo azul `verified_user`, switches iOS y banner verde de privacidad.
- **Maqueta Móvil de Perfil**: Header con avatar de iniciales, bloque de 3 métricas, 4 opciones de menú y tarjeta de términos.
- **Incidencias de Layout Desktop Detectadas**:
  - `media_1788887481991.png`: Perfil en pantalla ancha con columna diminuta de 340px centrada y espacios vacíos masivos.
  - `media_1788887481995.png`: Pantalla de permisos flotando sin header institucional en formato teléfono móvil en desktop.

---

## 3. 🛠️ Cómo lo Hiciste (Implementación y Arquitectura)

### A. Flujo de Activación de Permisos (`/permisos`)
1. **Presentación Obligatoria por Única Vez**:
   - Si el usuario culmina u omite el Onboarding y no ha definido permisos (`reportalo_permissions_configured !== 'true'`), es dirigido inmediatamente a `/permisos`.
2. **Manejo No Bloqueante (Graceful Degradation)**:
   - Los permisos de cámara y ubicación son opcionales en este paso; si el usuario desactiva un switch o presiona *"Ahora no"*, el sistema registra la configuración y permite el acceso al mapa sin trabar la navegación ciudadana.
3. **Notificaciones Nativas PWA**:
   - Al activar el switch de Notificaciones, el servicio invoca `Notification.requestPermission()`.
   - Si el usuario concede el permiso (`'granted'`), se dispara una notificación de prueba vía Service Worker / Notification API para verificar la recepción inmediata.
4. **Mensajería de Privacidad y Cumplimiento**:
   - Se incluye el banner informativo conforme a las directivas del Acta de Inicio: la fotografía original no se persiste, sino que se procesa en el pipeline de cuarentena con difuminado automático de rostros y patentes.

### B. Gestión de Notificaciones y Perfil Ciudadano (`/perfil`)
1. **Control Bidireccional del Toggle**:
   - Refleja el estado del navegador. Si las notificaciones ya fueron concedidas, el usuario puede activarlas o desactivarlas en la app mediante `localStorage`.
2. **Manejo de Permisos Bloqueados en el SO**:
   - Si el usuario denegó el permiso previamente (`denied`), los navegadores modernos ignoran cualquier nueva invocación a `requestPermission()`.
   - Para resolver esto sin frustrar al usuario, el switch detecta el bloqueo e invoca `openSystemNotificationSettings()` y despliega un modal con las instrucciones detalladas para habilitarlo desde la barra de direcciones o ajustes del dispositivo.
3. **Reasignación de Íconos**:
   - La campana de notificaciones (`notifications`) se asignó al control de seguimiento de reportes.
   - La sección de noticias adoptó el ícono de prensa/diario (`newspaper`), alineando tanto el perfil como el menú de `AppLayout`.
4. **Descarga de Datos Personales**:
   - Implementación de un exportador en formato JSON que recopila la información de perfil, historial de reportes y consentimientos vigentes, dando cumplimiento técnico al derecho de acceso de la Ley 25.326.

### C. Adaptación Desktop de Alta Fidelidad
1. **Solución en `/perfil`**:
   - Se reemplazó el contenedor móvil estático por un layout fluido con contenedor `max-w-5xl mx-auto`.
   - Encabezado institucional `h1: Mi perfil` con subtítulo descriptivo.
   - **Grid de 12 columnas (`md:grid-cols-12`)**:
     - *Columna Izquierda (`md:col-span-5`)*: Tarjeta de identidad del usuario con avatar y badge de *Cuenta Verificada*, grid de 3 métricas y tarjeta de *Términos aceptados* (v1.3).
     - *Columna Derecha (`md:col-span-7`)*: Menú interactivo de opciones y tarjeta de acciones de sesión (*Cerrar sesión* y *Eliminar cuenta*).
   - En dispositivos móviles (`< md`), colapsa limpiamente a una única columna manteniendo la estética original del mockup.
2. **Solución en `/permisos`**:
   - En pantallas desktop (`>= md`), se agrega el header superior de navegación con el isotipo de Reportalo, la etiqueta `CIUDADANOS` y el botón *"Ahora no"*.
   - El cuerpo central pasa a ser una tarjeta modal espaciosa (`max-w-[560px]`, fondo blanco, `rounded-[24px]`, sombra suave y borde sutil `#E6ECF3`), proporcionando una experiencia de escritorio profesional.

---

## 4. 🧠 Qué Skills se Usaron

Para esta implementación y control de calidad se aplicaron los roles y habilidades especializadas de Antigravity:

| Skill Especializada | Rol Desempeñado | Aportes Clave en la Tarea |
| :--- | :--- | :--- |
| **`qa-engineer`** | Ingeniero de Calidad y Testing | - Creación de suites de pruebas con Vitest y React Testing Library.<br>- Mocks deterministas de Web APIs (`Notification`, `getUserMedia`, `geolocation`, `localStorage`, `sonner`).<br>- Verificación de aserciones de accesibilidad (`getByRole`, `aria-checked`).<br>- Matriz formal de pruebas (`.agents/workflow/tests/REP-3532.md`). |
| **`frontend-engineer`** | Ingeniero Frontend React / Tailwind | - Componentes funcionales en React 18 con custom hooks.<br>- Arquitectura CSS responsiva (`grid-cols-1 md:grid-cols-12`, breakpoints `md:`, `max-w-5xl`).<br>- Switches accesibles con `role="switch"` e interacción táctil fluida.<br>- Integración de micro-interacciones con Framer Motion. |
| **`software-delivery-workflow`** | Delivery Autónomo & Master Workflow | - Ejecución autónoma de Quality Gates sin interrupciones innecesarias.<br>- Gestión de ramas aisladas (`feat/REP-3532-aceptar-terminos`).<br>- Cumplimiento estricto de la política de cero regresiones (143/143 tests OK).<br>- Trazabilidad con reportes de ejecución (`run-001`, `run-002`). |
| **`security-guardian` / `VibeSec-Skill`** | Guardián de Privacidad y Ciberseguridad | - Cumplimiento del principio *Privacy by Design* en el tratamiento de imágenes.<br>- Mecanismo de exportación de datos y derecho al olvido según Ley 25.326.<br>- No persistencia de imágenes en bruto en el cliente ni en Supabase sin sanitización previa.<br>- Liberación inmediata de tracks de cámara (`track.stop()`) tras la verificación. |
| **`product-designer`** | Diseñador de Producto UI/UX | - Preservación de la identidad visual móvil de los mockups (Manrope, paleta institucional `#1E6FCB`, sombras `2xs`).<br>- Armonización del diseño desktop con las secciones preexistentes (`/reportes` y `/alertas`).<br>- Jerarquía visual equilibrada entre métricas, opciones y acciones destructivas. |
| **`director-tecnico`** | Arquitecto Principal | - Coordinación de la solución técnica, consistencia de versiones legales (`v1.3`).<br>- Sincronización del grafo de memoria mediante `agt memory:sync`.<br>- Documentación ejecutiva sin tecnicismos excesivos para stakeholders. |

---

## 5. 🔬 Qué Métodos se Usaron

1. **Test-Driven & Behavior-Driven Verification (TDD / BDD)**:
   - Se diseñaron los tests validando los comportamientos esperados desde la perspectiva del ciudadano (Happy Paths, Edge Cases y Denial Paths).
2. **Simulación y Aislamiento de APIs del Navegador**:
   - Uso de `vi.spyOn` para simular los estados del objeto global `Notification` (`'default'`, `'granted'`, `'denied'`) y verificar que la UI reacciona sin romper el flujo.
   - Simulación de `navigator.mediaDevices.getUserMedia` con mocks de streams y `track.stop()`.
3. **Estrategia Single Source of Truth para Accesibilidad**:
   - Unificación de encabezados en un único `h1: Mi perfil` semántico. Esto eliminó colisiones en lectores de pantalla y resolvió las inconsistencias que reportaba Testing Library al buscar headings duplicados.
4. **Responsive Fluid Layout (No Duplication in DOM)**:
   - En lugar de renderizar componentes duplicados para móvil y desktop ocultos con clases CSS, se construyó un layout reactivo unificado con Tailwind CSS que muta sus propiedades estructurales (`flex-col` a `grid-cols-12`) según el ancho de la pantalla, reduciendo la carga en el Virtual DOM.
5. **Progressive Enhancement y Tolerancia a Fallos**:
   - Si las notificaciones no están soportadas en el dispositivo, la aplicación degrada suavemente sin lanzar excepciones en consola.

---

## 6. 🧭 Cómo Chequear Todo (Guía de Validación Paso a Paso)

Para que Hernán Gregorini, Iván Juárez o cualquier desarrollador puedan validar integralmente esta entrega:

### Paso 1: Obtener la rama y dependencias
```bash
git fetch origin
git checkout feat/REP-3532-aceptar-terminos
git pull origin feat/REP-3532-aceptar-terminos
pnpm install
```

### Paso 2: Ejecutar los Tests Automatizados
```bash
# 1. Correr únicamente las pruebas de esta funcionalidad:
npx vitest run src/test/TermsFlow.test.jsx src/test/PermissionsFlow.test.jsx src/test/ProfileFlow.test.jsx

# 2. Correr la suite completa de calidad (todas las 25 suites):
pnpm test
```
*Resultado esperado:* **25 test files passed, 143 tests passed (100% verde)**.

### Paso 3: Validar el Build de Producción
```bash
pnpm run build
```
*Resultado esperado:* Compilación con Vite v6 exitosa en `dist/` sin errores de importación, TypeScript o bundle.

---

### Paso 4: Chequeo Visual e Interactivo en Navegador
Iniciar el servidor de desarrollo:
```bash
pnpm run dev
```
Abrir en el navegador (ej: `http://localhost:5173`).

#### A. Verificación de `/permisos`:
1. **Vista Móvil (Inspeccionar -> Vista Móvil / 390px)**:
   - Navegar a `/permisos`.
   - Verificar la tarjeta centrada de 340px con el escudo azul, título *"Activá los permisos"* y los 3 switches.
   - Probar apagar/encender cámara y ubicación; verificar animación del switch.
   - Activar el switch de *"Notificaciones"*: el navegador solicitará permiso nativo. Al aceptar, aparece un toast verde y se envía una notificación del sistema.
   - Probar el botón *"Continuar"*: guarda la configuración y redirige al mapa.
   - Probar *"Ahora no"*: redirige al mapa sin trabas.
2. **Vista Desktop (Pantalla Completa >= 1024px)**:
   - Verificar la barra superior con el logo de Reportalo, la etiqueta `CIUDADANOS` y el botón *"Ahora no"* a la derecha.
   - Verificar que la tarjeta central es un modal amplio (`max-w-[560px]`) con fondo blanco y bordes elegantes, eliminando la apariencia de teléfono flotante.

#### B. Verificación de `/perfil`:
1. **Vista Desktop (Pantalla Completa >= 1024px)**:
   - Navegar a `/perfil`.
   - Verificar el encabezado superior `Mi perfil`.
   - Verificar la distribución en **2 columnas**:
     - *Columna Izquierda*: Tarjeta con avatar `LF`, nombre, correo, badge de *Cuenta Verificada*; los 3 contadores métricos (7 REPORTES, 3 RESUELTOS, 1 SIN ENVIAR); tarjeta de *Términos aceptados* (v1.3 con botón *"Ver el texto aceptado"*).
     - *Columna Derecha*: Menú de opciones (Notificaciones con switch, Novedades con ícono de diario `newspaper`, Permisos de la app, Descargar mis datos) y botones de *Cerrar sesión* y *Eliminar cuenta*.
2. **Interacción con Notificaciones PWA**:
   - Con notificaciones permitidas: el toggle se enciende y apaga guardando el estado en la app.
   - Para probar bloqueo de SO: en la configuración del navegador, cambiar Notificaciones a *"Bloquear"*. Al tocar el switch en el perfil, se abre la ventana de configuración del navegador/SO y la app muestra el modal instructivo con los pasos a seguir.
3. **Descarga de Datos Personales**:
   - Clic en *"Descargar mis datos"*: debe descargarse inmediatamente un archivo `mis-datos-reportalo.json` con el histórico del usuario.
4. **Consulta de Términos**:
   - Clic en *"Ver el texto aceptado"*: navega a `/terminos` mostrando los 5 artículos legales con la indicación de que se encuentra en modo lectura.

---

## 7. 📌 Conclusión y Próximos Pasos

La implementación cumple el **100% de los Criterios de Aceptación** de la HU **REP-3532**, cubre el journey legal del ciudadano, incorpora soporte nativo de notificaciones PWA y moderniza la presentación responsive y desktop de ambas pantallas.

El código se encuentra listo para ser revisado por QA (**Iván Juárez**) y aprobado para Pull Request hacia la rama principal.