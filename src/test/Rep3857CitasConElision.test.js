/**
 * @file Rep3857CitasConElision.test.js
 * @description REP-3857 (RAG P1): citas con elisión por tramos. La base es la rama de S16 (casos de ValidateLlmAnalysis);
 * acá van las reglas que pide el ticket y que faltaban, y la paridad entre las tres copias del validador:
 * la función (analizar-reporte), el espejo del frontend y la réplica de los runners (rep-diag-generacion → p0).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { quoteMatchesFragment } from '../services/validateLlmAnalysis';
import { quoteMatchesFragment as replicaRunners } from '../../scripts/rag-local-dev/rep-diag-generacion/lib.mjs';
import { validarComoProduccion, leerReglasValidador, citaLiteralP0, filaM2, resumenM2 } from '../../scripts/rag-local-dev/p0/esquema.mjs';

// En Windows el checkout puede traer CRLF: se compara el código, no el fin de línea
const leer = (ruta) => readFileSync(resolve(__dirname, '../..', ruta), 'utf8').replace(/\r\n/g, '\n');
const FUNCION = leer('supabase/functions/analizar-reporte/index.ts');
const ESPEJO = leer('src/services/validateLlmAnalysis.js');
const REPLICA = leer('scripts/rag-local-dev/rep-diag-generacion/lib.mjs');

describe('REP-3857 · lo omitido en los bordes de la cita', () => {
  it('con «...» al principio, rechaza si lo omitido de la misma oración tiene una negación', () => {
    const fragmento = 'No se permite estacionar sobre la vereda en todo el ejido urbano.';
    expect(quoteMatchesFragment('... se permite estacionar sobre la vereda', fragmento)).toBe(false);
    expect(quoteMatchesFragment('[...] se permite estacionar sobre la vereda', fragmento)).toBe(false);
  });

  it('con «...» al final, rechaza si lo omitido de la misma oración tiene una salvedad', () => {
    const fragmento = 'Se permite estacionar sobre la vereda, salvo en días hábiles. El resto queda prohibido.';
    expect(quoteMatchesFragment('Se permite estacionar sobre la vereda …', fragmento)).toBe(false);
    expect(quoteMatchesFragment('Se permite estacionar sobre la vereda (...)', fragmento)).toBe(false);
  });

  it('sin negación ni salvedad en lo omitido del borde, la elisión se acepta', () => {
    const fragmento = 'El titular debe mantener la vereda. Se permite estacionar sobre la vereda los domingos y feriados.';
    expect(quoteMatchesFragment('... Se permite estacionar sobre la vereda', fragmento)).toBe(true);
    expect(quoteMatchesFragment('Se permite estacionar sobre la vereda ...', fragmento)).toBe(true);
  });

  // REP-3861 H-01: antes lo omitido en el borde se revisaba solo hasta el «. » más cercano. Ahora llega al borde del
  // fragmento: una negación en otra oración también bloquea (del lado seguro; la cita queda como en P0).
  it('una negación en otra oración del fragmento también bloquea la elisión del borde', () => {
    const fragmento = 'No corresponde la multa. Se permite estacionar sobre la vereda los domingos y feriados.';
    expect(quoteMatchesFragment('... Se permite estacionar sobre la vereda', fragmento)).toBe(false);
  });

  it('V-53: una abreviatura («art. 5») no corta lo omitido y el «No» del principio se detecta', () => {
    const fragmento = 'No podrá, conforme al art. 5 del presente, estacionar vehículos sobre la vereda del frente.';
    expect(quoteMatchesFragment('... estacionar vehículos sobre la vereda del frente', fragmento)).toBe(false);
  });

  it('V-54: una abreviatura («inc. b)») no corta lo omitido y el «salvo» del final se detecta', () => {
    const fragmento = 'Se permite estacionar sobre la vereda del frente según el inc. b) salvo en días hábiles.';
    expect(quoteMatchesFragment('Se permite estacionar sobre la vereda del frente ...', fragmento)).toBe(false);
  });

  it('las cuatro salvedades compuestas del ticket se detectan en lo salteado', () => {
    for (const salvedad of ['siempre que', 'sin perjuicio', 'excepto', 'excepción', 'nunca', 'jamás', 'ni']) {
      const fragmento = `El titular debe mantener la vereda en buen estado ${salvedad} lo disponga la autoridad de aplicación del municipio.`;
      expect(
        quoteMatchesFragment('El titular debe mantener la vereda ... la autoridad de aplicación del municipio.', fragmento),
        salvedad
      ).toBe(false);
    }
  });
});

describe('REP-3861 O-02 · tramo que aparece más de una vez', () => {
  it('prueba todas las apariciones del tramo, no solo la primera', () => {
    const fragmento = 'Se permite estacionar de noche, salvo en verano; se permite estacionar de día en todo el ejido urbano.';
    expect(quoteMatchesFragment('se permite estacionar ... en todo el ejido urbano', fragmento)).toBe(true);
    expect(replicaRunners('se permite estacionar ... en todo el ejido urbano', fragmento)).toBe(true);
  });

  it('si ninguna aparición sirve, rechaza', () => {
    const fragmento = 'Se permite estacionar de noche, salvo en verano; se permite estacionar, salvo feriados, en todo el ejido urbano.';
    expect(quoteMatchesFragment('se permite estacionar ... en todo el ejido urbano', fragmento)).toBe(false);
  });
});

describe('REP-3857 · saltos de línea', () => {
  it('normaliza CRLF y LF igual en la cita y en la fuente, sin aceptar texto inventado', () => {
    const fragmento = 'Constituyen obras públicas municipales:\r\na) Las concernientes a los establecimientos municipales.\r\nd) Las de infraestructura urbana, en especial las de pavimentación.';
    expect(quoteMatchesFragment('Constituyen obras públicas municipales:\n...\nd) Las de infraestructura urbana', fragmento)).toBe(true);
    expect(quoteMatchesFragment('Constituyen obras públicas municipales:\r\n... d) Las de infraestructura rural', fragmento)).toBe(false);
  });

  it('sin marca de elisión el resultado es el de P0: solo un tramo literal (tolerando espacios)', () => {
    const fragmento = 'Prohíbese estacionar\r\nsobre las rampas.';
    expect(quoteMatchesFragment('Prohíbese estacionar sobre las rampas.', fragmento)).toBe(true);
    expect(quoteMatchesFragment('Prohíbese estacionar en las rampas.', fragmento)).toBe(false);
  });
});

describe('REP-3857 · las tres copias del validador son iguales', () => {
  const bloque = (fuente) =>
    fuente
      .slice(fuente.indexOf('const ELISION_MARKER'), fuente.indexOf('\n', fuente.indexOf('const omitsCaveat')))
      // REP-3879 H-02: la función lleva el tipo del parámetro; el resto del bloque es idéntico.
      .replace('(text: string): boolean =>', '(text) =>');
  const funcionJs = (fuente) => {
    const desde = fuente.indexOf('quoteMatchesFragment = ');
    return fuente.slice(desde, fuente.indexOf('\n};', desde));
  };

  it('mismas constantes: marcas, tramo mínimo, salvedades, bordes y omitsCaveat', () => {
    expect(bloque(FUNCION)).not.toBe('');
    expect(bloque(ESPEJO)).toBe(bloque(FUNCION));
    expect(bloque(REPLICA)).toBe(bloque(FUNCION));
  });

  it('el espejo del frontend y la réplica de los runners tienen el mismo código', () => {
    expect(funcionJs(REPLICA)).toBe(funcionJs(ESPEJO));
  });

  it('la función, sin las anotaciones de tipos, tiene el mismo código', () => {
    const sinTipos = funcionJs(FUNCION)
      .replace(/\(quote: string, content: string\): boolean/g, '(quote, content)')
      .replace(/\(i: number, from: number\): boolean/g, '(i, from)');
    expect(funcionJs(FUNCION)).not.toBe('');
    expect(sinTipos).toBe(funcionJs(ESPEJO));
  });

  it('los dos JS dan lo mismo que el validador de los runners en casos reales', () => {
    const casos = [
      ['No se permite estacionar sobre la vereda en todo el ejido.', '... se permite estacionar sobre la vereda'],
      ['Constituyen obras públicas municipales:\nd) Las de infraestructura urbana.', 'Constituyen obras públicas municipales: ... d) Las de infraestructura urbana.'],
      ['uno dos tres', 'uno tres'],
      ['No podrá, conforme al art. 5 del presente, estacionar vehículos sobre la vereda del frente.', '... estacionar vehículos sobre la vereda del frente'],
      ['Se permite estacionar sobre la vereda del frente según el inc. b) salvo en días hábiles.', 'Se permite estacionar sobre la vereda del frente ...'],
    ];
    for (const [fragmento, cita] of casos) expect(replicaRunners(cita, fragmento)).toBe(quoteMatchesFragment(cita, fragmento));
  });
});

describe('REP-3857 · runner M2 (P1) con la regla nueva', () => {
  const reglas = { ...leerReglasValidador(FUNCION), agencias: new Set() };
  const base = { estado: 'fundamentado', es_infraccion: true, fundamento_ciudadano: 'x', fundamento_oficial: 'y', confianza: 0.9, organismo_sugerido_id: null };
  const fragments = [
    {
      fragment_id: 'f-lom59',
      content: 'Constituyen obras públicas municipales:\na) Las concernientes a los establecimientos municipales.\nd) Las de infraestructura urbana, en especial las de iluminación.',
    },
  ];

  it('acepta la elisión válida de la LOM art. 59 y la marca como cita que pasa el validador', () => {
    const r = validarComoProduccion(
      { ...base, citas: [{ fragment_id: 'f-lom59', cita_textual: 'Constituyen obras públicas municipales: ... d) Las de infraestructura urbana' }] },
      fragments,
      'INFRAESTRUCTURA',
      reglas
    );
    expect(r.valid).toBe(true);
    expect(r.citas[0]).toMatchObject({ en_contexto: true, literal: true, pasa: true });
  });

  it('rechaza un tramo corto, como la función', () => {
    const r = validarComoProduccion(
      { ...base, citas: [{ fragment_id: 'f-lom59', cita_textual: 'Constituyen ... iluminación' }] },
      fragments,
      'INFRAESTRUCTURA',
      reglas
    );
    expect(r.valid).toBe(false);
  });
});

describe('REP-3857 · --doble-validador: la misma respuesta con la regla de P0 y la de P1', () => {
  const reglas = { ...leerReglasValidador(FUNCION), agencias: new Set() };
  const base = { estado: 'fundamentado', es_infraccion: true, fundamento_ciudadano: 'x', fundamento_oficial: 'y', confianza: 0.9, organismo_sugerido_id: null };
  const fragments = [
    { fragment_id: 'f-lom59', content: 'Constituyen obras públicas municipales:' + String.fromCharCode(10) + 'a) Las concernientes a los establecimientos municipales.' + String.fromCharCode(10) + 'd) Las de infraestructura urbana, en especial las de iluminación.' },
  ];
  const parsed = { ...base, citas: [{ fragment_id: 'f-lom59', cita_textual: 'Constituyen obras públicas municipales: ... d) Las de infraestructura urbana' }] };
  const fila = () =>
    filaM2(
      {
        camino: 'generacion', parsed, fragments, usage: {}, latencia_ms: 1,
        validacion: validarComoProduccion(parsed, fragments, 'INFRAESTRUCTURA', reglas),
        validacionP0: validarComoProduccion(parsed, fragments, 'INFRAESTRUCTURA', { ...reglas, citaCoincide: citaLiteralP0 }),
      },
      ['f-lom59']
    );

  it('la regla de P0 rechaza la elisión y la de P1 la acepta, sobre la misma respuesta', () => {
    const f = fila();
    expect(f.rechazo_validador).toBe(false);
    expect(f.cita_esperada_n1).toBe(true);
    expect(f.validador_p0).toMatchObject({ rechazo_validador: true, estado: 'indeterminado', cita_esperada_n1: false });
    expect(f.citas[0]).toMatchObject({ con_elision: true, cita_textual: parsed.citas[0].cita_textual });
  });

  it('el resumen cuenta la fila como rescatada por P1, sin pérdidas', () => {
    const r = resumenM2([{ ...fila(), caso_id: 'P0-071', repeticion: 1, pendiente_po: false, esperados_n1: ['f-lom59'] }]);
    expect(r.todos.doble_validador).toMatchObject({
      rechazos_p0: 1, rechazos_p1: 0, acierto_n1_p0: 0, acierto_n1_p1: 1,
      rescatadas_por_p1: ['P0-071 r1'], perdidas_por_p1: [], citas_con_elision: 1,
    });
  });

  it('sin el modo, la fila no trae validador_p0 y el resumen no agrega el bloque', () => {
    const f = filaM2({ camino: 'generacion', parsed, fragments, usage: {}, latencia_ms: 1, validacion: validarComoProduccion(parsed, fragments, 'INFRAESTRUCTURA', reglas) }, ['f-lom59']);
    expect(f.validador_p0).toBeUndefined();
    expect(resumenM2([{ ...f, caso_id: 'x', repeticion: 1, pendiente_po: false, esperados_n1: ['f-lom59'] }]).todos.doble_validador).toBeUndefined();
  });
});

// REP-3879 H-02 (Hernán, 01/11/2026). Textos reales del corpus: Ley 15.625 art. 6, fragmento de la Línea 108
// (`40000000-…-0059` en staging), Ley 24.449 art. 48 y LOM art. 59.
describe('REP-3879 H-02 · lista de Hernán: lo que no se puede omitir con «...»', () => {
  const LEY_15625_ART_6 =
    'El Estado debe realizar acciones positivas tendientes a evitar y eliminar toda discriminación o estigmatización hacia las personas en situación de calle o en riesgo a la situación de calle, estableciendo a la vez condiciones que permitan el ejercicio de su autodeterminación y el libre desarrollo de la personalidad y de la subjetividad. En ningún caso se podrá negar atención a personas en situación de calle o en riesgo de situación de calle por falta de documentación.';
  const LINEA_108 =
    'Para avisar por otra persona corresponde la opción 1. La línea atiende únicamente en la Ciudad Autónoma de Buenos Aires.';
  const LEY_24449_ART_48 =
    'Está prohibido en la vía pública: i) La detención irregular sobre la calzada, el estacionamiento sobre la banquina y la detención en ella sin ocurrir emergencia;';
  const LOM_ART_59 = [
    'Constituyen obras públicas municipales:',
    'a) Las concernientes a los establecimientos e instituciones municipales.',
    'b) Las de ornato, salubridad, vivienda y urbanismo.',
    'c) Las atinentes a servicios públicos de competencia municipal.',
    'd) Las de infraestructura urbana, en especial las de pavimentación, repavimentación, cercos, veredas, saneamiento, agua corriente, iluminación, electrificación, provisión de gas y redes telefónicas.',
    'Se considerará que las obras de infraestructura cuentan con declaración de utilidad pública, cuando estén incluidas expresamente en planes integrales de desarrollo urbano, aprobados por ordenanza.',
    'Cuando se trate de obras que no estén incluidas en los planes aludidos precedentemente, sólo se podrá proceder a la pertinente declaración de Utilidad pública, mediante ordenanza debidamente fundada.',
  ].join('\n');
  // Plantilla: lo único omitido entre los dos tramos es la palabra que se prueba.
  const conOmitido = (palabra) =>
    quoteMatchesFragment(
      'El titular debe mantener la vereda ... la autoridad de aplicación del municipio.',
      `El titular debe mantener la vereda en buen estado ${palabra} lo disponga la autoridad de aplicación del municipio.`,
    );

  it('Ley 15.625 art. 6: rechaza si lo omitido dice «En ningún caso»', () => {
    const cita = 'el libre desarrollo de la personalidad y de la subjetividad. ... se podrá negar atención a personas en situación de calle';
    expect(quoteMatchesFragment(cita, LEY_15625_ART_6)).toBe(false);
  });

  it('Línea 108: rechaza si lo omitido dice «únicamente»', () => {
    expect(quoteMatchesFragment('La línea atiende ... en la Ciudad Autónoma de Buenos Aires.', LINEA_108)).toBe(false);
  });

  it('Ley 24.449 art. 48: rechaza si lo omitido dice «prohibido»', () => {
    expect(quoteMatchesFragment('... en la vía pública: i) La detención irregular sobre la calzada', LEY_24449_ART_48)).toBe(false);
  });

  it('acepta si lo omitido solo dice «niños» o «niñez»: «ni» se busca como palabra entera', () => {
    for (const omitido of ['niños', 'niñez', 'ninos']) expect(conOmitido(omitido), omitido).toBe(true);
  });

  it('LOM art. 59: sigue aceptada la cita que termina en «telefónicas.» y omite los incisos a) a c)', () => {
    const cita =
      'Constituyen obras públicas municipales: ... d) Las de infraestructura urbana, en especial las de pavimentación, repavimentación, cercos, veredas, saneamiento, agua corriente, iluminación, electrificación, provisión de gas y redes telefónicas.';
    expect(quoteMatchesFragment(cita, LOM_ART_59)).toBe(true);
  });

  it('LOM art. 59: rechaza la cita que termina en «...» y deja afuera «que no estén incluidas…» («no» y «sólo»)', () => {
    expect(quoteMatchesFragment('d) Las de infraestructura urbana, en especial las de pavimentación ...', LOM_ART_59)).toBe(false);
  });

  it('detecta cada palabra y raíz de la lista, con y sin tilde y en mayúsculas', () => {
    const palabras = [
      // Negación
      'no', 'ni', 'nunca', 'jamás', 'jamas', 'tampoco', 'ningún', 'ningun', 'ninguna', 'ninguno', 'ningunos', 'nadie', 'nada',
      // Excepción
      'salvo', 'salvedad', 'salvedades', 'excepto', 'excepción', 'excepciones', 'exceptúase', 'exceptuados', 'a menos que', 'sin perjuicio',
      // Dispensa
      'exime', 'eximidos', 'exento', 'exenta', 'exención', 'exenciones',
      // Prohibición
      'prohibido', 'prohibiciones', 'prohíbese', 'prohíbe',
      // Condición
      'siempre que', 'siempre y cuando', 'a condición de', 'solo si',
      // Restricción
      'únicamente', 'unicamente', 'sólo', 'solo', 'solamente',
    ];
    for (const palabra of palabras) {
      for (const forma of [palabra, palabra.toUpperCase(), palabra[0].toUpperCase() + palabra.slice(1)]) {
        expect(conOmitido(forma), forma).toBe(false);
      }
    }
  });

  it('«sin», «cuando» y «si» quedan afuera a propósito: no bloquean la elisión', () => {
    for (const palabra of ['sin', 'cuando', 'si', 'Sin', 'Cuando']) expect(conOmitido(palabra), palabra).toBe(true);
  });

  it('una raíz no se detecta dentro de otra palabra («nadar», «nivel», «solar», «excelente»)', () => {
    for (const palabra of ['nadar', 'nivel', 'solar', 'soltar', 'excelente', 'nota', 'unico']) {
      expect(conOmitido(palabra), palabra).toBe(true);
    }
  });
});
