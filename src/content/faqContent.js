/**
 * @file faqContent.js
 * @description Preguntas frecuentes de Reportalo (REP-3554). Es solo contenido: para agregar, quitar o cambiar una
 * pregunta se edita este arreglo y no hace falta tocar la pantalla (src/pages/FaqPage.jsx).
 *
 * Reglas para escribir acá:
 *   - Cada `id` es único y estable (se usa para identificar la pregunta y su respuesta en la pantalla).
 *   - La pregunta termina en «?» y la respuesta es texto llano, en castellano rioplatense.
 *   - Solo se afirma lo que la app hace hoy. Sin plazos de respuesta, sin canales de soporte y sin enlaces externos.
 *
 * Contenido redactado a partir del comportamiento real de la app (Sprint 15). Pendiente de validación del PO.
 */
export const FAQ_ITEMS = [
  {
    id: 'que-es',
    question: '¿Qué es Reportalo?',
    answer:
      'Es una app para avisar de problemas en la vía pública de la Ciudad de Buenos Aires y de Avellaneda y seguir qué pasa con cada aviso. Vos reportás y el reporte llega a quienes pueden atenderlo.',
  },
  {
    id: 'como-reportar',
    question: '¿Cómo hago un reporte?',
    answer:
      'Tocá «Reportar», sacá o elegí una foto (hasta 4), elegí la categoría y contá brevemente qué pasa (entre 10 y 280 caracteres). Después confirmá el lugar y enviá. Tu ubicación te ayuda a elegir la localidad, pero siempre la confirmás vos.',
  },
  {
    id: 'categorias',
    question: '¿Qué categorías de reporte hay?',
    answer:
      'Infraestructura, Tránsito, Ambiente, Comercio irregular y Vulnerabilidad social. Elegí la que mejor describa lo que viste.',
  },
  {
    id: 'fotos',
    question: '¿Qué pasa con mis fotos?',
    answer:
      'Antes de guardarse, las fotos se procesan de forma segura: se difuminan rostros y patentes y se eliminan los datos ocultos de la imagen, y la foto original no se guarda. Las fotos de tu reporte las ves vos y quien lo atiende; el resto de las personas ve solo un resumen.',
  },
  {
    id: 'seguimiento',
    question: '¿Cómo sigo el estado de mi reporte?',
    answer:
      'En «Mis reportes» ves todos los que enviaste y, al tocar uno, su recorrido: Enviado, En revisión, Notificado al responsable y Resuelto (o Descartado). Los cambios de estado también aparecen en tus notificaciones.',
  },
  {
    id: 'sin-conexion',
    question: '¿Qué hago si no tengo internet?',
    answer:
      'Podés cargar tu reporte igual: queda guardado en tu dispositivo y se envía solo cuando vuelve la conexión. Mientras tanto lo ves en «Pendientes de envío», donde también podés completarlo o descartarlo.',
  },
  {
    id: 'fundamento-legal',
    question: '¿Qué es el fundamento legal de mi reporte?',
    answer:
      'Es una orientación automática que relaciona lo que reportaste con normas de la ciudad. Sirve para entender mejor tu caso, pero no es una resolución. Si todavía no tenemos normativa cargada para ese tipo de reclamo, te lo decimos y tu reporte sigue su curso igual.',
  },
  {
    id: 'reportes-de-otros',
    question: '¿Puedo ver los reportes de otras personas?',
    answer:
      'Sí. En el mapa ves los reportes de la zona con su categoría, descripción, localidad y estado. Las fotos y el análisis de cada reporte son privados.',
  },
  {
    id: 'emergencias',
    question: '¿Qué hago si es una emergencia?',
    answer:
      'Reportalo no es un servicio de emergencias. Si hay un peligro inmediato para una persona, llamá al 911.',
  },
  {
    id: 'cuenta-y-permisos',
    question: '¿Cómo cierro sesión o cambio los permisos?',
    answer:
      'Desde tu Perfil: ahí cerrás sesión y, en «Permisos de la app», revisás o cambiás el acceso a la cámara, la ubicación y las notificaciones.',
  },
];
