// ==============================================================================
// Script de Procesamiento de Logo Transparente y Recortado (scripts/process-logo.mjs)
// ==============================================================================

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function processLogo() {
  const inputPath = path.resolve('dist/logo.png');
  console.log('Leyendo origen de logo desde:', inputPath);
  const buffer = await fs.promises.readFile(inputPath);

  // 1. Obtener datos crudos de píxeles RGBA
  const image = sharp(buffer);
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  // 2. Hacer transparente el fondo blanco (RGB superiores a 240)
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Umbral de blanco de fondo
    if (r > 238 && g > 238 && b > 238) {
      data[i + 3] = 0; // Alpha 0 = totalmente transparente
    }
  }

  // 3. Crear imagen transparente completa y recortar bordes vacíos (trim)
  const trimmedFull = await sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .trim()
    .png({ compressionLevel: 9, quality: 100 })
    .toBuffer();

  // Guardar logo completo transparente y recortado
  await fs.promises.writeFile(path.resolve('public/logo.png'), trimmedFull);
  await fs.promises.writeFile(path.resolve('public/logo-full.png'), trimmedFull);

  // 4. Crear versión isotipo (solo el pin circular de la izquierda sin letras)
  const fullMeta = await sharp(trimmedFull).metadata();
  // El pin mide aproximadamente 0.77 de la altura total de la imagen
  const iconWidth = Math.round(fullMeta.height * 0.76);

  const iconBuffer = await sharp(trimmedFull)
    .extract({
      left: 0,
      top: 0,
      width: iconWidth,
      height: fullMeta.height,
    })
    .trim()
    .png({ compressionLevel: 9, quality: 100 })
    .toBuffer();

  await fs.promises.writeFile(path.resolve('public/logo-icon.png'), iconBuffer);

  console.log('✅ Archivos generados correctamente en public/:');
  console.log('- public/logo.png (Logo completo sin fondo recortado, transparente)');
  console.log('- public/logo-icon.png (Isotipo pin aislado y transparente)');
}

processLogo().catch((err) => {
  console.error('Error procesando logos:', err);
  process.exit(1);
});
