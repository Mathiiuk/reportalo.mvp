// ==============================================================================
// Script de Recorte y Aislamiento Preciso del Logo (scripts/crop-clean-logo.mjs)
// ==============================================================================

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function processCleanLogo() {
  const inputPath = path.resolve('public/logo.png');
  const buffer = await fs.promises.readFile(inputPath);

  // 1. Obtener imagen RGBA
  const image = sharp(buffer).ensureAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

  console.log(`Dimensiones originales: ${info.width}x${info.height}`);

  // 2. Hacer transparente el fondo blanco (RGB > 240)
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    if (r > 240 && g > 240 && b > 240) {
      data[i + 3] = 0; // Transparente
    }
  }

  // 3. Crear buffer RGBA con fondo transparente
  const transparentBuffer = await sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .png()
    .toBuffer();

  // 4. Extraer isotipo completo con su arco naranja 100% íntegro
  // Según el escaneo de píxeles: X de 295 a 545, Y de 335 a 650
  const cleanIcon = await sharp(transparentBuffer)
    .extract({
      left: 295,
      top: 335,
      width: 250,
      height: 315,
    })
    .trim()
    .png({ compressionLevel: 9 })
    .toBuffer();

  await fs.promises.writeFile(path.resolve('public/logo-icon.png'), cleanIcon);

  // 5. Recortar logo completo (isotipo + texto "Reportalo") con trim transparente
  const cleanFullLogo = await sharp(transparentBuffer)
    .trim()
    .png({ compressionLevel: 9 })
    .toBuffer();

  await fs.promises.writeFile(path.resolve('public/logo-full.png'), cleanFullLogo);
  await fs.promises.writeFile(path.resolve('public/logo.png'), cleanFullLogo);

  const finalIconMeta = await sharp(cleanIcon).metadata();
  const finalFullMeta = await sharp(cleanFullLogo).metadata();

  console.log(`✅ Isotipo extraído a la perfección: ${finalIconMeta.width}x${finalIconMeta.height}px`);
  console.log(`✅ Logo completo extraído a la perfección: ${finalFullMeta.width}x${finalFullMeta.height}px`);
  console.log('✅ Archivos guardados:');
  console.log('- public/logo-icon.png (Isotipo pin con su arco naranja 100% redondo y completo)');
  console.log('- public/logo.png (Logo completo transparente)');
}

processCleanLogo().catch(console.error);
