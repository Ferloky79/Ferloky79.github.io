# GameVault con Supabase

La base ya está aplicada en el proyecto `E-commerce videojuegos` (`dzgvenphxkrfvmrmhwwp`). No vuelvas a ejecutar `schema.sql` sobre ese proyecto: crea las tablas desde cero y fallará si ya existen.

## Abrir desde VS Code

1. Clona `https://github.com/Ferloky79/Ferloky79.github.io.git` y abre la rama `codex/supabase-integration`.
2. Usa Live Server en VS Code o `python -m http.server 5500` en la carpeta del proyecto.
3. Abre `http://localhost:5500`. Necesitas internet para consultar Supabase. GitHub Pages también sirve estos archivos sin un servidor Node.
4. Antes de trabajar con Codex ejecuta `git pull`. Después revisa el diff, prueba y guarda un commit. Usa una rama por cambio para evitar sobrescribir archivos modificados en dos lugares.

El SDK oficial `@supabase/supabase-js` 2.99.1 se distribuye localmente en `vendor/`; no necesitas instalarlo para abrir la tienda. Las dependencias de `package.json` son exclusivamente para pruebas.

## Completar la configuración de las cuentas

En Supabase → Authentication → URL Configuration:

- Site URL: `https://ferloky79.github.io`
- Redirect URLs: `https://ferloky79.github.io/**` y `http://localhost:5500/**` (agrega el puerto real de Live Server si usas otro).

Conserva la confirmación de correo. Regístrate con un correo que controles, confirma el mensaje e inicia sesión. El cliente también admite que un proyecto educativo tenga la confirmación deshabilitada; en ese caso se inicia la sesión después del registro. Los límites de correo del servicio integrado pueden restringir las pruebas repetidas. La configuración de redirecciones y la creación de una cuenta real deben completarse con tu correo, no se ha creado una cuenta administrativa con credenciales inventadas.

Para asignar el único ADMIN, después de registrar y confirmar TU cuenta, ejecuta en SQL Editor, sustituyendo el correo:

```sql
update public.usuario u
set id_rol = (select id_rol from public.rol where nombre = 'ADMIN')
from auth.users a
where a.id = u.id_usuario
  and lower(a.email) = lower('TU_CORREO_CONFIRMADO');
```

Verifica que se actualizó exactamente una fila. Ningún registro web puede elegir ADMIN. El índice `un_administrador` impide dos cuentas con ese rol. La contraseña de PostgreSQL no es la contraseña de una cuenta de la tienda. Para administrar inicialmente no necesitas panel web: usa Table Editor de Supabase. El panel web administrativo es trabajo futuro.

## Añadir productos

1. `videojuego`: título, descripción y valoración editorial (0–5).
2. `producto`: el juego, categoría, edición, región, precios en centavos, portada y `publicado=true`.
3. `clave_digital`: códigos **ficticios** que empiecen por `DEMO-`, asociados al producto, estado `DISPONIBLE`. Deja la línea y fecha de entrega en NULL.
4. Recarga el catálogo para ver el producto; no hace falta editar `app.js` ni desplegarlo otra vez.

Una misma obra puede tener productos distintos para cada categoría. `PS5`, `XBOX` y `Switch` son plataformas, no géneros. Se migraron los 13 productos existentes (6 PS5, 4 XBOX y 3 Switch) y 20 claves ficticias por producto. Aún no se ha completado el requisito posterior de 10 productos por categoría. Los datos de la demo no pretenden representar ofertas comerciales reales.

Para una portada nueva, sube el archivo a Storage → `portadas`, copia su URL pública y guárdala en `producto.imagen_url`. El bucket acepta JPEG, PNG, WebP y AVIF hasta 5 MB; solo ADMIN puede escribir desde la API. Las 13 portadas existentes conservan sus rutas `assets/`.

## API y archivos

| Archivo / función | Responsabilidad |
|---|---|
| `supabase-config.js` | URL y clave pública publicable. No contiene credenciales de PostgreSQL. |
| `supabase-api.js` | Adaptador para Auth, API REST y funciones RPC. |
| `app.js` | Interfaz, validaciones y presentación; el catálogo no tiene datos quemados. |
| `database/schema.sql` | Definición consolidada para explicar o reproducir la base en un proyecto vacío. |
| `supabase/migrations/` | Las dos migraciones aplicadas, con las versiones reales del servidor. |
| `supabase/seed.sql` | Los 13 productos y claves ficticias iniciales, solo para una base nueva. |
| `database/verify.sql` | Pruebas de transacciones y permisos con ROLLBACK. Requieren la carga inicial. |

RPC disponibles:

- `obtener_catalogo()`: catálogo publicado; no devuelve códigos ni datos personales.
- `guardar_carrito(p_ids bigint[])`: reemplaza el contenido del carrito activo del usuario autenticado.
- `comprar_demo(p_id uuid, p_ids bigint[], p_correo text, p_metodo text, p_total integer, p_comprobante text)`: valida precios y stock, crea pedido y pago simulado y entrega claves en una sola transacción.
- `obtener_pedido(p_id uuid, p_comprobante text)`: devuelve la compra al propietario. Un invitado necesita su comprobante privado; conocer solo el número o UUID del pedido no da acceso.

La compra no recibe número de tarjeta, vencimiento ni CVV. Solo recibe IDs de producto, método simulado, correo, total esperado, UUID de la solicitud y comprobante. El servidor calcula el importe real y rechaza un total distinto. No existe integración con un proveedor de pago ni envío de correos comerciales. No uses claves comerciales: la base exige el prefijo `DEMO-`.

## Estado y recuperación

- Invitado: carrito en `localStorage`; compra persistida con comprobante aleatorio privado en `sessionStorage`.
- Cuenta: Auth administra sesión y contraseña; el perfil, carrito e historial se consultan en Supabase. No se copian contraseñas a tablas públicas o al almacenamiento propio del programa.
- Al entrar se fusiona el carrito invitado con el registrado. Al salir no se hereda la selección de la cuenta como carrito invitado.
- Las escrituras del carrito se encolan; el checkout espera a que finalicen.
- El UUID se conserva para reintentar una compra sin duplicarla. Si se perdió la respuesta, aparece «Recuperar compra anterior». Para recuperar la última compra de la pestaña usa `/#recuperar-pedido`; en una cuenta también puedes abrirla desde «Mis compras».
- El invitado pierde el comprobante al cerrar su sesión de pestaña. Para conservar historial entre dispositivos debe crear una cuenta e iniciar sesión antes de comprar. No se transfieren automáticamente compras invitadas a una cuenta solo por compartir correo.
- Hay un límite educativo de 10 pedidos por correo y hora. No es una defensa completa contra abuso: una tienda comercial necesitaría pagos verificados, límites por red/sesión y medidas adicionales.

## Seguridad del modelo

RLS está activa en las 12 tablas. CLIENTE no puede editar roles, precios, inventario, pedidos o pagos directamente. Las escrituras administrativas se limitan al catálogo, métodos e inventario. Las operaciones privilegiadas están en `private`, con ruta de búsqueda fija, concesiones explícitas y comprobación del usuario o del comprobante de invitado. Las funciones públicas son envoltorios `SECURITY INVOKER`.

La disponibilidad se calcula con las claves disponibles, sin un segundo campo de stock editable. Hay claves foráneas compuestas para impedir asignar la clave de un producto a la línea de otro. Los bloqueos serializan compras de un mismo producto; los reintentos no vuelven a consumir claves. Las restricciones diferidas validan total, líneas, pago y entrega al terminar la transacción.

Los avisos informativos de índices sin uso son esperables en una base recién creada; no requieren borrar índices destinados a las relaciones.

## Pruebas

`database/verify.sql` se ejecuta como administrador en SQL Editor. Usa usuarios ficticios solo dentro de una transacción y termina con ROLLBACK. No se debe utilizar para crear cuentas reales; esas se crean con Auth.

Para la interfaz: `npm ci`, `npx playwright install chromium` y `npm test`. Las pruebas de interfaz usan respuestas controladas para no crear usuarios ni compras reales; la comprobación del catálogo por HTTPS sí consulta la base. Se puede usar `CHROMIUM_PATH` para un Chromium ya instalado.

No ejecutes `supabase db push` sobre el proyecto actual sin comprobar primero `supabase migration list`: los archivos locales corresponden a migraciones YA aplicadas. Para cambios posteriores crea una nueva migración y consérvala junto al código; no edites las anteriores.
