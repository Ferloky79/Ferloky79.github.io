# GameVault

Proyecto universitario en HTML/CSS/JS, hospedable en GitHub Pages. Mantén el diseño y las interacciones existentes salvo que el usuario pida cambiarlos.

- Los productos y el stock vienen de Supabase. No vuelvas a introducir un catálogo quemado ni usuarios de prueba en el código de aplicación.
- `supabase-config.js` contiene únicamente URL y clave publicable. Nunca incluyas contraseña de PostgreSQL, `service_role`, claves `sb_secret` o credenciales personales.
- Usa Supabase Auth para cuentas y `supabase-api.js` como adaptador de acceso.
- La lógica de compra está en PostgreSQL. No calcules ni entregues claves en el navegador ni apruebes pedidos con escrituras directas desde el cliente.
- Las 12 tablas deben conservar RLS. Las consultas de pedidos/carritos/claves deben verificar su propietario. ADMIN se asigna por una operación administrativa; no desde metadata editable por el usuario.
- Las claves y los pagos son ficticios. No añadas integración comercial sin una petición explícita.
- Conserva las migraciones aplicadas; crea una nueva para cambios posteriores. Lee `docs/IMPLEMENTACION.md` antes de tocar la base.
- Usa centavos enteros para USD y conserva los IDs de producto, o migra también los carritos.
- Verifica JavaScript con `node --check app.js` y `node --check supabase-api.js`. Para cambios de interfaz ejecuta `npm test` con Playwright y Chromium instalados.
- Las pruebas de interfaz simulan la API. `database/verify.sql` prueba permisos y transacciones en Supabase con ROLLBACK. No ejecutes cargas iniciales sobre la base existente.
