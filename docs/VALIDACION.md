# Validación de la integración · 26 de octubre de 2026

- Base remota: 12 tablas con RLS, 3 categorías, 13 productos y 260 claves ficticias disponibles.
- Migraciones remotas verificadas: `20261026171200_gamevault_initial_schema` y `20261026171501_explicit_order_ownership_and_constraints`.
- 17 comprobaciones de SQL aprobadas en `database/verify.sql`: catálogo público sin códigos, compra invitada y autenticada, comprobante obligatorio, aislamiento entre cuentas, rol protegido, metadata sin privilegios, total validado, idempotencia y rollback completo por agotamiento. Todos los datos de estas pruebas se revierten.
- Navegador con API remota real: carga de los 13 productos y compra invitada completada con clave asignada y sin errores de JavaScript. La compra ficticia de esta prueba fue eliminada y su clave repuesta; la base quedó sin pedidos de prueba.
- Recorrido automatizado de la interfaz con API controlada: catálogo, búsqueda y filtros, carrito y deshacer, login correcto/incorrecto, fusión de carrito, error y reintento de checkout, confirmación, historial, salida y registro con confirmación de correo. Sin errores de JavaScript. Reflujo comprobado a 320, 768 y 1440 px.
- Verificación sintáctica y `git diff --check` aprobados.
- Advisor de seguridad: sin avisos. Advisor de rendimiento: solo información de índices aún sin uso por tratarse de una base nueva. [Referencia de este aviso](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

La comprobación de permisos usó dos identidades temporales dentro de una transacción. El recorrido de Auth en la interfaz usó respuestas controladas; el envío y la recepción de un correo real de confirmación no se probaron. Falta configurar las URLs de redirección de Auth y registrar/confirmar la cuenta real que se designará ADMIN. La carga de 10 productos por categoría y el panel administrativo web siguen fuera de esta entrega.
