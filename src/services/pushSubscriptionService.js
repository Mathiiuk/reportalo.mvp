import { supabase } from '../lib/supabaseClient';

/**
 * Convierte una clave VAPID en Base64 segura para URL a un Uint8Array.
 * @param {string} base64String 
 * @returns {Uint8Array}
 */
const urlB64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

/**
 * Solicita la suscripción a notificaciones Web Push al navegador
 * y envía el objeto de suscripción resultante al backend (Supabase).
 * 
 * @returns {Promise<boolean>} Éxito de la operación
 */
export const subscribeUserToPush = async () => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('[Push] El navegador no soporta Push Notifications.');
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    
    // Obtener la clave pública VAPID desde las variables de entorno
    const publicVapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    
    if (!publicVapidKey) {
      console.error('[Push] Falta VITE_VAPID_PUBLIC_KEY en .env');
      return false;
    }

    // 1. Suscribir al navegador al servidor de Push de Google/Mozilla/Apple
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true, // Requisito estricto por privacidad
      applicationServerKey: urlB64ToUint8Array(publicVapidKey),
    });

    // 2. Transformar los ArrayBuffers nativos a Base64 estándar para enviar en JSON
    const pushPayload = {
      endpoint: subscription.endpoint,
      expirationTime: subscription.expirationTime,
      keys: {
        p256dh: btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('p256dh')))),
        auth: btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('auth'))))
      }
    };

    // 3. Enviar la suscripción a nuestra Supabase Edge Function
    const { data, error } = await supabase.functions.invoke('register-push-device', {
      body: pushPayload
    });

    if (error) {
      console.error('[Push] Error guardando suscripción en Supabase:', error);
      return false;
    }

    console.log('[Push] Suscripción guardada correctamente:', data);
    return true;

  } catch (error) {
    console.error('[Push] Fallo en la suscripción Web Push:', error);
    return false;
  }
};

/**
 * Desuscribe al usuario de las notificaciones Web Push locales y avisa al backend.
 */
export const unsubscribeUserFromPush = async () => {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      // 1. Eliminar suscripción localmente
      await subscription.unsubscribe();
      
      // 2. Avisar al backend para eliminar el registro (opcional pero recomendado)
      await supabase.functions.invoke('unregister-push-device', {
        body: { endpoint: subscription.endpoint }
      });
      
      console.log('[Push] Usuario desuscrito correctamente.');
      return true;
    }
  } catch (error) {
    console.error('[Push] Error al desuscribir:', error);
  }
  return false;
};
