# Reportalo — Plataforma de Auditoría Ciudadana con IA Jurídica
## ACTA DE INICIO · VERSIÓN 3.0

**Fecha de inicio:** 24 de abril de 2026  
**Última actualización:** 19 de mayo de 2026  
**Entrega MVP:** Diciembre de 2026  
**Código:** RAR-2026  
**Alcance geográfico:** Ciudad de Buenos Aires y Avellaneda  

---

### Equipo Principal
- **Carlos Ruiz**: Sponsor y Auditor
- **Leonel Nuñez**: Project Manager (PM)
- **Matías Krepchuk**: Líder Técnico
- **Hernán Gregorini**: Product Owner / Autor (PO)
- **Ivan Juarez**: QA y UX/UI

---

## 1. Quiénes somos
Reportalo es una plataforma de auditoría ciudadana que conecta evidencia verificada de incumplimientos de normas públicas (tránsito, infraestructura, medio ambiente) con los organismos responsables de actuar, incorporando inteligencia artificial jurídica y privacidad por diseño.

### Misión
Empoderar a cada ciudadano argentino como agente activo en el cumplimiento de las normas públicas mediante una herramienta digital accesible y confiable para documentar incumplimientos en tiempo real.

### Visión
Ser la plataforma de referencia en Argentina y Latinoamérica para la auditoría ciudadana del espacio público.

### Principios Guía
1. **Participación ciudadana**: La gestión del espacio público es compartida.
2. **Privacidad por diseño**: Difuminado automático de rostros en el dispositivo y eliminación de metadatos sensibles antes de la transmisión.
3. **Transparencia**: Mapa colaborativo de incumplimientos en tiempo real y de acceso público.
4. **Colaboración institucional**: Potenciar la labor de los inspectores con evidencia estructurada y fundamento legal automático.
5. **Impacto concreto**: Medición basada en problemas resueltos en el espacio público.

---

## 2. El problema que resolvemos
Fragmentación y falta de canales formales, simples y verificables para que el ciudadano reporte incumplimientos con amparo legal.

---

## 3. Lo que construimos (PWA)
- **PWA sin instalación**: Accesible desde navegador móvil con soporte para cámara, geolocalización, notificaciones y funcionamiento offline con sincronización diferida.
- **Flujo en 3 pasos**:
  1. *Captura*: Foto con difuminado facial automático en cliente y registro geográfico protegido.
  2. *Categorización e IA*: Identificación de norma violada y asignación automática al organismo con fundamento legal redactado.
  3. *Envío*: Registro en panel del organismo y publicación en el mapa de calor en tiempo real (<5s latencia).
- **Panel para Organismos**: Gestión de estados (Aprobado, Rechazado, En Proceso, Resuelto) con trazabilidad.

---

## 4. Alcance MVP vs Futuro

### Incluido en MVP (Dic 2026)
- Soporte Android / iOS vía PWA.
- Autenticación Google / Magic Link sin contraseñas.
- Difuminado facial en cliente y anonimización de metadatos.
- Modo offline con cola de sincronización.
- Mapa de calor en tiempo real.
- Asignación inteligente por IA a organismos en CABA y Avellaneda.
- Panel web para oficiales y organismos receptores.

### Exclusiones Explícitas
- No emite sanciones ni multas directas (potestad exclusiva del organismo).
- No almacena imágenes con rostros identificables.
- No gestiona delitos penales ni emergencias (redirección a 911 / 134).
- No maneja pasarelas de pago ni datos bancarios.

### Mapeo de Organismos Receptores
| Categoría | Ejemplos | Organismo Destino |
| :--- | :--- | :--- |
| **Infraestructura vial** | Baches, semáforos fuera de servicio, luminarias | Municipio / Vialidad Nacional |
| **Infracciones de tránsito** | Camiones en vías no autorizadas, maniobras peligrosas | ANSV / Policía de Tránsito |
| **Medio ambiente** | Basurales clandestinos, quema, vertidos | MAyDS / Municipio |
| **Vulnerabilidad social (Fase 2)** | Situación de calle, menores en riesgo | Min. Capital Humano |

---

## 5. Criterios de Éxito del MVP
1. **Fricción mínima**: Reporte completado en menos de 3 pasos.
2. **Privacidad**: Anonimización facial exitosa en >= 95% de los casos.
3. **Precisión IA**: Asignación correcta de organismo en >= 85% de las pruebas.
4. **Resiliencia Offline**: 0% de pérdida de datos en reconexión.
5. **Tiempo Real**: Latencia del mapa menor a 5 segundos.
6. **Trazabilidad**: Ciclo completo de aprobación/rechazo en panel de oficial.
