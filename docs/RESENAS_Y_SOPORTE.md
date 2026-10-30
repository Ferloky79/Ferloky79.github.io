# Reseñas y soporte: base preparada

Proyecto: `E-commerce videojuegos` (`dzgvenphxkrfvmrmhwwp`).
La migración `20261030030050_reviews_and_support.sql` YA está aplicada en el servidor.
No vuelvas a ejecutar este SQL, las migraciones anteriores ni `seed.sql` sobre esa base.
Esta entrega prepara la base y su contrato de acceso; NO añade todavía formularios ni pantallas a la web.

## Modelo y decisiones

- `resena`: usuario, videojuego, puntuación entera 1-5, comentario de 10-2000 caracteres y fechas. Una por usuario/videojuego, editable y eliminable por su autor. ADMIN puede eliminar reseñas; no puede reescribir opiniones ajenas. No requiere compra. Si un videojuego tiene productos para distintas plataformas, comparte reseñas. La relación depende de `id_videojuego`, no de coincidencias de título.
- `ticket_soporte`: propietario, número, asunto (5-150), descripción (10-5000), categoría, estado y fechas. Pedido opcional: debe pertenecer a la misma cuenta; no permite reclamar pedidos de invitados simplemente por correo. Categorías: CUENTA, COMPRA, CLAVE, REEMBOLSO, OTRO. Estados: ABIERTO, EN_PROCESO, RESUELTO, CERRADO.
- `mensaje_ticket`: conversación de un ticket, autor, texto (1-5000) y fecha. Los mensajes no se editan ni eliminan desde la API. Propietario y ADMIN pueden responder mientras esté ABIERTO o EN_PROCESO. Solo ADMIN cambia el estado, incluyendo reabrirlo.
- Toda escritura requiere cuenta activa. Los visitantes leen reseñas mediante RPC; nunca reciben UUID del autor ni correo. El nombre visible del perfil es público al publicar una reseña: explicarlo en el formulario.
- Los tickets/mensajes son privados del propietario y ADMIN. Sin adjuntos, envío de correos, respuestas automáticas, pagos ni reembolsos reales. Un ticket de reembolso es una consulta, no ejecuta un reembolso.
- `valoracion_referencia` se conserva como valoración editorial. Mostrar el promedio de usuarios por separado; sin reseñas, `promedio` es NULL y debe presentarse como "Sin reseñas", no 0 estrellas.

## Incorporar los archivos en VS Code

La rama remota `codex/reviews-support-db` contiene únicamente la migración, pruebas y esta guía, partiendo de `main`. No reemplaza los cambios locales de `diseno-tienda`.

Con tus cambios revisados y guardados en un commit, y permaneciendo en `diseno-tienda`:

```bash
git fetch origin
git merge origin/codex/reviews-support-db
```

Si aparecen conflictos, resolverlos conservando la navegación y diseño locales. No uses reset ni descartes archivos para resolverlos. No hay nuevas dependencias: no necesitas reinstalar Node, Playwright o Supabase. URL y clave publicable siguen iguales. No hace falta ejecutar migraciones desde tu equipo: la base remota ya está actualizada. En futuras migraciones, comprobar primero el historial del servidor.

## Contrato de integración

Añadir las operaciones a `supabase-api.js`, usando su instancia `db` y `unwrap`. No crear otro cliente ni poner credenciales privadas en el navegador. Los siguientes fragmentos son ejemplos para integrar, no funciones que ya existan en el adaptador.

El ID de la ruta `#producto/ID` es de producto. Para obtener el de videojuego:

```js
const producto = unwrap(await db.from('producto')
  .select('id_videojuego').eq('id_producto', idProducto).single());
const idJuego = producto.id_videojuego;
```

### Leer reseñas y resumen (también sin sesión)

```js
unwrap(await db.rpc('listar_resenas', {
  p_id_videojuego: idJuego, p_limite: 20, p_offset: 0
}));
// [{id_resena,puntuacion,comentario,autor,creado_en,actualizado_en,es_propia}]

unwrap(await db.rpc('resumen_resenas', { p_id_videojuego: idJuego }));
// [{total: 0, promedio: null}]
```

La paginación admite como máximo 50 reseñas por petición. La lista y el promedio excluyen cuentas desactivadas y juegos sin producto publicado en categoría activa. Renderizar nombres y comentarios como texto (`textContent` o escape HTML), nunca como HTML de usuario.

### Crear, editar y eliminar la reseña propia

```js
// Con sesión activa. No mandar id_usuario, IDs generados ni fechas.
unwrap(await db.from('resena').insert({
  id_videojuego: idJuego, puntuacion: 5, comentario: 'Mi opinión sobre este videojuego.'
}).select().single());

// Obtener la reseña propia; RLS impide leer reseñas crudas ajenas salvo ADMIN.
// ADMIN debe filtrar explícitamente por su sesión para identificar SU reseña.
unwrap(await db.from('resena').select('*')
  .eq('id_videojuego', idJuego).eq('id_usuario', usuario.id).maybeSingle());

unwrap(await db.from('resena').update({puntuacion: 4, comentario: 'Mi opinión actualizada.'})
  .eq('id_resena', idResena).select().single());

unwrap(await db.from('resena').delete().eq('id_resena', idResena)
  .select('id_resena').single());
```

Usar insert y update separados: el rol cliente no puede escribir columnas de identidad. Traducir errores de duplicado, validación, sesión y permisos a mensajes comprensibles. Refrescar lista y promedio tras cada operación. Deshabilitar envío mientras esté pendiente.

### Crear/listar tickets y responder

```js
unwrap(await db.from('ticket_soporte').insert({
  asunto: 'Problema al canjear mi clave',
  descripcion: 'Descripción del problema simulado con la clave.',
  categoria: 'CLAVE', id_pedido: idPedidoONull
}).select().single());

unwrap(await db.from('ticket_soporte').select('*')
  .order('creado_en', {ascending: false}).range(0,19));

unwrap(await db.from('ticket_soporte').select('*')
  .eq('id_ticket', idTicket).single());

unwrap(await db.from('mensaje_ticket').select('*')
  .eq('id_ticket', idTicket).order('creado_en').order('id_mensaje').range(0,49));

unwrap(await db.from('mensaje_ticket').insert({id_ticket: idTicket, mensaje: texto})
  .select().single());

// Solo ADMIN; el cliente no puede cambiar estados aunque manipule el navegador.
unwrap(await db.from('ticket_soporte').update({estado: 'EN_PROCESO'})
  .eq('id_ticket', idTicket).select().single());
```

RLS filtra automáticamente los tickets del cliente; ADMIN ve todos. Para una sección "Mis tickets" del administrador, filtrar por `id_usuario=usuario.id`. No consultar todos los perfiles para resolver autores: la tabla `usuario` sigue protegida. En mensajes basta diferenciar `id_usuario === ticket.id_usuario` (cliente) frente a la respuesta del administrador, sin publicar UUID en pantalla. Ordenar/paginar y permitir cargar mensajes adicionales.

## Cuenta ADMIN: pendiente de confirmar

La comprobación en esta entrega encontró una cuenta CLIENTE y ninguna ADMIN. No se modificaron roles reales. Usar la operación administrativa documentada en `docs/IMPLEMENTACION.md`, sustituyendo TU correo confirmado y verificando exactamente una fila actualizada. Crear un usuario en Auth no equivale a asignarle el rol ADMIN en `public.usuario`.

## Pruebas ejecutadas

`database/verify_reviews_support.sql` se ejecutó en la base con transacción y ROLLBACK. Comprueba: creación/edición/eliminación propias, duplicado y puntuación inválida, suplantación de propietario, aislamiento entre dos clientes, lectura pública sin UUID, prohibición de escrituras anónimas, respuestas y estados ADMIN, rechazo de mensajes a tickets resueltos y de vincular pedido ajeno. Crea cuentas ficticias solo dentro de la transacción; no deja cuentas, reseñas ni tickets de prueba.

Las tres tablas tienen RLS y privilegios explícitos. El asesor de seguridad no señaló problemas nuevos de tablas/funciones. Conserva un aviso de configuración de Auth: protección contra contraseñas filtradas desactivada; no se modificó esa configuración.

El catálogo y la compra no se modificaron. Faltan pruebas E2E de las nuevas pantallas cuando se implementen.

## Siguiente tarea para Codex en VS Code

Lee AGENTS.md y docs/RESENAS_Y_SOPORTE.md. La base ya está migrada: no ejecutes SQL de creación ni cargas iniciales. Implementa en supabase-api.js las operaciones descritas y añade reseñas al detalle del juego, con promedio separado de la valoración editorial. Crea vistas completas #soporte y #ticket/ID para abrir tickets, consultar su conversación y responder. Añade acceso desde el perfil y navegación principal. Para ADMIN, permite consultar tickets, responder y cambiar estados. Conserva la navegación hash, diseño adaptable, foco accesible y compra simulada. Añade estados de carga, vacío, error, sesión requerida y confirmación. Renderiza contenido de usuario como texto seguro. Prueba navegación, recarga, permisos y formularios; las pruebas E2E deben simular la API y no escribir en la base real.
