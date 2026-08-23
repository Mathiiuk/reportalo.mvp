// ==============================================================================
// Utilidades para Solicitud y Manejo de Permisos Nativos del Navegador
// ==============================================================================

// Solicitar acceso a la cámara mediante MediaDevices API
export const requestCameraPermission = async () => {
  // Comprobar soporte en el navegador
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return { granted: false, error: 'La cámara no está soportada en este navegador.' };
  }

  try {
    // Solicitud nativa al hardware de la cámara
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    // Detener la transmisión de inmediato para liberar la cámara
    stream.getTracks().forEach((track) => track.stop());
    return { granted: true };
  } catch (error) {
    return { granted: false, error: error.message || 'Permiso de cámara denegado.' };
  }
};

// Solicitar acceso a la geolocalización (GPS)
export const requestLocationPermission = async () => {
  // Comprobar soporte en el navegador
  if (!navigator.geolocation) {
    return { granted: false, error: 'La geolocalización no está soportada en este navegador.' };
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        // Permiso concedido con éxito
        resolve({
          granted: true,
          coords: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
        });
      },
      (error) => {
        // Permiso rechazado o error de timeout
        resolve({
          granted: false,
          error: error.message || 'Permiso de ubicación denegado.',
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  });
};
