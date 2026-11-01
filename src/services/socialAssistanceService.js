/**
 * @file socialAssistanceService.js
 * @description Vulnerabilidad social (REP-3841, defecto O-06).
 *
 * Reportalo no deriva estos reportes a ningún organismo: el backend los deja en INFORMADO
 * («se informó al vecino el canal que corresponde», persist_rag_analysis) y route_report devuelve
 * `accion: 'informar_canal'` con el canal del catálogo aprobado (REP-2806): 108 o 102 en CABA, Desarrollo
 * Social o el Consejo de Niñez en Avellaneda. El canal depende de la prestación (si hay niñas, niños o
 * adolescentes), que antes el formulario no preguntaba, así que route_report caía al canal general.
 *
 * Este módulo pregunta, guarda la respuesta en infraction_attribute_responses (de donde la lee route_report)
 * y traduce el routing al canal que se muestra. Nunca inventa un canal: si el catálogo no tiene uno
 * verificado, devuelve null y la pantalla lo dice.
 */
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

export const SOCIAL_ASSISTANCE_SERVICE_CODE = 'VULNERABILIDAD_SOCIAL';

/** Atributo del catálogo donde route_report busca la prestación del reporte. */
const PRESTACION_ATTRIBUTE_CODE = 'prestacion';

/**
 * Opciones de la pregunta del paso 2. `key` es la respuesta del vecino y `prestacion`, el value_key de
 * service_attribute_values que se guarda para route_report.
 * REP-3841 (Hernán, 21/10): «No sé» se trata como si hubiera menores, con el canal de niñez. Es la misma precaución
 * que la precedencia de niñez (R-4).
 */
export const SOCIAL_ASSISTANCE_OPTIONS = [
  { key: 'situacion_de_calle', label: 'Solo personas adultas', prestacion: 'situacion_de_calle' },
  { key: 'situacion_de_calle_ninez', label: 'Hay niñas, niños o adolescentes', prestacion: 'situacion_de_calle_ninez' },
  { key: 'no_se', label: 'No sé', prestacion: 'situacion_de_calle_ninez' },
];

export const UNKNOWN_AUDIENCE_KEY = 'no_se';

const OPTION_BY_KEY = new Map(SOCIAL_ASSISTANCE_OPTIONS.map((option) => [option.key, option]));

export const isValidSocialAssistanceKey = (key) => OPTION_BY_KEY.has(key);

/** @returns {string|null} el value_key que se guarda para la respuesta del vecino */
export const prestacionForAnswer = (key) => OPTION_BY_KEY.get(key)?.prestacion ?? null;

/**
 * @param {{ id?: string, service_code?: string } | string | null} categoryOrCode categoría del formulario o service_code
 * @returns {boolean}
 */
export const isSocialAssistanceCategory = (categoryOrCode) => {
  const code = typeof categoryOrCode === 'string' ? categoryOrCode : categoryOrCode?.service_code ?? categoryOrCode?.id;
  return String(code ?? '').toUpperCase() === SOCIAL_ASSISTANCE_SERVICE_CODE;
};

/**
 * Guarda la respuesta «¿hay niñas, niños o adolescentes?» del reporte. Va antes de route_report.
 * Es idempotente (no pisa una respuesta ya guardada) y nunca lanza: si falla, el reporte queda igual y
 * route_report propone el canal general, con la salvedad de destino sin verificar.
 *
 * @param {{ reportId: string, serviceId: string, prestacionKey: string }} params
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export const saveSocialAssistancePrestacion = async ({ reportId, serviceId, prestacionKey }) => {
  if (!isSupabaseConfigured || !reportId || !serviceId || !isValidSocialAssistanceKey(prestacionKey)) {
    return { success: false, error: 'Faltan datos para guardar la prestación.' };
  }
  try {
    const { data: attribute, error: attributeError } = await supabase
      .from('service_attributes')
      .select('id')
      .eq('service_id', serviceId)
      .eq('attribute_code', PRESTACION_ATTRIBUTE_CODE)
      .maybeSingle();
    if (attributeError || !attribute?.id) {
      return { success: false, error: attributeError?.message || 'La categoría no tiene el atributo de prestación.' };
    }

    const { error } = await supabase
      .from('infraction_attribute_responses')
      .upsert(
        { report_id: reportId, attribute_id: attribute.id, selected_value: prestacionForAnswer(prestacionKey) },
        { onConflict: 'report_id,attribute_id', ignoreDuplicates: true }
      );
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: err?.message || 'No se pudo guardar la prestación.' };
  }
};

const formatChannel = (canal) => {
  if (!canal?.valor) return null;
  const label = canal.etiqueta && canal.etiqueta !== canal.valor ? canal.etiqueta : null;
  return { tipo: canal.tipo ?? null, valor: canal.valor, etiqueta: label };
};

/**
 * Canal que se le indica al vecino, según route_report. Solo cuando el catálogo lo verificó
 * (`accion: 'informar_canal'`); con el canal general o sin routing devuelve null.
 *
 * @param {object|null} routing resultado de route_report
 * @returns {{ organismo: string|null, canales: Array<{ tipo: string|null, valor: string, etiqueta: string|null }> } | null}
 */
export const describeSocialAssistanceChannel = (routing) => {
  if (!routing || routing.accion !== 'informar_canal' || routing.sin_destino_verificado) return null;
  const canales = [routing.canal_verificado, ...(routing.canales_alternativos || [])].map(formatChannel).filter(Boolean);
  if (canales.length === 0) return null;
  return { organismo: routing.organismo_verificado?.nombre ?? null, canales };
};
