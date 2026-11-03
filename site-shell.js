"use strict";

// Estructura compartida entre documentos. Cada HTML conserva su <main> y la
// estructura propia de su vista; aquí viven encabezado, iconos, avisos y pie.
const iconos = `
<svg class="icon-definitions" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <symbol id="icon-game" viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="3"/><path d="M7 12h6m-3-3v6m6-4h.01m2 2h.01"/></symbol>
  <symbol id="icon-search" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></symbol>
  <symbol id="icon-cart" viewBox="0 0 24 24"><path d="M3 3h2l3 12h10l3-8H6"/><circle cx="10" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></symbol>
  <symbol id="icon-user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></symbol>
  <symbol id="icon-arrow" viewBox="0 0 24 24"><path d="M5 12h14m-5-5 5 5-5 5"/></symbol>
  <symbol id="icon-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>
  <symbol id="icon-check" viewBox="0 0 24 24"><path d="m5 12 4 4 10-10"/></symbol>
  <symbol id="icon-close" viewBox="0 0 24 24"><path d="m6 6 12 12M6 18 18 6"/></symbol>
  <symbol id="icon-trash" viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/></symbol>
  <symbol id="icon-lock" viewBox="0 0 24 24"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></symbol>
  <symbol id="icon-mail" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></symbol>
  <symbol id="icon-card" viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/></symbol>
  <symbol id="icon-shield" viewBox="0 0 24 24"><path d="M12 3 5 6v5c0 4.6 2.8 8 7 10 4.2-2 7-5.4 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></symbol>
  <symbol id="icon-copy" viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></symbol>
</svg>`;

const cabecera = `<header class="site-header"><div class="container header-inner">
  <a class="brand" href="index.html" aria-label="GameVault, inicio"><span class="brand-mark"><svg class="icon" aria-hidden="true"><use href="#icon-game"/></svg></span><span>GAME<span class="brand-accent">VAULT</span></span></a>
  <nav class="main-nav" aria-label="Navegación principal"><a href="index.html" class="nav-link">Inicio</a><a href="catalogo.html" class="nav-link">Navegar</a><a href="index.html#oferta" class="nav-link">Ofertas</a><a href="soporte.html" class="nav-link">Soporte</a><a href="admin.html" class="nav-link" id="nav-admin" hidden>Administrar</a></nav>
  <form class="search-form" role="search" id="busqueda-form" action="catalogo.html"><label class="visually-hidden" for="buscar">Buscar videojuegos por título</label><svg class="icon" aria-hidden="true"><use href="#icon-search"/></svg><input type="search" id="buscar" name="q" placeholder="Buscar juegos" maxlength="100" autocomplete="off"><button type="submit" class="visually-hidden-focusable">Buscar</button></form>
  <div class="header-actions"><a class="icon-button cart-button" id="abrir-carrito" href="carrito.html" aria-label="Abrir carrito, 0 juegos"><svg class="icon" aria-hidden="true"><use href="#icon-cart"/></svg><span class="cart-count" id="contador-carrito" aria-hidden="true">0</span></a><a class="icon-button account-button" id="abrir-cuenta" href="login.html" aria-label="Iniciar sesión o registrarse"><svg class="icon" aria-hidden="true"><use href="#icon-user"/></svg></a></div>
</div></header>`;

const avisos = `<div class="feedback container" id="feedback" hidden><p id="mensaje" role="status" aria-live="polite" aria-atomic="true"></p><button class="text-button" type="button" id="deshacer" hidden>Deshacer</button><button class="icon-button" type="button" id="cerrar-aviso" aria-label="Cerrar aviso"><svg class="icon" aria-hidden="true"><use href="#icon-close"/></svg></button></div>`;

const pie = `<footer class="site-footer" id="ayuda"><div class="container footer-main">
  <div class="footer-about"><a class="brand" href="index.html" aria-label="GameVault, volver al inicio"><span class="brand-mark"><svg class="icon" aria-hidden="true"><use href="#icon-game"/></svg></span><span>GAME<span class="brand-accent">VAULT</span></span></a><p>Tu próximo juego empieza aquí. Explora títulos para PlayStation, Xbox y Nintendo Switch en un solo lugar.</p></div>
  <nav class="footer-platforms" aria-labelledby="plataformas-titulo"><h2 id="plataformas-titulo">PLATAFORMAS</h2><ul><li><a href="catalogo.html?plataforma=ps5">PlayStation 5</a></li><li><a href="catalogo.html?plataforma=xbox">Xbox Series X|S</a></li><li><a href="catalogo.html?plataforma=switch">Nintendo Switch</a></li></ul></nav>
  <section class="footer-help" aria-labelledby="ayuda-titulo"><h2 id="ayuda-titulo">AYUDA Y PREGUNTAS FRECUENTES</h2><details id="canjear"><summary>Cómo canjear claves</summary><p>En la tienda de tu consola, abre la opción para canjear un código. Antes de usarlo, comprueba que corresponde a tu plataforma y región.</p></details><details id="reembolso"><summary>Garantía de 24 horas</summary><p>Consulta las condiciones aplicables a tu pedido y conserva el número de compra para solicitar asistencia.</p></details><p><a href="soporte.html">Contactar con soporte</a></p></section>
</div><div class="container footer-bottom"><p>© <span id="anio">2026</span> GameVault.</p><a href="#contenido">Volver al contenido <span aria-hidden="true">↑</span></a></div></footer>`;

document.body.insertAdjacentHTML("afterbegin", `<a class="skip-link" href="#contenido">Saltar al contenido principal</a>${iconos}${cabecera}${avisos}`);
document.body.insertAdjacentHTML("beforeend", pie);
