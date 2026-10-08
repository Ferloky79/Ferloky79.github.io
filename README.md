# GameVault · HTML, CSS y JavaScript

Base del catálogo inspirada en la captura adjunta del proyecto de Figma. El acceso a las capas de Figma estuvo bloqueado por el límite de consultas del plan Starter; por ello la composición es una adaptación visual de la captura, no una exportación exacta de todos los frames. Las portadas se obtuvieron de las tiendas oficiales y pueden diferir de las variantes de la captura.

## Abrir el proyecto

1. Descomprime `gamevault.zip`.
2. Conserva `index.html`, `styles.css`, `app.js` y la carpeta `assets/` juntos.
3. Abre `index.html` en un navegador moderno. No necesitas instalar dependencias ni un servidor para esta demo.

El proyecto funciona sin internet. Solo necesitas un servidor cuando sustituyas los datos quemados por peticiones a una API.

## Qué incluye cada archivo

- `index.html`: catálogo, carrito, checkout, confirmación, acceso, registro, perfil, ayuda y navegación.
- `styles.css`: sistema visual adaptable para todas las vistas; en móvil los contenidos se reorganizan sin desplazamiento horizontal.
- `app.js`: trece videojuegos, filtros, carrito, checkout y flujos locales de cuenta.
- `assets/`: trece imágenes locales. No se usa la captura completa como imagen de la página.
- `test-e2e.cjs`: recorrido automatizado integral mediante Chrome en modo headless.

Los juegos iniciales se reconstruyeron de los títulos visibles en la captura. Puedes editar `videojuegos` al inicio de `app.js`. Los precios, las valoraciones, la región y la disponibilidad son datos de ejemplo. El porcentaje de descuento se calcula a partir de los dos precios, para evitar inconsistencias.

## Carrito de compras

```js
agregarAlCarrito(1);
// Devuelve { ok: true, juego } si se acepta.
// Si falla: { ok: false, motivo, juego? }.
```

La función valida el ID y la disponibilidad y evita duplicados. El carrito presenta portada, plataforma, edición, precio, ahorro y total; permite quitar productos, vaciarlo y volver al catálogo. Cada eliminación muestra un aviso con **Deshacer**, incluido el vaciado completo. La selección se conserva en `localStorage` al recargar la página. Al tratarse de claves digitales, cada producto aparece una sola vez y no usa selector de cantidad.

El flujo completo sigue siendo una demo: no crea pedidos en un servidor, procesa cobros ni entrega claves comerciales. Los precios y la disponibilidad deben volver a validarse en el backend cuando se conecte un checkout real.

## Checkout y confirmación

Desde el resumen del carrito, **Continuar al pago** abre un checkout de dos columnas con:

- Correo para la entrega digital.
- Pago simulado con tarjeta o PayPal.
- Validación de correo, número de prueba, fecha y CVV.
- Resumen dinámico de productos, descuentos y total.
- Adaptación a una sola columna en pantallas pequeñas.

Para probar el formulario de tarjeta puedes usar `4242 4242 4242 4242`, cualquier fecha futura y un CVV ficticio de tres dígitos. No uses información bancaria real.

Al confirmar se crea una pantalla de resultado con número de pedido y códigos exclusivamente simulados. La acción vacía el carrito guardado, pero no envía correos, autoriza pagos ni genera claves comerciales. En una implementación real, estos pasos deben ejecutarse y verificarse en el servidor mediante el proveedor de pagos.

## Cuenta de demostración

El botón de usuario abre el acceso o el perfil según el estado de la sesión. Credenciales de prueba:

- Correo: `demo@gamevault.com`
- Contraseña: `GameVault123`

También se puede registrar una cuenta local. El perfil conserva nombre, correo y cantidad de compras demo; nunca guarda información de pago. La cuenta creada se puede reutilizar durante la sesión actual del navegador. Este módulo no reemplaza autenticación real: un entorno productivo necesita backend, contraseñas cifradas, recuperación de acceso y protección contra abuso.

Puedes conectar el módulo siguiente mediante sus eventos:

```js
document.addEventListener('carrito:agregar', ({ detail }) => {
  // detail = { id, juego, cantidad: 1 }
  // Conecta aquí analítica, inventario o tu futuro backend.
});

document.addEventListener('carrito:quitar', ({ detail }) => {
  // detail = { id }
});
```

Los estados vacío, con productos, duplicado y eliminación se representan con los mismos datos y funciones compartidas. No requieren un archivo HTML por combinación.

## Conectar los datos dinámicos

Cambia `obtenerVideojuegos()` por una petición a tu API y conserva el contrato actual de los objetos. Los importes son enteros en centavos, por ejemplo `5999` representa USD 59.99. Si el mismo juego tiene otra edición o plataforma, crea otro registro con un ID único. El servidor deberá confirmar precios, región, stock, autorización del pago y autenticación al crear el pedido.

## Decisiones de usabilidad

Aplicación de las [10 heurísticas de Nielsen](https://www.nngroup.com/articles/ten-usability-heuristics/):

| Heurística | Aplicación en esta base |
| --- | --- |
| Visibilidad del estado | Contador, resultados y avisos de acciones. |
| Relación con el mundo real | Español, precios en USD y nombres de plataformas. |
| Control y libertad | Deshacer, quitar, restablecer y cerrar con Escape. |
| Consistencia | Controles, tarjetas y etiquetas con patrones comunes. |
| Prevención de errores | Validación de IDs, disponibilidad y duplicados. |
| Reconocimiento | Título, plataforma y precio visibles. |
| Flexibilidad y eficiencia | Búsqueda, filtros, ordenación y teclado. |
| Diseño minimalista | Detalles secundarios dentro de un diálogo. |
| Recuperación de errores | Mensajes claros con acciones de recuperación. |
| Ayuda y documentación | Preguntas frecuentes y esta guía. |

## Accesibilidad considerada

Referencia: [WCAG 2.2 del W3C](https://www.w3.org/TR/WCAG22/). Se atienden sus cuatro principios:

- **Perceptible:** estructura semántica, texto alternativo, contraste y etiquetas visibles o accesibles; selección comunicada con texto y símbolos.
- **Operable:** teclado, salto al contenido, foco visible, Escape, objetivos de interacción de 44 px, controles manuales y movimiento reducido.
- **Comprensible:** español declarado, nombres claros, avisos de error y comportamiento consistente.
- **Robusto:** controles HTML nativos, `dialog`, estados ARIA y avisos mediante `role="status"`.

Criterios considerados: 1.1.1, 1.3.1, 1.4.3, 1.4.10, 1.4.11, 2.1.1, 2.1.2, 2.4.1, 2.4.7, 2.4.11, 2.5.8, 3.1.1 y 4.1.3. Los avisos se muestran dentro del flujo para no tapar controles. El catálogo se reorganiza verticalmente en pantallas pequeñas.

Esta implementación no equivale a una certificación WCAG. Antes de publicar, corresponde una evaluación humana adicional con lectores de pantalla reales, ampliación de texto y usuarios con distintas capacidades.

## Verificación realizada

`node test-e2e.cjs` ejecuta el recorrido automatizado. Se probaron trece juegos e imágenes, búsqueda, filtros, orden, detalles, duplicados, eliminación, vaciado y sus acciones de deshacer, acceso, registro, reingreso, persistencia, perfil, checkout, PayPal, validaciones, confirmación, copia de códigos y contador de pedidos.

La revisión en Chrome también verifica errores de ejecución, textos alternativos, etiquetas de formulario, nombres accesibles, objetivos de interacción, estructura de encabezados, contraste AA de los tokens principales y desbordamiento a 320, 390, 768, 1024 y 1440 px. La última ejecución completó 44 verificaciones sin fallos. Esto complementa, pero no sustituye, una auditoría manual.

## Procedencia de imágenes

- [Forza Motorsport · Steam](https://store.steampowered.com/app/2440510/Forza_Motorsport/)
- [EA SPORTS FC 24 · Steam](https://store.steampowered.com/app/2195250/EA_SPORTS_FC_24/)
- [Ghost of Tsushima Director’s Cut · Steam](https://store.steampowered.com/app/2215430/Ghost_of_Tsushima_DIRECTORS_CUT/)
- [Alan Wake 2 · PlayStation Store](https://store.playstation.com/es-ec/concept/10002065)
- [Mario Kart 8 Deluxe · Nintendo](https://www.nintendo.com/us/store/products/mario-kart-8-deluxe-switch/)

Las imágenes ilustran el juego; los datos comerciales de esta demo no representan ofertas de esas tiendas. Las marcas y portadas pertenecen a sus respectivos titulares.
