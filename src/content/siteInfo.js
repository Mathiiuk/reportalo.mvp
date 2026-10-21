/**
 * @file siteInfo.js
 * @description Datos institucionales de «Acerca de» y del footer compartido (REP-3866, handoff de Iván REP-3865).
 * Los textos son los del handoff (`public/acerca/index.html` y `public/js/rep-footer.js` de la entrega), sin cambios.
 * El texto institucional sigue pendiente de aprobación del PO: si cambia, se cambia solo acá.
 */

/**
 * Correo institucional. La Planning del Sprint 17 pide no publicarlo sin prueba de recepción, y esa prueba es
 * REP-3873 (Hernán, Cloudflare Email Routing), todavía abierta. Mientras SHOW_CONTACT_EMAIL sea false, ni «Acerca de»
 * ni el footer lo muestran. Al cerrar REP-3873 alcanza con ponerlo en true.
 */
export const CONTACT_EMAIL = 'info@reportalo.com.ar';
export const SHOW_CONTACT_EMAIL = false;

/** La app todavía no tiene página de política de privacidad: el enlace se oculta hasta que exista (handoff §11). */
export const SHOW_PRIVACY = false;

export const UNLZ_URL = 'https://www.unlz.edu.ar/';
export const PLACE = 'Buenos Aires, Argentina';

export const ABOUT_PARAGRAPHS = [
  'Reportalo™ es una plataforma de auditoría ciudadana. Está pensada para que cualquier vecino pueda reportar un problema del espacio público de su ciudad y seguirlo hasta que el organismo responsable responda.',
  'Cada reporte empieza con una foto. La ubicación se registra sola y, antes de enviarse, la imagen se procesa para difuminar rostros y patentes. Reportalo™ suma la normativa que aplica al caso y lo deriva al organismo que corresponde.',
  'El reporte muestra su estado y el historial de cambios, y te avisamos cada vez que avanza. En el mapa se ven, de forma anónima, los reportes de tu zona: si un problema ya fue reportado, podés sumarte en lugar de crear uno nuevo.',
  'Trabajamos con dos compromisos: que reportar sea simple para cualquier vecino y que la identidad de quien reporta quede siempre protegida.',
];

export const TEAM = [
  { name: 'Leonel Núñez', title: 'Tec. Soporte de Infraestructura' },
  { name: 'Hernán Gregorini', title: 'Tec. Soporte de Infraestructura' },
  { name: 'Matías Krepchuk', title: 'Técnico Superior en Informática' },
  { name: 'Iván Juárez', title: 'Tec. Analista de Sistemas' },
];

export const SPECIAL_MENTION = { name: 'Carlos Ruiz', title: 'Consultor especialista' };

export const CONTACT_DESCRIPTION = 'Consultas de vecinos y organismos. Te respondemos a la brevedad.';

export const FOOTER_TAGLINE = {
  ciudadano: 'Reportá problemas de tu ciudad con evidencia protegida y seguí cada caso hasta que el organismo responda.',
  municipios: 'Información para organismos y municipios sobre cómo llegan y se tratan los reportes ciudadanos.',
};

/**
 * Grupos de enlaces del footer por variante (handoff §5.2). Rutas adaptadas a la app: las preguntas frecuentes viven
 * en `/faq` (el handoff decía `/preguntas-frecuentes`).
 * @param {'ciudadano'|'municipios'} variant
 * @param {string} portalHref destino de «Ir al portal ciudadano»
 */
export const footerGroups = (variant, portalHref = '/') => {
  const legal = {
    title: 'Legal',
    links: [
      { label: 'Términos y condiciones', to: '/terminos' },
      ...(SHOW_PRIVACY ? [{ label: 'Política de privacidad', to: '/privacidad' }] : []),
    ],
  };
  if (variant === 'municipios') {
    return [
      {
        title: 'Municipios',
        links: [
          { label: 'Cómo funciona', to: '/municipios#como-funciona' },
          { label: 'Privacidad y marco legal', to: '/municipios#privacidad' },
        ],
      },
      {
        title: 'Reportalo™',
        links: [
          { label: 'Acerca de Reportalo™', to: '/acerca?desde=municipios' },
          { label: 'Ir al portal ciudadano', to: portalHref },
        ],
      },
      legal,
    ];
  }
  return [
    {
      title: 'Reportalo™',
      links: [
        { label: 'Acerca de Reportalo™', to: '/acerca' },
        { label: 'Para municipios', to: '/municipios' },
      ],
    },
    {
      title: 'Ayuda',
      links: [
        { label: 'Preguntas frecuentes', to: '/faq' },
        // Abre directamente «¿Qué hago si es una emergencia?» (FaqPage lee el hash)
        { label: '¿Es una emergencia?', to: '/faq#emergencias' },
      ],
    },
    legal,
  ];
};

/** Botón «Volver» de /acerca según de dónde se llegó (`?desde=`, handoff §5.1). */
export const ABOUT_BACK = {
  perfil: { label: 'Volver al perfil', fallback: '/perfil' },
  municipios: { label: 'Volver a Municipios', fallback: '/municipios' },
  ciudadano: { label: 'Volver', fallback: '/' },
};
