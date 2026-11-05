Hernán, te aviso porque toqué staging: apliqué una migración para un prototipo post-MVP del observatorio (rama aparte, sin ticket).

- Solo agrega: la tabla `observatorio_plazos` (los plazos que pasaste el 03/11: 90 / 7 / 7 / 30) y funciones `obs_*` de solo totales por zona.
- No cambia ninguna tabla, función ni policy existente, ni ningún dato. La bandeja y el RAG leen lo mismo que antes.
- Las puede llamar solo un usuario con sesión; anon recibe «permission denied». No devuelven ids, coordenadas, direcciones ni textos de reportes.
- Vulnerabilidad social queda afuera y con menos de 5 casos no se muestran porcentajes ni días.
- Versión registrada: `20261105010506_obs_f0a_agregados_del_observatorio`. La reversión está al principio del archivo (7 `drop function` y 1 `drop table`).

Si preferís que lo saque de staging hasta que haya ticket, lo revierto.
