"""Genera el dataset limpio del puente vecino -> prestación -> norma -> destino, para cargar en la base de Reportalo.

Entradas: la taxonomía oficial SUACI 2023 (solo categoría, prestación y tipo; sin datos personales).
Salidas (en esta carpeta):
  prestaciones.csv      prestaciones oficiales en alcance, con su categoría de Reportalo y su grupo de destino
  vocabulario.csv       términos -> prestación, con origen (suaci / norma / pruebas_s15 / po)
  destino.csv           jurisdicción + grupo de destino -> organismo y canales, con fuente
  vinculos_norma.csv    grupo de destino -> normas (competencia y conducta) que lo fundamentan
Uso: python generar_dataset_puente.py <ruta a suaci_taxonomia_2023.csv>
"""
import csv
import os
import sys

sys.stdout.reconfigure(encoding="utf-8")
SUACI = sys.argv[1]
OUT = os.path.dirname(os.path.abspath(__file__))

# --- 1. Alcance: categoría SUACI (+ prestaciones puntuales) -> categoría Reportalo y grupo de destino ---
POR_CATEGORIA = {
    "ALUMBRADO": ("INFRAESTRUCTURA", "ALUMBRADO"),
    "CALZADA": ("INFRAESTRUCTURA", "CALLES"),
    "VEREDAS": ("INFRAESTRUCTURA", "VEREDAS"),
    "PLUVIALES": ("INFRAESTRUCTURA", "PLUVIALES"),
    "DENUNCIA VIAL": ("TRANSITO", "TRANSITO_ESTACIONAMIENTO"),
    "HIGIENE": ("AMBIENTE", "HIGIENE_RESIDUOS"),
    "TERRENO BALDÍO": ("AMBIENTE", "HIGIENE_RESIDUOS"),
    "APRA CONTROL AMBIENTAL": ("AMBIENTE", "CONTAMINACION"),
    "MEPHU FISCALIZACIÓN": ("COMERCIO_IRREGULAR", "ESPACIO_PUBLICO_COMERCIO"),
    "FERIAS Y MERCADOS": ("COMERCIO_IRREGULAR", "ESPACIO_PUBLICO_COMERCIO"),
}
POR_PRESTACION = {
    "Reparación de semáforo": ("INFRAESTRUCTURA", "SEMAFOROS_SENALES"),
    "Reparación de señal de tránsito": ("INFRAESTRUCTURA", "SEMAFOROS_SENALES"),
    "Remoción de vehículo abandonado": ("TRANSITO", "TRANSITO_ESTACIONAMIENTO"),
    "Irregularidades con reservas de espacios para estacionamiento de vehículos de personas con discapacidad": ("TRANSITO", "TRANSITO_ESTACIONAMIENTO"),
    "Columna/poste/cable en mal estado, abandonado o cortado": ("INFRAESTRUCTURA", "CALLES"),
    "Obstrucción de calle o vereda por elementos fijos o móviles": ("INFRAESTRUCTURA", "VEREDAS"),
    "Ocupación indebida de la vereda/calzada por local comercial": ("COMERCIO_IRREGULAR", "ESPACIO_PUBLICO_COMERCIO"),
    "Establecimiento sin autorización para funcionar sin venta o elaboración de alimentos": ("COMERCIO_IRREGULAR", "LOCAL_SIN_HABILITACION"),
}
EXCLUIR_TIPO = {"Servicio"}           # pedidos de servicio domiciliario (retiro de muebles, escombros propios), no irregularidades
EXCLUIR_TEXTO = ("(INACTIVA)", "ocupado Ilegítimamente")

prest = []
with open(SUACI, encoding="utf-8") as f:
    for r in csv.DictReader(f):
        p, cat, tipo = r["prestacion"], r["categoria"], r["tipo"]
        if tipo in EXCLUIR_TIPO or any(x in p for x in EXCLUIR_TEXTO):
            continue
        dest = POR_PRESTACION.get(p) or POR_CATEGORIA.get(cat)
        if not dest:
            continue
        prest.append({"categoria_reportalo": dest[0], "grupo_destino": dest[1], "prestacion_oficial": p,
                      "categoria_suaci": cat, "tipo_suaci": tipo, "contactos_caba_2023": r["contactos_2023"]})
# Vulnerabilidad social no tiene prestación en el SUACI (CABA la atiende por la Línea 108): una prestación propia.
prest.append({"categoria_reportalo": "VULNERABILIDAD_SOCIAL", "grupo_destino": "SITUACION_DE_CALLE",
              "prestacion_oficial": "Persona o familia en situación de calle", "categoria_suaci": "",
              "tipo_suaci": "", "contactos_caba_2023": ""})
prest.append({"categoria_reportalo": "VULNERABILIDAD_SOCIAL", "grupo_destino": "NINEZ",
              "prestacion_oficial": "Niñas, niños o adolescentes en situación de calle o riesgo", "categoria_suaci": "",
              "tipo_suaci": "", "contactos_caba_2023": ""})
prest.sort(key=lambda x: (x["categoria_reportalo"], x["grupo_destino"], -int(x["contactos_caba_2023"] or 0)))
nombres = {x["prestacion_oficial"] for x in prest}

# --- 2. Vocabulario ---
voc = [(x["prestacion_oficial"], x["prestacion_oficial"], "suaci", "Taxonomía SUACI 2023") for x in prest if x["categoria_suaci"]]
# Términos que usan las normas del corpus (origen: norma)
NORMA = [
    ("alumbrado público", "Reparación de luminaria apagada durante la noche", "Ley 6684 art. 26 inc. 8"),
    ("calzada", "Reparación de bache en calle", "Ley 24.449 art. 48 inc. t)"),
    ("mantenimiento urbano de las vías secundarias", "Reparación de bache en calle", "Ley 1777 art. 10 inc. a)"),
    ("vía pública", "Reparación de bache en calle", "LOM art. 27 inc. 2"),
    ("red pluvial", "Destape de sumidero/alcantarilla o boca de registro pluvial", "Ley 6684 art. 26 inc. 15"),
    ("desagües pluviales", "Destape de sumidero/alcantarilla o boca de registro pluvial", "LOM art. 52"),
    ("higiene urbana", "Recolección de residuos fuera del contenedor", "Ley 6684 art. 26 inc. 16"),
    ("basura a cielo abierto", "Recolección de residuos fuera del contenedor", "Ley 1854 art. 36"),
    ("basurales a cielo abierto", "Recolección de residuos fuera del contenedor", "Ley 13.592 art. 9"),
    ("vehículo abandonado", "Remoción de vehículo abandonado", "Ley 451 art. 1.3.31"),
    ("estacionar sobre la senda para peatones o aceras", "Vehículo mal estacionado", "Ley 24.449 art. 49 inc. b) ap. 3"),
    ("doble fila", "Vehículo mal estacionado", "Ley 2148 art. 7.1.8 inc. a)"),
    ("rampas para personas con discapacidad", "Vehículo mal estacionado", "Ley 2148 art. 7.1.9 inc. h)"),
    ("venta en el espacio público sin permiso de uso", "Ocupación indebida por mantero o vendedor ambulante", "Ley 1166 Secc. 11.1.2"),
    ("ocupación de la acera con puestos", "Ocupación indebida por mantero o vendedor ambulante", "Ordenanza Fiscal 31321 art. 231"),
    ("actividades económicas sin autorización", "Establecimiento sin autorización para funcionar sin venta o elaboración de alimentos", "Ley 6101 art. 8"),
    ("deterioro de la vereda por raíces de árboles", "Reparación de vereda por raíces de árbol que producen roturas", "Ley 5902 art. 7"),
    ("situación de calle", "Persona o familia en situación de calle", "Ley 3706"),
]
voc += [(t, p, "norma", f) for t, p, f in NORMA]
# Frases reales de los reportes de prueba del Sprint 15 (origen: pruebas_s15)
PRUEBAS = [
    ("bache profundo en la calzada", "Reparación de bache en calle"),
    ("la vereda está toda rota y levantada", "Reparación de vereda"),
    ("vereda rota y levantada por las raíces de un árbol", "Reparación de vereda por raíces de árbol que producen roturas"),
    ("no anda la luminaria de la calle", "Reparación de luminaria apagada durante la noche"),
    ("queda todo oscuro de noche", "Reparación de luminaria apagada durante la noche"),
    ("el semáforo está fuera de servicio", "Reparación de semáforo"),
    ("boca de tormenta rota, el agua no drena", "Reparación de sumidero/alcantarilla o boca de registro pluvial rota"),
    ("auto mal estacionado", "Vehículo mal estacionado"),
    ("auto arriba de la rampa", "Vehículo mal estacionado"),
    ("camioneta arriba de la senda peatonal", "Vehículo mal estacionado"),
    ("autos en doble fila", "Vehículo mal estacionado"),
    ("camión tapando la salida del garage", "Vehículo obstruyendo garaje"),
    ("auto tirado en la calle, destrozado y sin patente", "Remoción de vehículo abandonado"),
    ("el contenedor de la esquina está desbordado", "Vaciado de contenedor"),
    ("microbasural en el terreno baldío", "Higienización, desratización, saneamiento de terreno baldío o casa abandonada"),
    ("basura acumulada en la esquina", "Recolección de residuos fuera del contenedor"),
    ("están quemando residuos a cielo abierto", "Malos Olores / Humos / Gases Tóxicos"),
    ("venta ambulante sin habilitación ocupando la vereda", "Ocupación indebida por mantero o vendedor ambulante"),
    ("venden en la calle", "Ocupación indebida por mantero o vendedor ambulante"),
    ("mercadería sobre la vereda que obstruye el paso", "Ocupación indebida de la vereda/calzada por local comercial"),
    ("familia durmiendo en la vereda", "Persona o familia en situación de calle"),
    ("refugio improvisado bajo la autopista", "Persona o familia en situación de calle"),
]
voc += [(t, p, "pruebas_s15", "Textos de las pruebas de staging del Sprint 15") for t, p in PRUEBAS]
# Equivalentes coloquiales: aprobados por el PO el 14/10/2026 (sin improperios; uso común, no atestiguados en fuente documental)
PROPUESTA = [
    ("pozo", "Reparación de bache en calle"), ("cráter", "Reparación de bache en calle"),
    ("boquete", "Reparación de bache en calle"), ("calle rota", "Reparación de bache en calle"),
    ("calle hundida", "Nivelación por hundimiento del pavimento"),
    ("baldosas levantadas", "Reparación de vereda"), ("vereda hundida", "Reparación de vereda"),
    ("farol", "Reparación de luminaria apagada durante la noche"), ("poste de luz", "Reparación de luminaria apagada durante la noche"),
    ("luz quemada", "Reparación de luminaria apagada durante la noche"), ("está todo a oscuras", "Reparación de luminaria apagada durante la noche"),
    ("luz que titila", "Luminaria intermitente"),
    ("alcantarilla tapada", "Destape de sumidero/alcantarilla o boca de registro pluvial"), ("se inunda la calle", "Intervención por calle anegada/inundada"),
    ("semáforo apagado", "Reparación de semáforo"), ("semáforo roto", "Reparación de semáforo"),
    ("auto en la vereda", "Vehículo mal estacionado"), ("auto en la rampa", "Vehículo mal estacionado"),
    ("me taparon el garage", "Vehículo obstruyendo garaje"), ("chatarra", "Remoción de vehículo abandonado"),
    ("basural", "Recolección de residuos fuera del contenedor"), ("mugre", "Mejora de barrido"),
    ("contenedor lleno", "Vaciado de contenedor"), ("olor a podrido", "Malos Olores / Humos / Gases Tóxicos"),
    ("humo de una fábrica", "Malos Olores / Humos / Gases Tóxicos"),
    ("mantero", "Ocupación indebida por mantero o vendedor ambulante"), ("puestito en la vereda", "Ocupación indebida por mantero o vendedor ambulante"),
    ("mesas en la vereda", "Ocupación indebida de la vereda/calzada por área gastronómica"),
    ("local trucho", "Establecimiento sin autorización para funcionar sin venta o elaboración de alimentos"),
    ("gente durmiendo en la calle", "Persona o familia en situación de calle"),
    ("chicos en la calle", "Niñas, niños o adolescentes en situación de calle o riesgo"),
]
voc += [(t, p, "po", "Aprobado por el PO el 14/10/2026") for t, p in PROPUESTA]
faltan = sorted({p for _, p, _, _ in voc if p not in nombres})
assert not faltan, faltan

# --- 3. Destino por jurisdicción y grupo (de la matriz REP-2806 v1.2) ---
BA_COLAB = "https://bacolaborativa.buenosaires.gob.ar/"
CAV = [("web", "http://reclamosweb.mda.gob.ar/", True), ("telefono", "0800-122-6323", False)]
SOSP = ("email", "sospavellaneda@gmail.com", False)
D = [
    # jurisdiccion, grupo, organismo, organismo_padre, tipo, canales[(canal, valor, principal)], fuente
    ("CABA", "ALUMBRADO", "Ministerio de Espacio Público e Higiene Urbana", "", "generico",
     [("web", BA_COLAB + " › Alumbrado", True), ("telefono", "147 (informativo)", False)], "https://bacolaborativa.buenosaires.gob.ar/"),
    ("CABA", "CALLES", "Comuna (vía secundaria) / Ministerio de Espacio Público e Higiene Urbana (avenida)", "", "generico",
     [("web", BA_COLAB + " › Calles", True), ("telefono", "147 (informativo)", False)], "https://bacolaborativa.buenosaires.gob.ar/"),
    ("CABA", "VEREDAS", "Comuna (vía secundaria) / Ministerio de Espacio Público e Higiene Urbana (avenida)", "", "generico",
     [("web", BA_COLAB + " › Veredas", True), ("telefono", "147 (informativo)", False)], "https://bacolaborativa.buenosaires.gob.ar/"),
    ("CABA", "PLUVIALES", "Ministerio de Espacio Público e Higiene Urbana", "", "generico",
     [("web", BA_COLAB + " › Pluviales", True), ("telefono", "103 (urgencia 24 h)", False)], "https://buenosaires.gob.ar/inicio/telefonos"),
    ("CABA", "SEMAFOROS_SENALES", "Secretaría de Tránsito", "", "generico",
     [("web", BA_COLAB + " › Tránsito y Transporte", True)], "https://buenosaires.gob.ar/perfil_institucional/secretaria-de-transito"),
    ("CABA", "TRANSITO_ESTACIONAMIENTO", "Dirección General del Cuerpo de Agentes de Tránsito", "Secretaría de Tránsito", "generico",
     [("web", BA_COLAB + " › Denuncia vial", True)], "https://buenosaires.gob.ar/perfil_institucional/secretaria-de-transito"),
    ("CABA", "HIGIENE_RESIDUOS", "Ministerio de Espacio Público e Higiene Urbana", "", "generico",
     [("web", BA_COLAB + " › Limpieza y Reciclado", True)], "https://bacolaborativa.buenosaires.gob.ar/"),
    ("CABA", "CONTAMINACION", "Agencia de Protección Ambiental (APRA)", "Vicejefatura de Gobierno", "generico",
     [("web", BA_COLAB + " › Protección Ambiental", True), ("telefono", "103 (derrames, 24 h)", False)],
     "https://buenosaires.gob.ar/gcaba_historico/vicejefatura/ambiente/agenciaambiental"),
    ("CABA", "ESPACIO_PUBLICO_COMERCIO", "Ministerio de Espacio Público e Higiene Urbana", "", "generico",
     [("web", BA_COLAB + " › Ordenamiento del Espacio Público", True),
      ("tramite", "https://buenosaires.gob.ar/tramites/denuncia-de-irregularidades-en-la-publica (TAD, miBA)", False)],
     "https://buenosaires.gob.ar/tramites/denuncia-de-irregularidades-en-la-publica"),
    ("CABA", "LOCAL_SIN_HABILITACION", "Agencia Gubernamental de Control (AGC)", "", "generico",
     [("web", BA_COLAB + " › Fiscalización Actividades Comerciales", True), ("telefono", "147", False)],
     "https://buenosaires.gob.ar/gcaba_historico/justicia/agencia-gubernamental-de-control/denuncias"),
    ("CABA", "SITUACION_DE_CALLE", "Ministerio de Desarrollo Humano y Hábitat", "", "dedicado",
     [("telefono", "108 opción 1 (24 h)", True)], "https://buenosaires.gob.ar/gcaba_historico/desarrollohumanoyhabitat/emergencia-social"),
    ("CABA", "NINEZ", "Línea 102 — Niñez y Adolescencia (GCBA)", "", "dedicado",
     [("telefono", "102 (24 h)", True)], "https://buenosaires.gob.ar/inicio/telefonos"),
    ("AVELLANEDA", "ALUMBRADO", "Dirección de Alumbrado, Sistemas Eléctricos y Vía Pública", "Subsecretaría de Obras Públicas", "dedicado",
     CAV + [("telefono", "4207-9802 (consultas al área)", False), SOSP], "https://tramitesweb.mda.gob.ar/index.php/pasos/3786"),
    ("AVELLANEDA", "SEMAFOROS_SENALES", "Dirección de Alumbrado, Sistemas Eléctricos y Vía Pública", "Subsecretaría de Obras Públicas", "dedicado",
     CAV + [("telefono", "4207-9802 (consultas al área)", False), SOSP], "https://tramitesweb.mda.gob.ar/index.php/pasos/3786"),
    ("AVELLANEDA", "CALLES", "Subsecretaría de Obras Públicas", "Secretaría de Obras y Servicios Públicos", "generico",
     CAV + [SOSP], "https://www.mda.gob.ar/gobierno/secretaria-de-obras-y-servicios-publicos/subsecretaria-de-obras-publicas/"),
    ("AVELLANEDA", "VEREDAS", "Subsecretaría de Obras Públicas", "Secretaría de Obras y Servicios Públicos", "generico",
     CAV + [SOSP], "https://www.mda.gob.ar/gobierno/secretaria-de-obras-y-servicios-publicos/subsecretaria-de-obras-publicas/"),
    ("AVELLANEDA", "PLUVIALES", "Subsecretaría de Obras Públicas", "Secretaría de Obras y Servicios Públicos", "generico",
     CAV + [SOSP, ("telefono", "103 / 0800-333-3218 (Defensa Civil, 24 h)", False)], "https://www.mda.gob.ar/servicios/telefonos-utiles/"),
    ("AVELLANEDA", "TRANSITO_ESTACIONAMIENTO", "Municipalidad de Avellaneda (autoridad de aplicación, Ley 13.927)", "", "generico",
     CAV, "https://tramitesweb.mda.gob.ar/index.php/pasos/3516"),
    ("AVELLANEDA", "HIGIENE_RESIDUOS", "Subsecretaría de Gestión de Residuos", "Secretaría de Obras y Servicios Públicos", "generico",
     CAV + [SOSP], "https://www.mda.gob.ar/gobierno/secretaria-de-obras-y-servicios-publicos/subsecretaria-de-gestion-de-residuos/"),
    ("AVELLANEDA", "CONTAMINACION", "Subsecretaría de Ambiente", "Secretaría de Producción, Comercio y Ambiente", "dedicado",
     [("email", "ambiente.mda@gmail.com", True), ("telefono", "5227-7770 / 5227-7781", False)] + CAV[:1],
     "https://www.mda.gob.ar/gobierno/secretaria-de-produccion-comercio-y-ambiente/subsecretaria-de-ambiente/"),
    ("AVELLANEDA", "ESPACIO_PUBLICO_COMERCIO", "Subdirección de Inspección y Ferias", "Subsecretaría de Habilitaciones", "dedicado",
     [("email", "inspeccionavellaneda15@gmail.com", True), ("email", "feriasavellaneda@gmail.com", False),
      ("telefono", "6089-8331 / 6089-8332 / 6089-8387", False)] + CAV[:1],
     "https://www.mda.gob.ar/gobierno/secretaria-de-produccion-comercio-y-ambiente/subsecretaria-de-habilitaciones/"),
    ("AVELLANEDA", "LOCAL_SIN_HABILITACION", "Dirección de Habilitaciones", "Subsecretaría de Habilitaciones", "dedicado",
     [("email", "direccionhabilitacionesmda@gmail.com", True), ("whatsapp", "11 3891-7358", False),
      ("email", "habilitacionesindustriales@gmail.com (industrias)", False)] + CAV[:1],
     "https://www.mda.gob.ar/gobierno/secretaria-de-produccion-comercio-y-ambiente/subsecretaria-de-habilitaciones/"),
    ("AVELLANEDA", "SITUACION_DE_CALLE", "Secretaría de Desarrollo Social", "", "dedicado",
     [("email", "desarrollosocial@mda.gob.ar", True), ("telefono", "6089-8315", False), ("telefono", "0800-122-6323 (CAV, fuera de horario)", False)],
     "https://www.mda.gob.ar/gobierno/observatorio-social-de-politicas-publicas/secretaria-de-desarrollo-social/"),
    ("AVELLANEDA", "NINEZ", "Consejo de Niñez, Adolescencia y Familia", "Secretaría de Desarrollo Social", "dedicado",
     [("telefono", "115 426-1618 (guardia 24 h)", True), ("telefono", "4201-5053 / 4201-1303 / 4201-4822", False),
      ("email", "ninezadolescenciayflia@mda.gob.ar", False)],
     "https://www.mda.gob.ar/gobierno/observatorio-social-de-politicas-publicas/consejo-de-ninez-adolescencia-y-familia/"),
]
grupos = {x["grupo_destino"] for x in prest}
assert {(j, g) for j in ("CABA", "AVELLANEDA") for g in grupos} == {(d[0], d[1]) for d in D}, "falta una combinación jurisdicción × grupo"

# --- 4. Vínculos grupo -> normas (competencia y conducta), tal como figuran en el corpus ---
V = [
    ("CABA", "ALUMBRADO", "competencia", "Ley 6684 art. 26 inc. 8"),
    ("CABA", "CALLES", "competencia", "Ley 1777 art. 10 inc. a)"), ("CABA", "CALLES", "competencia", "Ley 6684 art. 26 inc. 1"),
    ("CABA", "CALLES", "obligacion", "Ley 5901 (aperturas y roturas)"),
    ("CABA", "VEREDAS", "competencia", "Ley 1777 art. 10 inc. a)"), ("CABA", "VEREDAS", "obligacion", "Ley 5902 art. 5"),
    ("CABA", "VEREDAS", "obligacion", "Ley 5902 art. 7"), ("CABA", "VEREDAS", "competencia", "Ley 5902 art. 8"),
    ("CABA", "PLUVIALES", "competencia", "Ley 6684 art. 26 inc. 15"),
    ("CABA", "SEMAFOROS_SENALES", "competencia", "Ley 2148 art. 4"),
    ("CABA", "TRANSITO_ESTACIONAMIENTO", "competencia", "Ley 2148 art. 4"),
    ("CABA", "TRANSITO_ESTACIONAMIENTO", "competencia", "Ley 5688 arts. 506 y 511 incs. 1 y 2, texto consolidado (sumar al corpus)"),
    ("CABA", "TRANSITO_ESTACIONAMIENTO", "conducta", "Ley 2148 art. 7.1.8"), ("CABA", "TRANSITO_ESTACIONAMIENTO", "conducta", "Ley 2148 art. 7.1.9"),
    ("CABA", "TRANSITO_ESTACIONAMIENTO", "conducta", "Ley 451 art. 6.1.52"), ("CABA", "TRANSITO_ESTACIONAMIENTO", "conducta", "Ley 451 art. 6.1.37"),
    ("CABA", "TRANSITO_ESTACIONAMIENTO", "conducta", "Ley 451 art. 6.1.54"), ("CABA", "TRANSITO_ESTACIONAMIENTO", "conducta", "Ley 451 art. 1.3.31"),
    ("CABA", "HIGIENE_RESIDUOS", "competencia", "Ley 6684 art. 26 inc. 16"), ("CABA", "HIGIENE_RESIDUOS", "conducta", "Ley 1854 art. 36"),
    ("CABA", "HIGIENE_RESIDUOS", "conducta", "Ley 451 art. 1.3.13"),
    ("CABA", "CONTAMINACION", "competencia", "Ley 2628 art. 3 (sumar al corpus)"),
    ("CABA", "ESPACIO_PUBLICO_COMERCIO", "competencia", "Ley 6684 art. 26 inc. 13"), ("CABA", "ESPACIO_PUBLICO_COMERCIO", "competencia", "Ley 6684 art. 26 inc. 14"),
    ("CABA", "ESPACIO_PUBLICO_COMERCIO", "conducta", "Ley 1166 Secc. 11.1.2"), ("CABA", "ESPACIO_PUBLICO_COMERCIO", "conducta", "Ley 451 art. 4.1.2"),
    ("CABA", "LOCAL_SIN_HABILITACION", "competencia", "Ley 6101 art. 6"), ("CABA", "LOCAL_SIN_HABILITACION", "obligacion", "Ley 6101 art. 8"),
    ("CABA", "LOCAL_SIN_HABILITACION", "conducta", "Ley 451 art. 4.1.1"),
    ("CABA", "SITUACION_DE_CALLE", "obligacion", "Ley 3706 arts. 6 y 7"), ("CABA", "SITUACION_DE_CALLE", "obligacion", "Ley 4036 art. 37"),
    ("CABA", "NINEZ", "obligacion", "Ley 3706 arts. 6 y 7"),
    ("AVELLANEDA", "ALUMBRADO", "competencia", "LOM (DL 6769/58) art. 52"), ("AVELLANEDA", "ALUMBRADO", "competencia", "Ordenanza Fiscal 31321 art. 132"),
    ("AVELLANEDA", "SEMAFOROS_SENALES", "competencia", "LOM (DL 6769/58) art. 27 inc. 2"), ("AVELLANEDA", "SEMAFOROS_SENALES", "competencia", "Ley 13.927 art. 2"),
    ("AVELLANEDA", "CALLES", "competencia", "Constitución PBA art. 192 inc. 4"), ("AVELLANEDA", "CALLES", "competencia", "LOM (DL 6769/58) art. 27 inc. 2"),
    ("AVELLANEDA", "CALLES", "competencia", "LOM (DL 6769/58) art. 59"),
    ("AVELLANEDA", "VEREDAS", "competencia", "LOM (DL 6769/58) art. 59"),
    ("AVELLANEDA", "PLUVIALES", "competencia", "LOM (DL 6769/58) art. 52"), ("AVELLANEDA", "PLUVIALES", "competencia", "LOM (DL 6769/58) art. 59"),
    ("AVELLANEDA", "TRANSITO_ESTACIONAMIENTO", "competencia", "Ley 13.927 art. 2"),
    ("AVELLANEDA", "TRANSITO_ESTACIONAMIENTO", "conducta", "Ley 24.449 art. 48"), ("AVELLANEDA", "TRANSITO_ESTACIONAMIENTO", "conducta", "Ley 24.449 art. 49"),
    ("AVELLANEDA", "HIGIENE_RESIDUOS", "obligacion", "Ley 13.592 art. 9"), ("AVELLANEDA", "HIGIENE_RESIDUOS", "conducta", "DL 8751/77 art. 4 bis"),
    ("AVELLANEDA", "CONTAMINACION", "obligacion", "Ley 11.723"), ("AVELLANEDA", "CONTAMINACION", "conducta", "DL 8751/77 art. 4 bis"),
    ("AVELLANEDA", "ESPACIO_PUBLICO_COMERCIO", "obligacion", "Ordenanza Fiscal 31321 art. 233"),
    # Art. 231 define hechos imponibles (obligación tributaria), no una conducta prohibida: lo dice el propio art. 233
    # («requisito previo a la realización del hecho imponible»). Decisión del PO del 19/10/2026 (REP-3836).
    ("AVELLANEDA", "ESPACIO_PUBLICO_COMERCIO", "obligacion", "Ordenanza Fiscal 31321 art. 231"),
    ("AVELLANEDA", "ESPACIO_PUBLICO_COMERCIO", "sancion", "Ordenanza Fiscal 31321 art. 235"),
    ("AVELLANEDA", "ESPACIO_PUBLICO_COMERCIO", "competencia", "LOM (DL 6769/58) art. 27 incs. 1 y 6"),
    ("AVELLANEDA", "LOCAL_SIN_HABILITACION", "competencia", "LOM (DL 6769/58) art. 27 incs. 1 y 6"),
    ("AVELLANEDA", "LOCAL_SIN_HABILITACION", "conducta", "DL 8751/77 art. 4 bis"),
    ("AVELLANEDA", "SITUACION_DE_CALLE", "obligacion", "Ley 15.625 (PBA)"), ("AVELLANEDA", "SITUACION_DE_CALLE", "obligacion", "Ley 27.654"),
    ("AVELLANEDA", "NINEZ", "obligacion", "Ley 15.625 (PBA)"),
]
assert {(j, g) for j in ("CABA", "AVELLANEDA") for g in grupos} == {(v[0], v[1]) for v in V}, "grupo sin norma"


def escribir(nombre, cab, filas):
    with open(os.path.join(OUT, nombre), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(cab)
        w.writerows(filas)
    print(nombre, len(filas))


escribir("prestaciones.csv", list(prest[0].keys()), [list(x.values()) for x in prest])
escribir("vocabulario.csv", ["termino", "prestacion_oficial", "origen", "fuente", "aprobado"],
         [[t, p, o, f, "si"] for t, p, o, f in voc])
escribir("destino.csv", ["jurisdiccion", "grupo_destino", "organismo", "organismo_padre", "tipo", "canal", "valor", "principal", "fuente_url", "verificado"],
         [[j, g, o, pa, ti, c, v, "si" if pr else "no", fu, "2026-10-14"] for j, g, o, pa, ti, cs, fu in D for c, v, pr in cs])
escribir("vinculos_norma.csv", ["jurisdiccion", "grupo_destino", "tipo_fundamento", "norma"], V)
