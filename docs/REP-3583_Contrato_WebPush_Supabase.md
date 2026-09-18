# Contrato de Implementación: Web Push en Supabase (REP-3583)

Este documento define las especificaciones técnicas para el equipo Backend, necesarias para completar la integración de notificaciones Web Push PWA implementadas en el Frontend durante el **Sprint 12 (REP-3583)**.

## 1. Contexto Frontend
El Frontend de la PWA ya ha migrado al uso de \ite-plugin-pwa\ y Workbox, con \injectManifest\ en el archivo \src/sw.js\ y el servicio cliente \src/services/pushSubscriptionService.js\. 

Para que los usuarios puedan recibir alertas en tiempo real, el navegador generará un objeto de suscripción firmado que debe persistirse en la base de datos de Supabase.

## 2. Nuevas Tablas a crear en Supabase

Debe crearse una tabla para almacenar los endpoints de los dispositivos. Un usuario puede tener varios dispositivos (Ej: Chrome en PC y Chrome en Android).

\\\sql
CREATE TABLE public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    last_used TIMESTAMPTZ DEFAULT now()
);
-- Añadir RLS para que el usuario solo pueda leer/borrar sus propios dispositivos
\\\

## 3. Supabase Edge Functions Requeridas

El frontend invocará dos Edge Functions utilizando el SDK de supabase \supabase.functions.invoke()\.

### A. \egister-push-device\
- **Descripción**: Recibe y almacena las credenciales de Push emitidas por el navegador.
- **Payload esperado (Recibido vía POST)**:
\\\json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/ejemplo...",
  "expirationTime": null,
  "keys": {
    "p256dh": "BBlmG...==",
    "auth": "XyZ1..."
  }
}
\\\
- **Acción Backend**: 
  - Obtener el \user_id\ autenticado desde el contexto de la función.
  - Hacer un \UPSERT\ en \push_subscriptions\ basado en el \endpoint\.

### B. \unregister-push-device\
- **Descripción**: Elimina un dispositivo de la base de datos cuando el usuario revoca permisos.
- **Payload esperado**:
\\\json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/ejemplo..."
}
\\\
- **Acción Backend**: \DELETE\ en la tabla donde coincida \endpoint\ y \user_id\.

## 4. Emisión de Notificaciones (Recomendación)

Para emitir notificaciones desde una Edge Function (ej: Cuando el estado de un reporte cambia en la DB vía webhook/trigger):

1. **Dependencia Deno**: Importar \web-push\ para NodeJS/Deno.
2. **VAPID Keys**: Configurar variables de entorno en Supabase (\VAPID_PUBLIC_KEY\ y \VAPID_PRIVATE_KEY\, y \VAPID_SUBJECT=mailto:soporte@reportalo.com\).
3. **Flujo de Envío**:
   \\\javascript
   // Ejemplo conceptual de envío
   webpush.setVapidDetails(subject, publicKey, privateKey);
   
   const pushSubscription = {
     endpoint: dbRow.endpoint,
     keys: { auth: dbRow.auth, p256dh: dbRow.p256dh }
   };
   
   const payload = JSON.stringify({
     title: "Reportalo",
     body: "Tu reporte ha sido aprobado",
     url: "/reportes"
   });
   
   await webpush.sendNotification(pushSubscription, payload);
   \\\

## 5. Variables Requeridas por el Frontend
El frontend de la PWA precisa tener expuesta la clave PÚBLICA en el archivo \.env\ o Vercel enviromments:
\\\env
VITE_VAPID_PUBLIC_KEY=BLT5X...
\\\

---
*Fin del contrato de integración REP-3583.*
