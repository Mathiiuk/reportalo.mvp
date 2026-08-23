// ==============================================================================
// Script de Recorte Perfecto del Logo e Isotipo (scripts/crop-perfect-logo.mjs)
// ==============================================================================

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function generatePerfectLogos() {
  const inputPath = path.resolve('public/logo.png');
  const buffer = await fs.promises.readFile(inputPath);

  // 1. Obtener imagen RGBA completa (1536x1024)
  const image = sharp(buffer).ensureAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

  console.log(`Original: ${info.width}x${info.height}`);

  // 2. Hacer transparente el fondo blanco (RGB > 240)
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    if (r > 240 && g > 240 && b > 240) {
      data[i + 3] = 0; // Transparente
    }
  }

  // 3. Crear logo completo recortado con trim()
  const trimmedFullBuffer = await sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .trim()
    .png({ compressionLevel: 9 })
    .toBuffer();

  const fullMeta = await sharp(trimmedFullBuffer).metadata();
  console.log(`Logo completo recortado (trim): ${fullMeta.width}x${fullMeta.height}px`);

  // Guardar logo completo transparente y recortado
  await fs.promises.writeFile(path.resolve('public/logo-full.png'), trimmedFullBuffer);
  await fs.promises.writeFile(path.resolve('public/logo.png'), trimmedFullBuffer);

  // 4. Analizar columnas del logo recortado para aislar el pin (primer grupo antes del espacio en blanco)
  const { data: fullData, info: fullInfo } = await sharp(trimmedFullBuffer)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const nonZeroInCol = new Array(fullInfo.width).fill(0);
  for (let x = 0; x < fullInfo.width; x++) {
    for (let y = 0; y < fullInfo.height; y++) {
      const idx = (y * fullInfo.width + x) * 4;
      if (fullData[idx + 3] > 10) {
        nonZeroInCol[x]++;
      }
    }
  }

  // Encontrar el primer valle (columna con 0 pixels no transparentes entre el isotipo y el texto)
  let valleyStart = 0;
  for (let x = 10; x < fullInfo.width; x++) {
    if (nonZeroInCol[x] === 0) {
      valleyStart = x;
      break;
    }
  }

  console.log(`Límite derecho del isotipo en el logo recortado: ${valleyStart}px (sobre ${fullInfo.width}px total)`);

  // 5. Extraer el isotipo pin completo (desde x=0 hasta x=valleyStart)
  const iconBuffer = await sharp(trimmedFullBuffer)
    .extract({
      left: 0,
      top: 0,
      width: valleyStart,
      height: fullInfo.height,
    })
    .trim()
    .png({ compressionLevel: 9 })
    .toBuffer();

  await fs.promises.writeFile(path.resolve('public/logo-icon.png'), iconBuffer);

  const iconMeta = await sharp(iconBuffer).metadata();
  console.log(`✅ Isotipo PIN extraído con curva naranja 100% íntegra: ${iconMeta.width}x${iconMeta.height}px`);
}

generatePerfectLogos().catch((err) => {
  console.error('Error generando logos:', err);
  process.exit(1);
});
