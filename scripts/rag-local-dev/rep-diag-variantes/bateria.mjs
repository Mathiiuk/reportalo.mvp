// RAG-DIAG-VARIANTES · Convierte la batería de 81 casos de Hernán en un archivo de casos para run.mjs (sin red).
//
// Entrada: docs/Entrega_Matias_RAG_Sprint15/casos/bateria_completa_81.csv (está en el checkout principal, no
// versionado en las ramas de trabajo: se pasa la ruta con --csv).
// Salida: casos-bateria81.json, con el mismo formato que casos.json (escenarios + casos) y además, en cada caso,
// las filas de la batería que comparten texto, categoría y localidad (`filas`). La recuperación es determinística
// para la misma entrada, así que los 81 reportes se miden como 47 consultas distintas y el resumen pondera por filas.
//
// Esperados por escenario: los mismos de casos.json (los «aceptables» de §5 del LEEME de Hernán). Se asigna el
// escenario por zona, categoría y texto:
//   CABA:       Tránsito → TRANS_CABA · Infraestructura → BACHE_CABA (D4) · Ambiente → AMB_CABA · Comercio → COM_CABA
//   Avellaneda: Tránsito → TRANS_PBA · Infraestructura → ALUMBRADO_PBA (D3) si habla de luz, si no BACHE_PBA ·
//               Ambiente → AMB_PBA (D1) · Comercio → COM_PBA (D2)
//   Texto de tránsito cargado en Ambiente («Auto estacionado…» en CABA) → SIN_NORMA (control negativo)
//   Vulnerabilidad social → SIN_ACEPTABLES: §5 no define artículos aceptables (se espera «asistencia»); se informa
//   aparte y no entra en las métricas.
//
// Uso:  node scripts/rag-local-dev/rep-diag-variantes/bateria.mjs --csv <ruta a bateria_completa_81.csv>
import fs from 'node:fs';

const here = new URL('./', import.meta.url);
const args = process.argv.slice(2);
const csvPath = args[args.indexOf('--csv') + 1];
if (!args.includes('--csv') || !csvPath) throw new Error('Falta --csv <ruta a bateria_completa_81.csv>');

/** CSV con comillas dobles (RFC 4180), suficiente para el archivo de la batería. */
const parseCsv = (text) => {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field); field = '';
      if (row.some((f) => f !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows;
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
};

const filas = parseCsv(fs.readFileSync(csvPath, 'utf-8').replace(/^﻿/, ''));
if (filas.length !== 81) throw new Error(`Se esperaban 81 filas y hay ${filas.length}`);

// Localidad de staging de cada zona. Controlado contra citizen_reports.locality_id de los 80 reportes de la batería
// que tienen uuid (el restante es el envío perdido de D7): todos los de CABA son Flores y todos los de Avellaneda, Gerli.
const LOCALIDAD = { CABA: '41c88642-689a-4346-897d-0ae6f92bdba3', Avellaneda: 'cba99f1c-1290-4873-b4fb-af8ae61122e1' };
const SERVICIO = {
  'Tránsito': 'TRANSITO', Infraestructura: 'INFRAESTRUCTURA', Ambiente: 'AMBIENTE',
  'Comercio irregular': 'COMERCIO_IRREGULAR', 'Vulnerabilidad social': 'VULNERABILIDAD_SOCIAL',
};

const escenarioDe = (zona, categoria, texto) => {
  const t = texto.toLowerCase();
  if (categoria === 'VULNERABILIDAD_SOCIAL') return 'SIN_ACEPTABLES';
  if (categoria === 'AMBIENTE' && /auto estacionado/.test(t)) return 'SIN_NORMA';
  const pba = zona === 'Avellaneda';
  switch (categoria) {
    case 'TRANSITO': return pba ? 'TRANS_PBA' : 'TRANS_CABA';
    case 'AMBIENTE': return pba ? 'AMB_PBA' : 'AMB_CABA';
    case 'COMERCIO_IRREGULAR': return pba ? 'COM_PBA' : 'COM_CABA';
    case 'INFRAESTRUCTURA':
      if (!pba) return 'BACHE_CABA';
      return /luminaria|alumbrado|iluminaci/.test(t) ? 'ALUMBRADO_PBA' : 'BACHE_PBA';
    default: throw new Error(`Categoría sin escenario: ${categoria}`);
  }
};

const { escenarios } = JSON.parse(fs.readFileSync(new URL('casos.json', here), 'utf-8'));
escenarios.SIN_ACEPTABLES = {
  fuente: 'Vulnerabilidad social: §5 del LEEME no define artículos aceptables (el estado esperado es «asistencia»). Se informa aparte.',
  esperados: [],
};

const porClave = new Map();
for (const f of filas) {
  const categoria = SERVICIO[f.categoria];
  const localidad = LOCALIDAD[f.zona];
  if (!categoria || !localidad) throw new Error(`Fila ${f.id_plan}: zona o categoría desconocida (${f.zona} / ${f.categoria})`);
  const descripcion = f.texto_exacto.trim();
  const clave = `${localidad}|${categoria}|${descripcion}`;
  if (!porClave.has(clave)) {
    const escenario = escenarioDe(f.zona, categoria, descripcion);
    porClave.set(clave, {
      id: `B-${f.id_plan}`,
      grupo: escenario === 'SIN_NORMA' ? 'N' : escenario === 'SIN_ACEPTABLES' ? 'V' : 'B',
      escenario, zona: f.zona, localidad, categoria, descripcion, filas: [], estadosObservados: {},
    });
  }
  const c = porClave.get(clave);
  c.filas.push(f.id_plan);
  c.estadosObservados[f.estado_legal] = (c.estadosObservados[f.estado_legal] ?? 0) + 1;
}

const casos = [...porClave.values()];
fs.writeFileSync(new URL('casos-bateria81.json', here), `${JSON.stringify({ fuente: 'bateria_completa_81.csv', escenarios, casos }, null, 2)}\n`);
const porEscenario = {};
for (const c of casos) porEscenario[c.escenario] = (porEscenario[c.escenario] ?? 0) + c.filas.length;
console.log(`${filas.length} filas → ${casos.length} consultas distintas. Filas por escenario: ${JSON.stringify(porEscenario)}`);
