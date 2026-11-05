Hernán, ya está lo que marcaste del observatorio (en una rama nueva, todavía no en staging):

1. *Las «torres naranjas»* eran los meses que empezaron hace menos de 60 días (octubre y noviembre): sus reportes todavía no tuvieron tiempo de resolverse y por eso parecen peores. Si ni vos ni yo lo entendimos, estaba mal hecho. Saqué el rayado: ahora debajo del mes dice «en curso» y la línea va punteada en ese tramo.
2. *Comparar solo el mismo nivel*: barrio con barrio, comuna o partido con comuna o partido, provincia con provincia. Antes de elegir la primera zona se elige qué comparar, y después solo se ofrecen zonas de ese nivel.
3. *Mi barrio como el mockup*: frase arriba («En Piñeyro, …»), línea de reportes por mes, barras por categoría en vez de la torta y «Mi zona vs. mi jurisdicción». Dos diferencias con el mockup:
   - Las barras son por categoría, no por prestación: hoy el reporte no guarda la prestación (bache, luminaria…).
   - Saqué la segunda parte de la frase («Cada reporte cuenta: así llega al organismo…») porque hoy no es cierta: la entrega a organismos sigue en prueba. Mismo criterio que REP-3917.
4. *El tablero del gobierno* lo armo como tu mockup (atraso por antigüedad, embudo, primera respuesta, cumplimiento con meta 80 %). Va en el panel del organismo y necesita una migración nueva; te aviso antes de aplicarla.

*Una decisión tuya: el radar de Comparar («Perfil de respuesta»).*
- Caso: el radar pone a cada zona en un percentil entre todas las zonas del mismo nivel. Con los datos de hoy, de los 12 barrios con 5 reportes o más: solo 3 tienen algún resuelto (Boedo 2, Almagro, Monserrat y Caballito 1 cada uno), ninguno llega a 5 resueltos para calcular días, la reincidencia no está definida y hay 23 pasos a «Derivado» en toda la base.
- Impacto: casi todos los ejes salen empatados o en 0, y en el mockup un dato que falta se dibuja como 0 (como si fuera lo peor). Además «100 = la mejor» es un ranking, y la pantalla dice «comparar no es rankear».
- Propuesta: dejar «Primero, la respuesta» (la tabla) como está, y sumar el radar cuando la mayoría de las zonas tenga 5 resueltos, con dos reglas: sin dato = eje vacío (no 0) y el universo = zonas del mismo nivel. Hasta entonces, en su lugar un aviso que diga por qué todavía no se muestra.
- ¿Te sirve así, o lo querés ya aunque salga casi vacío?
