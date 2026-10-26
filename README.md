# GameVault

Tienda académica de videojuegos en HTML, CSS y JavaScript, conectada a PostgreSQL mediante Supabase.

Incluye catálogo dinámico, búsqueda y filtros, carrito, registro y acceso con Supabase Auth, perfil, historial y checkout simulado con asignación transaccional de claves ficticias. Puede seguir alojada en GitHub Pages.

Abre la carpeta en VS Code y usa Live Server o `python -m http.server 5500`. El catálogo necesita internet. No abras el HTML como `file://` para probar cuentas y peticiones.

Consulta [la guía de implementación](docs/IMPLEMENTACION.md) para configurar las URLs de Auth, asignar tu cuenta ADMIN, añadir productos, conocer la API y continuar con Codex en VS Code.

La base del proyecto `E-commerce videojuegos` ya está creada. Las migraciones y los datos iniciales están incluidos para seguimiento y reproducción; no vuelvas a aplicarlos sobre las tablas existentes.

**Alcance:** pagos simulados, claves ficticias y entrega en pantalla. No hay cobros, envío de correo de pedidos ni claves comerciales. Se conservan los 13 productos iniciales; la carga de 10 productos por categoría sigue pendiente.

Las portadas y marcas pertenecen a sus titulares. El diseño conserva la adaptación del prototipo Figma y las medidas de accesibilidad de la interfaz anterior: estructura semántica, foco visible, controles con nombre, diálogos de teclado, avisos y diseño adaptable.
