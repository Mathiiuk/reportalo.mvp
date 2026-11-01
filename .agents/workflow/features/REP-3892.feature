# language: es
# REP-3892 · O-01/O-02/O-03 de la QA REP-3875

Característica: Borrador institucional solo para reportes elegibles y acuse honesto
  Como usuario que reporta
  Quiero que Reportalo no prepare un borrador para un organismo cuando mi reporte no corresponde
  Para que nadie reciba un reclamo equivocado ni yo crea que ya se envió

  Escenario: C-09 · el autor pide un borrador con una prestación de otra categoría
    Dado un reporte de Tránsito cuyo último análisis es "fuera_de_alcance"
    Cuando su autor llama a prepare_organism_delivery con "bache_calle"
    Entonces el estado es "excluido_fuera_de_alcance"
    Y no se guarda ninguna entrega ni cambia la categoría del reporte

  Escenario: prestación ajena con un análisis válido
    Dado un reporte de Tránsito cuyo último análisis es "fundamentado"
    Cuando su autor llama a prepare_organism_delivery con "bache_calle"
    Entonces el estado es "prestacion_incompatible"
    Y el routing del reporte no cambia

  Escenario: asistencia nunca termina en borrador institucional
    Dado un reporte cuyo último análisis es "asistencia"
    Cuando el resultado sería "borrador_generado"
    Entonces el estado es "excluido_asistencia"

  Esquema del escenario: bache legítimo
    Dado un reporte de Infraestructura en <lugar> con análisis "fundamentado"
    Cuando se pide el borrador con "bache_calle" dos veces
    Entonces el estado es "borrador_generado"
    Y el segundo pedido devuelve la misma entrega
    Y el texto dice "Descripción del usuario"

    Ejemplos:
      | lugar      |
      | CABA       |
      | Avellaneda |

  Escenario: el acuse no promete la entrega
    Dado que acabo de enviar un reporte
    Entonces veo "Recibimos tu reporte. Lo estamos analizando para identificar el organismo que corresponde."
    Y no veo "en camino al organismo competente"

  Escenario: acuse de un reporte fuera de alcance
    Dado que el análisis de mi reporte es "fuera_de_alcance"
    Entonces no veo ningún organismo ni canal
