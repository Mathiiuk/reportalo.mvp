/**
 * @file faqContent.js
 * @description Preguntas frecuentes de Reportalo (REP-3554). Es solo contenido: para agregar, quitar o cambiar una
 * pregunta se edita este archivo y no hace falta tocar la pantalla (src/pages/FaqPage.jsx).
 *
 * Reglas para escribir acá:
 *   - Cada `id` es único y estable (se usa para identificar la pregunta y su respuesta en la pantalla).
 *   - La pregunta termina en «?» y la respuesta (`answer`) es un arreglo de párrafos en castellano rioplatense.
 *     Para resaltar el nombre de una pantalla o de un botón se lo encierra entre dos asteriscos: **Perfil**.
 *   - Una respuesta puede sumar, debajo de los párrafos, UNO de estos bloques opcionales:
 *       `steps`      pasos numerados (arreglo de textos);
 *       `categories` tarjetas de categoría ({ key, title, description });
 *       `phones`     teléfonos de emergencia ({ number, label }), que la pantalla muestra como enlaces para llamar.
 *   - Solo se afirma lo que la app hace hoy. Sin plazos de respuesta y sin enlaces a sitios externos.
 *
 * Estructura y preguntas según el diseño exportado (docs/export/faq); los textos están ajustados al comportamiento
 * real de la app. Pendiente de validación del PO.
 */
export const FAQ_ITEMS = [
  {
    id: 'que-es',
    question: '¿Qué es Reportalo™?',
    answer: [
      'Reportalo™ es una aplicación de auditoría ciudadana para la Ciudad de Buenos Aires y Avellaneda. Te permite reportar problemas de la vía pública con una foto y su ubicación, recibir una orientación sobre qué normativa aplica y seguir qué pasa con cada reporte.',
    ],
  },
  {
    id: 'como-reportar',
    question: '¿Cómo hago un reporte?',
    answer: ['Tocá **Reportar** y seguí tres pasos:'],
    steps: [
      'Sacá o elegí una foto del problema (hasta 4). Tu ubicación ayuda a elegir la localidad.',
      'Elegí la categoría y contá brevemente qué pasa.',
      'Confirmá el lugar, revisá el reporte y envialo. La orientación legal aparece después, en el detalle del reporte.',
    ],
  },
  {
    id: 'categorias',
    question: '¿Qué categorías de reporte hay?',
    answer: ['Hay cinco categorías:'],
    categories: [
      { key: 'infra', title: 'Infraestructura', description: 'Baches, veredas rotas y calzada hundida.' },
      { key: 'transito', title: 'Tránsito', description: 'Estacionamiento indebido, rampas bloqueadas y camiones fuera de horario.' },
      { key: 'ambiente', title: 'Ambiente', description: 'Microbasurales, podas clandestinas y contaminación.' },
      { key: 'vulnerabilidad', title: 'Vulnerabilidad social', description: 'Personas en situación de calle o que necesitan asistencia.' },
      { key: 'comercio', title: 'Comercio irregular', description: 'Venta sin habilitación y ocupación del espacio público.' },
    ],
  },
  {
    id: 'fotos',
    question: '¿Qué pasa con mis fotos?',
    answer: [
      'Antes de guardarse, cada foto se procesa para difuminar rostros y patentes y eliminar los datos ocultos de la imagen; la foto original no se guarda. Solo se usa como evidencia del reporte: la ven vos y quien lo atiende. El resto de las personas ve solo un resumen.',
    ],
  },
  {
    id: 'seguimiento',
    question: '¿Cómo sigo el estado de mi reporte?',
    answer: [
      'Entrá a **Mis reportes**. Cada reporte muestra su estado (Enviado, En revisión, Notificado al responsable, Resuelto o Descartado) y su recorrido. Los cambios de estado también aparecen en tus notificaciones.',
    ],
  },
  {
    id: 'sin-conexion',
    question: '¿Qué hago si no tengo internet?',
    answer: [
      'Podés hacer el reporte igual. Queda guardado en tu dispositivo y se envía solo cuando vuelve la conexión. Mientras tanto lo ves en **Pendientes de envío**, donde también podés completarlo o descartarlo.',
    ],
  },
  {
    id: 'reportes-de-otros',
    question: '¿Puedo ver los reportes de otras personas?',
    answer: [
      'Sí. El mapa muestra los reportes de la zona con su categoría, descripción, localidad y estado. Las fotos y el análisis de cada reporte son privados.',
    ],
  },
  {
    id: 'emergencias',
    question: '¿Qué hago si es una emergencia?',
    answer: [
      'Reportalo™ no es un servicio de emergencias. Si hay riesgo para la vida o la seguridad de alguien, llamá directamente:',
    ],
    phones: [
      { number: '911', label: 'Policía' },
      { number: '107', label: 'SAME' },
      { number: '100', label: 'Bomberos' },
    ],
  },
  {
    id: 'cuenta-y-permisos',
    question: '¿Cómo cierro sesión o cambio los permisos?',
    answer: [
      'Andá a **Perfil**. Ahí encontrás **Permisos de la app** (en una computadora, **Permisos del sitio**) para revisar el acceso a la cámara, la ubicación y las notificaciones, y al final de la pantalla el botón **Cerrar sesión**.',
    ],
  },
  {
    id: 'borrar-cuenta',
    question: '¿Puedo borrar mi cuenta?',
    answer: [
      'Sí. En **Perfil**, tocá **Eliminar mi cuenta y mis datos** para pedir la baja de tu cuenta y de tus datos personales.',
    ],
  },
];

/** Bloque de contacto al pie de la pantalla. El correo se abre en la app de mail del dispositivo. */
export const FAQ_CONTACT = {
  title: '¿No encontraste tu respuesta?',
  description: 'Escribinos y te respondemos.',
  email: 'info@reportalo.com.ar',
  cta: 'Contactar',
};
