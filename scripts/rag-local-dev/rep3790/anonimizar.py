"""REP-3790 · Copias anonimizadas de las fotos de prueba (fotos/ -> fotos/anonimizadas/).

Hace a mano lo que el pipeline productivo todavía no hace (REP-3793): pixela las zonas con
personas, borra todos los metadatos (se guarda una imagen nueva, sin EXIF) y limita el lado mayor
a 1600 px. Las zonas se marcaron revisando cada foto; los originales no se modifican.
"""
from pathlib import Path
from PIL import Image

BASE = Path(__file__).parent / 'fotos'
OUT = BASE / 'anonimizadas'
MAX_SIDE = 1600
BLOCK = 14  # tamaño del pixelado: irreversible en la práctica

# Zonas (x1, y1, x2, y2) en píxeles del original, por archivo
ZONAS = {
    '01-auto-rampa.jpg': [(845, 120, 950, 210)],                      # cara de la persona con bastón
    '08-puesto-de-venta-ambulante.jpg': [(470, 130, 545, 210)],       # persona detrás de la mesa
    '09-plaza.jpg': [
        (15, 1005, 195, 1150),   # pareja en primer plano
        (465, 940, 540, 1015),   # chico en bicicleta
        (1030, 925, 1080, 1115), # corredor
        (665, 910, 715, 1005),   # peatón
    ],
}

def pixelar(img, caja):
    x1, y1, x2, y2 = caja
    zona = img.crop(caja)
    chica = zona.resize((max(1, (x2 - x1) // BLOCK), max(1, (y2 - y1) // BLOCK)), Image.BILINEAR)
    img.paste(chica.resize(zona.size, Image.NEAREST), caja)

OUT.mkdir(exist_ok=True)
for foto in sorted(BASE.glob('*.jpg')):
    img = Image.open(foto).convert('RGB')  # convert descarta metadatos y perfiles
    for caja in ZONAS.get(foto.name, []):
        pixelar(img, caja)
    img.thumbnail((MAX_SIDE, MAX_SIDE))
    destino = OUT / foto.name.replace(' ', '-')
    img.save(destino, 'JPEG', quality=88)  # sin exif=: la copia sale sin metadatos
    print(f'{foto.name} -> {destino.name} {img.size} zonas={len(ZONAS.get(foto.name, []))}')
