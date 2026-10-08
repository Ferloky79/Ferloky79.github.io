"use strict";

/* DATOS QUEMADOS. Importes en centavos: evitan errores de coma flotante.
 * Los precios, valoraciones, regiones y stock son datos de la demo.
 * Las imágenes se guardan localmente para que también funcione sin internet.
 * Cada id identifica un producto/edición/plataforma, no una pantalla de Figma.
 */
const videojuegos = [
  { id: 1, titulo: "EA SPORTS FC 24", edicion: "Edición estándar", plataforma: "ps5", precioCentavos: 5999, precioAnteriorCentavos: 9999, valoracion: 4.6, imagen: "assets/fc24.jpg", region: "Global", disponible: true, descripcion: "Forma tu equipo y disfruta una nueva temporada de fútbol. Producto de ejemplo para PlayStation 5." },
  { id: 2, titulo: "Alan Wake 2", edicion: "Edición estándar", plataforma: "xbox", precioCentavos: 5949, precioAnteriorCentavos: 6999, valoracion: 4.2, imagen: "assets/alan.jpg", region: "Global", disponible: true, descripcion: "Adéntrate en una historia de misterio, luz y oscuridad. Producto de ejemplo para Xbox Series X|S." },
  { id: 3, titulo: "Mario Kart 8 Deluxe", edicion: "Edición estándar", plataforma: "switch", precioCentavos: 5999, precioAnteriorCentavos: null, valoracion: 4.9, imagen: "assets/mario.jpg", region: "Global", disponible: true, descripcion: "Compite con Mario y sus amigos en carreras llenas de diversión. Producto de ejemplo para Nintendo Switch." },
  { id: 4, titulo: "Ghost of Tsushima", edicion: "Director’s Cut", plataforma: "ps5", precioCentavos: 5999, precioAnteriorCentavos: null, valoracion: 4.8, imagen: "assets/ghost.jpg", region: "Global", disponible: true, descripcion: "Explora Tsushima y descubre el camino de Jin Sakai. Producto de ejemplo para PlayStation 5." },
  { id: 5, titulo: "Forza Motorsport", edicion: "Edición estándar", plataforma: "xbox", precioCentavos: 5999, precioAnteriorCentavos: 6999, valoracion: 4.5, imagen: "assets/forza.jpg", region: "Global", disponible: true, descripcion: "Vive la emoción de la pista. Elige tu coche, perfecciona cada curva y encuentra tu próximo desafío en Forza Motorsport." },
  { id: 6, titulo: "Astro Bot", edicion: "Edición estándar", plataforma: "ps5", precioCentavos: 6999, precioAnteriorCentavos: null, valoracion: 4.9, imagen: "assets/AstroBot.jpg", region: "Global", disponible: true, descripcion: "Acompaña a Astro en una aventura de plataformas llena de mundos creativos y sorpresas. Producto de demostración para PlayStation 5." },
  { id: 7, titulo: "God of War Ragnarök", edicion: "Edición estándar", plataforma: "ps5", precioCentavos: 4999, precioAnteriorCentavos: 6999, valoracion: 4.9, imagen: "assets/GodofWarRagnarok.avif", region: "Global", disponible: true, descripcion: "Kratos y Atreus viajan por los Nueve Reinos mientras se preparan para el Ragnarök. Producto de demostración para PlayStation 5." },
  { id: 8, titulo: "Gran Turismo 7", edicion: "Edición estándar", plataforma: "ps5", precioCentavos: 5999, precioAnteriorCentavos: 6999, valoracion: 4.6, imagen: "assets/GranTurismo.jpg", region: "Global", disponible: true, descripcion: "Colecciona, personaliza y conduce una amplia selección de vehículos en circuitos emblemáticos. Producto de demostración para PlayStation 5." },
  { id: 9, titulo: "Halo Infinite", edicion: "Campaña", plataforma: "xbox", precioCentavos: 3999, precioAnteriorCentavos: 5999, valoracion: 4.4, imagen: "assets/HaloInfinite.jpg", region: "Global", disponible: true, descripcion: "Enfrenta una nueva amenaza junto al Jefe Maestro en una campaña de ciencia ficción. Producto de demostración para Xbox Series X|S." },
  { id: 10, titulo: "Forza Horizon 5", edicion: "Edición estándar", plataforma: "xbox", precioCentavos: 4999, precioAnteriorCentavos: 5999, valoracion: 4.8, imagen: "assets/ForzaHorizon.jpg", region: "Global", disponible: true, descripcion: "Explora un vibrante mundo abierto al volante de cientos de vehículos. Producto de demostración para Xbox Series X|S." },
  { id: 11, titulo: "The Legend of Zelda: Tears of the Kingdom", edicion: "Edición estándar", plataforma: "switch", precioCentavos: 6999, precioAnteriorCentavos: null, valoracion: 4.9, imagen: "assets/TheLegendOfZelda.jpg", region: "Global", disponible: true, descripcion: "Recorre Hyrule y sus islas celestes usando nuevas habilidades para construir y explorar. Producto de demostración para Nintendo Switch." },
  { id: 12, titulo: "Super Mario Odyssey", edicion: "Edición estándar", plataforma: "switch", precioCentavos: 4999, precioAnteriorCentavos: 5999, valoracion: 4.8, imagen: "assets/MarioOdyssey.jpg", region: "Global", disponible: true, descripcion: "Viaja por reinos sorprendentes con Mario y Cappy para rescatar a la princesa Peach. Producto de demostración para Nintendo Switch." },
  { id: 13, titulo: "Marvel’s Wolverine", edicion: "Edición estándar", plataforma: "ps5", precioCentavos: 6999, precioAnteriorCentavos: null, valoracion: 4.7, imagen: "assets/Wolverine.jpg", region: "Global", disponible: true, descripcion: "Vive una aventura de acción protagonizada por Wolverine. Producto ficticio de demostración para PlayStation 5." }
];

const plataformas = {
  ps5: { nombre: "PlayStation 5", etiqueta: "PS5" },
  xbox: { nombre: "Xbox Series X|S", etiqueta: "XBOX" },
  switch: { nombre: "Nintendo Switch", etiqueta: "SWITCH" }
};
const moneda = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const estado = { busqueda: "", plataforma: "todos", orden: "destacados", seleccion: new Set(), ultimaAccion: null };
const CLAVE_CARRITO = "gamevault:carrito";
const CLAVE_SESION = "gamevault:sesion";
const CLAVE_CUENTA_TEMPORAL = "gamevault:cuenta-temporal";
const USUARIO_PRUEBA = { nombre: "Alex Gamer", email: "demo@gamevault.com", clave: "GameVault123", creado: "Octubre de 2026", pedidos: 0, tipo: "Cuenta de prueba" };
let catalogo = [];
let origenDialogo = null;
let origenCarrito = null;
let ultimoPedido = null;
let usuarioActual = null;
let cuentaRegistrada = null;
const $ = (id) => document.getElementById(id);

/** Sustituye solamente este adaptador para conectarte con tu API.
 * Ejemplo futuro (normaliza la respuesta al formato de videojuegos):
 * const respuesta = await fetch('/api/videojuegos');
 * if (!respuesta.ok) throw new Error('No se pudo cargar el catálogo');
 * return await respuesta.json();
 * La API y el servidor deberán validar disponibilidad y precios al comprar.
 */
async function obtenerVideojuegos() { return videojuegos; }

function elemento(etiqueta, clase, texto) {
  const nodo = document.createElement(etiqueta);
  if (clase) nodo.className = clase;
  if (texto !== undefined) nodo.textContent = texto;
  return nodo;
}
function icono(nombre) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "icon");
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `#icon-${nombre}`);
  svg.append(use);
  return svg;
}
function normalizar(texto) { return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim(); }
function formatoPrecio(centavos) { return moneda.format(centavos / 100); }
function descuento(juego) {
  return juego.precioAnteriorCentavos > juego.precioCentavos
    ? Math.round((1 - juego.precioCentavos / juego.precioAnteriorCentavos) * 100) : 0;
}
function crearPrecio(juego, clase) {
  const bloque = elemento("div", clase);
  if (descuento(juego)) {
    const anterior = elemento("span", "old-price");
    anterior.append(elemento("span", "visually-hidden", "Precio anterior: "), elemento("s", "", formatoPrecio(juego.precioAnteriorCentavos)));
    bloque.append(anterior);
  }
  const precio = elemento("span", "current-price");
  precio.append(elemento("span", "visually-hidden", "Precio actual: "), document.createTextNode(formatoPrecio(juego.precioCentavos)));
  bloque.append(precio);
  return bloque;
}
function crearImagen(juego, clase = "") {
  const imagen = elemento("img", clase);
  imagen.src = juego.imagen;
  imagen.alt = `Portada de ${juego.titulo}`;
  imagen.loading = "lazy";
  imagen.decoding = "async";
  imagen.addEventListener("error", () => {
    imagen.replaceWith(elemento("span", "art-unavailable", "Portada no disponible"));
  }, { once: true });
  return imagen;
}
function crearTarjeta(juego) {
  const item = elemento("li");
  const tarjeta = elemento("article", "game-card");
  tarjeta.setAttribute("aria-labelledby", `juego-${juego.id}`);
  const portada = elemento("button", "card-art");
  portada.type = "button";
  portada.dataset.details = juego.id;
  portada.setAttribute("aria-label", `Ver detalles de ${juego.titulo}, ${juego.edicion}`);
  portada.setAttribute("aria-haspopup", "dialog");
  portada.append(crearImagen(juego));
  if (descuento(juego)) portada.append(elemento("span", "discount", `−${descuento(juego)}%`));

  const cuerpo = elemento("div", "card-body");
  const meta = elemento("div", "card-meta");
  const plataforma = elemento("span", `platform-tag platform-${juego.plataforma}`);
  const abreviatura = elemento("span", "", plataformas[juego.plataforma].etiqueta);
  abreviatura.setAttribute("aria-hidden", "true");
  plataforma.append(abreviatura, elemento("span", "visually-hidden", plataformas[juego.plataforma].nombre));
  const rating = elemento("span", "rating");
  const estrella = elemento("span", "rating-star", "★ ");
  estrella.setAttribute("aria-hidden", "true");
  rating.append(elemento("span", "visually-hidden", "Valoración de ejemplo: "), estrella, document.createTextNode(juego.valoracion.toFixed(1)), elemento("span", "visually-hidden", " de 5"));
  meta.append(plataforma, rating);

  const titulo = elemento("h3");
  titulo.id = `juego-${juego.id}`;
  const detalles = elemento("button", "title-button", juego.titulo);
  detalles.type = "button";
  detalles.dataset.details = juego.id;
  detalles.setAttribute("aria-label", `Ver detalles de ${juego.titulo}`);
  detalles.setAttribute("aria-haspopup", "dialog");
  titulo.append(detalles);

  const pie = elemento("div", "card-bottom");
  const agregar = elemento("button", "add-button");
  agregar.type = "button";
  agregar.dataset.add = juego.id;
  agregar.disabled = !juego.disponible;
  agregar.setAttribute("aria-label", `Agregar ${juego.titulo} al carrito`);
  agregar.append(icono("plus"));
  pie.append(crearPrecio(juego, "card-prices"), agregar);
  cuerpo.append(meta, titulo, elemento("p", "card-format", `${juego.edicion} · Clave digital`), pie);
  tarjeta.append(portada, cuerpo);
  item.append(tarjeta);
  return item;
}

function renderizarCatalogo() {
  const consulta = normalizar(estado.busqueda);
  const juegos = catalogo.filter((juego) =>
    (estado.plataforma === "todos" || juego.plataforma === estado.plataforma) &&
    normalizar(`${juego.titulo} ${juego.edicion}`).includes(consulta)
  );
  if (estado.orden === "precio-asc") juegos.sort((a, b) => a.precioCentavos - b.precioCentavos);
  if (estado.orden === "precio-desc") juegos.sort((a, b) => b.precioCentavos - a.precioCentavos);
  if (estado.orden === "nombre") juegos.sort((a, b) => a.titulo.localeCompare(b.titulo, "es"));
  const fragmento = document.createDocumentFragment();
  juegos.forEach((juego) => fragmento.append(crearTarjeta(juego)));
  $("lista-juegos").replaceChildren(fragmento);
  $("lista-juegos").scrollLeft = 0;
  $("lista-juegos").setAttribute("aria-busy", "false");
  $("sin-resultados").hidden = juegos.length > 0;
  const filtro = estado.plataforma === "todos" ? "todas las plataformas" : plataformas[estado.plataforma].nombre;
  $("resultados").textContent = `${juegos.length} ${juegos.length === 1 ? "juego" : "juegos"} · ${filtro}${consulta ? ` · búsqueda: «${estado.busqueda}»` : ""}`;
  actualizarBotonesAgregar();
  requestAnimationFrame(actualizarFlechas);
}
function filtrarPlataforma(plataforma) {
  if (plataforma !== "todos" && !Object.hasOwn(plataformas, plataforma)) return;
  estado.plataforma = plataforma;
  document.querySelectorAll("[data-platform]").forEach((boton) => boton.setAttribute("aria-pressed", String(boton.dataset.platform === plataforma)));
  renderizarCatalogo();
}
function actualizarFlechas() {
  const lista = $("lista-juegos");
  $("anterior").disabled = lista.scrollLeft <= 2;
  $("siguiente").disabled = lista.scrollLeft + lista.clientWidth >= lista.scrollWidth - 2;
}
function desplazarCatalogo(direccion) {
  const lista = $("lista-juegos");
  const tarjeta = lista.firstElementChild;
  const distancia = tarjeta ? tarjeta.getBoundingClientRect().width + parseFloat(getComputedStyle(lista).columnGap) : lista.clientWidth;
  lista.scrollBy({ left: direccion * distancia, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
}

function avisar(mensaje, permitirDeshacer = false) {
  $("feedback").hidden = false;
  $("mensaje").textContent = mensaje;
  $("deshacer").hidden = !permitirDeshacer;
}
function avisarCarrito(mensaje, permitirDeshacer = false) {
  $("carrito-feedback").hidden = false;
  $("carrito-mensaje").textContent = mensaje;
  $("carrito-deshacer").hidden = !permitirDeshacer;
}
/** Punto de entrada del carrito.
 * Guarda un ejemplar por producto en el navegador.
 * No crea pedidos, cobra ni entrega claves.
 * Devuelve { ok, motivo?, juego? } y emite 'carrito:agregar' para conectar
 * tu módulo futuro sin modificar las tarjetas ni duplicar páginas HTML.
 */
function agregarAlCarrito(id) {
  const idNumerico = typeof id === "number" || typeof id === "string" && id.trim() !== "" ? Number(id) : NaN;
  const juego = catalogo.find((item) => item.id === idNumerico);
  if (!Number.isSafeInteger(idNumerico) || !juego) {
    avisar("No encontramos ese juego. Restablece la búsqueda y vuelve a intentarlo.");
    return { ok: false, motivo: "no-encontrado" };
  }
  if (!juego.disponible) {
    avisar(`${juego.titulo} no está disponible. Elige otro juego del catálogo.`);
    return { ok: false, motivo: "sin-disponibilidad" };
  }
  if (estado.seleccion.has(idNumerico)) {
    avisar(`${juego.titulo} ya está en tu carrito. Puedes quitarlo desde el icono del carrito.`);
    return { ok: false, motivo: "duplicado", juego };
  }
  estado.seleccion.add(idNumerico);
  estado.ultimaAccion = { tipo: "agregar", ids: [idNumerico] };
  actualizarSeleccion();
  avisar(`${juego.titulo} agregado al carrito. No se ha realizado ninguna compra.`, true);
  document.dispatchEvent(new CustomEvent("carrito:agregar", { detail: { id: idNumerico, juego: { ...juego }, cantidad: 1 } }));
  return { ok: true, juego };
}
function actualizarBotonesAgregar() {
  document.querySelectorAll("[data-add]").forEach((boton) => {
    const juego = catalogo.find((item) => item.id === Number(boton.dataset.add));
    const seleccionado = estado.seleccion.has(juego.id);
    // Es una acción de agregar, no un toggle: el estado queda en su nombre.
    boton.setAttribute("aria-label", seleccionado ? `${juego.titulo} ya está en el carrito` : `Agregar ${juego.titulo} al carrito`);
    if (boton.classList.contains("add-button")) {
      boton.dataset.selected = String(seleccionado);
      boton.replaceChildren(icono(seleccionado ? "check" : "plus"));
    } else {
      boton.textContent = seleccionado ? "Agregado al carrito" : "Agregar al carrito";
    }
  });
}
function actualizarSeleccion() {
  const cantidad = estado.seleccion.size;
  $("contador-carrito").textContent = cantidad;
  $("abrir-carrito").setAttribute("aria-label", `Abrir carrito, ${cantidad} ${cantidad === 1 ? "juego" : "juegos"}`);
  guardarCarrito();
  renderizarCarrito();
  if (document.body.dataset.view === "checkout") renderizarCheckout();
  if (usuarioActual) renderizarPerfil();
  actualizarBotonesAgregar();
}

function guardarCarrito() {
  try { localStorage.setItem(CLAVE_CARRITO, JSON.stringify([...estado.seleccion])); }
  catch (error) { console.warn("No se pudo guardar el carrito:", error); }
}

function restaurarCarrito() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE_CARRITO) || "[]");
    if (!Array.isArray(guardado)) return;
    estado.seleccion = new Set(guardado.filter((id) => Number.isSafeInteger(id) && catalogo.some((juego) => juego.id === id && juego.disponible)));
  } catch (error) {
    console.warn("No se pudo restaurar el carrito:", error);
  }
}

function crearFilaCarrito(juego) {
  const fila = elemento("li", "cart-item");
  const imagen = crearImagen(juego, "cart-item-art");
  const datos = elemento("div", "cart-item-info");
  const plataforma = elemento("span", `platform-tag platform-${juego.plataforma}`, plataformas[juego.plataforma].etiqueta);
  const titulo = elemento("h4", "", juego.titulo);
  const meta = elemento("p", "cart-item-meta", `${juego.edicion} · Clave digital`);
  const region = elemento("p", "cart-item-region", `Región: ${juego.region}`);
  datos.append(plataforma, titulo, meta, region);

  const acciones = elemento("div", "cart-item-actions");
  acciones.append(crearPrecio(juego, "cart-item-price"));
  const quitar = elemento("button", "cart-remove", "Quitar");
  quitar.type = "button";
  quitar.dataset.cartRemove = juego.id;
  quitar.setAttribute("aria-label", `Quitar ${juego.titulo} del carrito`);
  quitar.prepend(icono("trash"));
  acciones.append(quitar);
  fila.append(imagen, datos, acciones);
  return fila;
}

function renderizarCarrito() {
  const juegos = obtenerJuegosCarrito();
  const cantidad = juegos.length;
  const vacio = cantidad === 0;
  $("carrito-cantidad").textContent = `${cantidad} ${cantidad === 1 ? "producto" : "productos"}`;
  $("carrito-vacio").hidden = !vacio;
  $("lista-carrito").hidden = vacio;
  $("vaciar-carrito").hidden = vacio;
  $("resumen-carrito").hidden = vacio;
  $("mensaje-pago").hidden = true;

  const fragmento = document.createDocumentFragment();
  juegos.forEach((juego) => fragmento.append(crearFilaCarrito(juego)));
  $("lista-carrito").replaceChildren(fragmento);

  const subtotal = juegos.reduce((total, juego) => total + juego.precioCentavos, 0);
  const ahorro = juegos.reduce((total, juego) => total + Math.max(0, (juego.precioAnteriorCentavos || juego.precioCentavos) - juego.precioCentavos), 0);
  $("carrito-subtotal").textContent = formatoPrecio(subtotal);
  $("carrito-ahorro").textContent = `−${formatoPrecio(ahorro)}`;
  $("fila-ahorro").hidden = ahorro === 0;
  $("carrito-total").replaceChildren(document.createTextNode(`${formatoPrecio(subtotal)} `), elemento("small", "", "USD"));
}

function obtenerJuegosCarrito() {
  return [...estado.seleccion].map((id) => catalogo.find((juego) => juego.id === id)).filter(Boolean);
}

function calcularTotales(juegos) {
  const subtotal = juegos.reduce((total, juego) => total + juego.precioCentavos, 0);
  const ahorro = juegos.reduce((total, juego) => total + Math.max(0, (juego.precioAnteriorCentavos || juego.precioCentavos) - juego.precioCentavos), 0);
  return { subtotal, ahorro };
}

function crearItemCheckout(juego) {
  const item = elemento("li", "checkout-item");
  const datos = elemento("div");
  datos.append(elemento("h3", "", juego.titulo), elemento("p", "", "Entrega digital inmediata"));
  item.append(crearImagen(juego), datos, elemento("strong", "", formatoPrecio(juego.precioCentavos)));
  return item;
}

function renderizarCheckout() {
  const juegos = obtenerJuegosCarrito();
  const { subtotal, ahorro } = calcularTotales(juegos);
  $("checkout-productos").replaceChildren(...juegos.map(crearItemCheckout));
  $("checkout-cantidad").textContent = `${juegos.length} ${juegos.length === 1 ? "juego" : "juegos"}`;
  $("checkout-subtotal").textContent = formatoPrecio(subtotal);
  $("checkout-ahorro").textContent = `−${formatoPrecio(ahorro)}`;
  $("checkout-fila-ahorro").hidden = ahorro === 0;
  $("checkout-total").textContent = formatoPrecio(subtotal);
  $("pagar-total").textContent = formatoPrecio(subtotal);
  $("pagar").disabled = juegos.length === 0;
  if (usuarioActual && !$("correo-entrega").value) $("correo-entrega").value = usuarioActual.email;
  $("error-formulario").hidden = juegos.length > 0;
  if (!juegos.length) $("error-formulario").textContent = "Tu carrito está vacío. Vuelve al catálogo para agregar un juego.";
}

function mostrarVista(vista, destino = null) {
  const enTienda = vista === "tienda";
  $("oferta").hidden = !enTienda;
  $("catalogo").hidden = !enTienda;
  $("checkout").hidden = vista !== "checkout";
  $("confirmacion").hidden = vista !== "confirmacion";
  $("cuenta").hidden = vista !== "cuenta";
  $("perfil").hidden = vista !== "perfil";
  document.body.dataset.view = vista;
  requestAnimationFrame(() => {
    if (vista === "checkout") $("checkout-titulo").focus({ preventScroll: true });
    if (vista === "confirmacion") $("confirmacion-titulo").focus({ preventScroll: true });
    if (vista === "cuenta") $("cuenta-titulo").focus({ preventScroll: true });
    if (vista === "perfil") $("perfil-titulo").focus({ preventScroll: true });
    const objetivo = destino && document.querySelector(destino);
    (objetivo || $("contenido")).scrollIntoView({ block: "start" });
  });
}

function abrirCheckout() {
  if (!estado.seleccion.size) return;
  renderizarCheckout();
  $("carrito-dialogo").close();
  mostrarVista("checkout");
}

function abrirCarritoDialogo() {
  origenCarrito = document.activeElement;
  renderizarCarrito();
  $("carrito-feedback").hidden = true;
  $("carrito-dialogo").showModal();
  $("carrito-titulo").focus();
}

function actualizarMetodoPago() {
  const metodo = document.querySelector('input[name="metodo"]:checked').value;
  const tarjeta = metodo === "tarjeta";
  document.querySelectorAll(".payment-option").forEach((opcion) => {
    const seleccionado = opcion.querySelector("input").checked;
    opcion.classList.toggle("is-selected", seleccionado);
    const estadoTexto = opcion.querySelector("em");
    if (estadoTexto) estadoTexto.textContent = seleccionado ? "Seleccionado" : "";
  });
  $("campos-tarjeta").hidden = !tarjeta;
  $("info-paypal").hidden = tarjeta;
  [$("numero-tarjeta"), $("fecha-tarjeta"), $("cvv-tarjeta")].forEach((campo) => {
    campo.disabled = !tarjeta;
    campo.required = tarjeta;
    if (!tarjeta) {
      campo.removeAttribute("aria-invalid");
      campo.setCustomValidity("");
    }
  });
  if (!tarjeta) ["error-tarjeta", "error-fecha", "error-cvv"].forEach((id) => { $(id).textContent = ""; });
  $("pagar").querySelector("span").firstChild.textContent = tarjeta ? "Pagar " : "Confirmar con PayPal ";
}

function esTarjetaValida(numero) {
  const digitos = numero.replace(/\D/g, "");
  if (digitos.length < 13 || digitos.length > 19) return false;
  let suma = 0;
  let duplicar = false;
  for (let i = digitos.length - 1; i >= 0; i -= 1) {
    let valor = Number(digitos[i]);
    if (duplicar) { valor *= 2; if (valor > 9) valor -= 9; }
    suma += valor;
    duplicar = !duplicar;
  }
  return suma % 10 === 0;
}

function validarCheckout() {
  const email = $("correo-entrega");
  const numero = $("numero-tarjeta");
  const fecha = $("fecha-tarjeta");
  const cvv = $("cvv-tarjeta");
  const conTarjeta = document.querySelector('input[name="metodo"]:checked').value === "tarjeta";
  email.setCustomValidity("");
  const correoValido = email.validity.valid;
  email.setCustomValidity(correoValido ? "" : "Escribe un correo electrónico válido.");
  $("error-correo").textContent = correoValido ? "" : "Escribe un correo electrónico válido.";

  if (conTarjeta) {
    const numeroValido = esTarjetaValida(numero.value);
    numero.setCustomValidity(numeroValido ? "" : "Usa un número de prueba válido, como 4242 4242 4242 4242.");
    $("error-tarjeta").textContent = numeroValido ? "" : "Usa un número de prueba válido, como 4242 4242 4242 4242.";
    const partes = fecha.value.match(/^(0[1-9]|1[0-2])\s*\/\s*(\d{2})$/);
    const ahora = new Date();
    const fechaValida = Boolean(partes && (Number(partes[2]) > ahora.getFullYear() % 100 || Number(partes[2]) === ahora.getFullYear() % 100 && Number(partes[1]) >= ahora.getMonth() + 1));
    fecha.setCustomValidity(fechaValida ? "" : "Escribe una fecha vigente en formato MM / AA.");
    $("error-fecha").textContent = fechaValida ? "" : "Escribe una fecha vigente en formato MM / AA.";
    const cvvValido = /^\d{3,4}$/.test(cvv.value);
    cvv.setCustomValidity(cvvValido ? "" : "Escribe los 3 o 4 dígitos del CVV.");
    $("error-cvv").textContent = cvvValido ? "" : "Escribe los 3 o 4 dígitos del CVV.";
  }

  [email, numero, fecha, cvv].forEach((campo) => {
    if (!campo.disabled && !campo.validity.valid) campo.setAttribute("aria-invalid", "true");
    else campo.removeAttribute("aria-invalid");
  });
  return $("formulario-pago").checkValidity();
}

function codigoDigital(juego) {
  const plataforma = plataformas[juego.plataforma].etiqueta.replace(/[^A-Z]/g, "").slice(0, 4);
  return `GV-${plataforma}-${String(juego.id).padStart(4, "0")}-${(juego.id * 7919).toString(16).toUpperCase().padStart(4, "0")}-DEMO`;
}

function crearJuegoEntregado(juego) {
  const bloque = elemento("section", "delivered-game");
  const datos = elemento("div");
  const etiqueta = elemento("span", "delivered-tag", `${plataformas[juego.plataforma].etiqueta} · Entregado`);
  datos.append(etiqueta, elemento("h2", "", juego.titulo), elemento("p", "", `${juego.edicion} para ${plataformas[juego.plataforma].nombre}`));
  const codigo = codigoDigital(juego);
  const caja = elemento("div", "digital-code");
  caja.append(elemento("span", "", codigo));
  const copiar = elemento("button", "icon-button");
  copiar.type = "button";
  copiar.dataset.copyCode = codigo;
  copiar.setAttribute("aria-label", `Copiar código de ${juego.titulo}`);
  copiar.append(icono("copy"));
  caja.append(copiar);
  const respuesta = elemento("p", "copy-feedback");
  respuesta.setAttribute("aria-live", "polite");
  datos.append(caja, respuesta);
  bloque.append(crearImagen(juego), datos);
  return bloque;
}

function finalizarCompra() {
  const juegos = obtenerJuegosCarrito();
  const { subtotal } = calcularTotales(juegos);
  const metodo = document.querySelector('input[name="metodo"]:checked').value;
  const ultimos = $("numero-tarjeta").value.replace(/\D/g, "").slice(-4);
  ultimoPedido = {
    juegos: juegos.map((juego) => ({ ...juego })),
    total: subtotal,
    email: $("correo-entrega").value.trim(),
    metodo: metodo === "paypal" ? "PayPal (demo)" : `Visa demo •••• ${ultimos}`,
    numero: `#GV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`
  };
  $("juegos-entregados").replaceChildren(...ultimoPedido.juegos.map(crearJuegoEntregado));
  $("confirmacion-mensaje").textContent = `Los códigos simulados también se enviarían a ${ultimoPedido.email}.`;
  $("numero-pedido").textContent = ultimoPedido.numero;
  $("confirmacion-total").textContent = formatoPrecio(ultimoPedido.total);
  $("confirmacion-metodo").textContent = ultimoPedido.metodo;
  if (usuarioActual) {
    usuarioActual.pedidos = (usuarioActual.pedidos || 0) + 1;
    guardarSesion();
    renderizarPerfil();
  }
  estado.seleccion.clear();
  estado.ultimaAccion = null;
  actualizarSeleccion();
  $("formulario-pago").reset();
  actualizarMetodoPago();
  mostrarVista("confirmacion");
}
function quitarDeSeleccion(id) {
  const juego = catalogo.find((item) => item.id === id);
  if (!estado.seleccion.delete(id)) return;
  estado.ultimaAccion = { tipo: "quitar", ids: [id] };
  actualizarSeleccion();
  const mensaje = `${juego.titulo} fue quitado del carrito.`;
  avisar(mensaje, true);
  if ($("carrito-dialogo").open) avisarCarrito(mensaje, true);
  document.dispatchEvent(new CustomEvent("carrito:quitar", { detail: { id } }));
}

function vaciarCarrito() {
  if (!estado.seleccion.size) return;
  const ids = [...estado.seleccion];
  estado.seleccion.clear();
  estado.ultimaAccion = { tipo: "vaciar", ids };
  actualizarSeleccion();
  avisar("Carrito vaciado.", true);
  avisarCarrito("Se quitaron todos los juegos del carrito.", true);
  ids.forEach((id) => document.dispatchEvent(new CustomEvent("carrito:quitar", { detail: { id } })));
}

function deshacerUltimaAccion() {
  const accion = estado.ultimaAccion;
  if (!accion) return;
  estado.ultimaAccion = null;
  if (accion.tipo === "agregar") accion.ids.forEach((id) => estado.seleccion.delete(id));
  if (accion.tipo === "quitar" || accion.tipo === "vaciar") {
    accion.ids.forEach((id) => { if (catalogo.some((juego) => juego.id === id && juego.disponible)) estado.seleccion.add(id); });
  }
  actualizarSeleccion();
  accion.ids.forEach((id) => {
    const juego = catalogo.find((item) => item.id === id);
    const detail = accion.tipo === "agregar" ? { id } : { id, juego: { ...juego }, cantidad: 1 };
    document.dispatchEvent(new CustomEvent(accion.tipo === "agregar" ? "carrito:quitar" : "carrito:agregar", { detail }));
  });
  const mensaje = accion.tipo === "agregar" ? "Se deshizo la adición al carrito." : accion.tipo === "vaciar" ? "Se restauraron los juegos del carrito." : "El juego volvió al carrito.";
  avisar(mensaje);
  if ($("carrito-dialogo").open) avisarCarrito(mensaje);
}

function guardarSesion() {
  try {
    if (usuarioActual) localStorage.setItem(CLAVE_SESION, JSON.stringify(usuarioActual));
    else localStorage.removeItem(CLAVE_SESION);
  } catch (error) { console.warn("No se pudo guardar la sesión de demostración:", error); }
}

function restaurarSesion() {
  try {
    const guardada = JSON.parse(localStorage.getItem(CLAVE_SESION) || "null");
    if (guardada && typeof guardada.nombre === "string" && typeof guardada.email === "string") {
      usuarioActual = { nombre: guardada.nombre.slice(0, 50), email: guardada.email.slice(0, 100), creado: guardada.creado || "Octubre de 2026", pedidos: Number.isSafeInteger(guardada.pedidos) ? guardada.pedidos : 0, tipo: guardada.tipo || "Cuenta local" };
    }
  } catch (error) { console.warn("No se pudo restaurar la sesión de demostración:", error); }
}

function restaurarCuentaTemporal() {
  try {
    const guardada = JSON.parse(sessionStorage.getItem(CLAVE_CUENTA_TEMPORAL) || "null");
    if (guardada && typeof guardada.nombre === "string" && typeof guardada.email === "string" && typeof guardada.clave === "string") cuentaRegistrada = guardada;
  } catch (error) { console.warn("No se pudo restaurar la cuenta temporal:", error); }
}

function iniciales(nombre) {
  return nombre.trim().split(/\s+/).slice(0, 2).map((parte) => parte[0]?.toLocaleUpperCase("es") || "").join("") || "GV";
}

function actualizarCuentaUI() {
  const boton = $("abrir-cuenta");
  boton.dataset.authenticated = String(Boolean(usuarioActual));
  boton.setAttribute("aria-label", usuarioActual ? `Abrir perfil de ${usuarioActual.nombre}` : "Iniciar sesión o registrarse");
  boton.title = usuarioActual ? `Perfil de ${usuarioActual.nombre}` : "Mi cuenta";
}

function renderizarPerfil() {
  if (!usuarioActual) return;
  $("perfil-iniciales").textContent = iniciales(usuarioActual.nombre);
  $("perfil-nombre").textContent = usuarioActual.nombre;
  $("perfil-email").textContent = usuarioActual.email;
  $("perfil-tipo").textContent = usuarioActual.tipo;
  $("perfil-creado").textContent = usuarioActual.creado;
  $("perfil-pedidos").textContent = String(usuarioActual.pedidos || 0);
  $("perfil-carrito").textContent = String(estado.seleccion.size);
}

function seleccionarAuthTab(tab, enfocar = false) {
  const login = tab === "login";
  $("panel-login").hidden = !login;
  $("panel-registro").hidden = login;
  $("tab-login").setAttribute("aria-selected", String(login));
  $("tab-registro").setAttribute("aria-selected", String(!login));
  $("tab-login").tabIndex = login ? 0 : -1;
  $("tab-registro").tabIndex = login ? -1 : 0;
  if (enfocar) $(login ? "tab-login" : "tab-registro").focus();
}

function mostrarCuenta() {
  if (usuarioActual) {
    renderizarPerfil();
    mostrarVista("perfil");
  } else {
    seleccionarAuthTab("login");
    mostrarVista("cuenta");
  }
}

function marcarCampo(campo, errorId, valido, mensaje) {
  if (valido) campo.removeAttribute("aria-invalid");
  else campo.setAttribute("aria-invalid", "true");
  $(errorId).textContent = valido ? "" : mensaje;
  return valido;
}

function iniciarSesionDemo() {
  const email = $("login-email").value.trim().toLocaleLowerCase("es");
  const clave = $("login-clave").value;
  const emailValido = $("login-email").validity.valid;
  const claveValida = clave.length > 0;
  marcarCampo($("login-email"), "error-login-email", emailValido, "Escribe un correo electrónico válido.");
  marcarCampo($("login-clave"), "error-login-clave", claveValida, "Escribe tu contraseña.");
  if (!emailValido || !claveValida) return false;
  const coincidePrueba = email === USUARIO_PRUEBA.email && clave === USUARIO_PRUEBA.clave;
  const coincideRegistro = cuentaRegistrada && email === cuentaRegistrada.email && clave === cuentaRegistrada.clave;
  if (!coincidePrueba && !coincideRegistro) {
    $("estado-login").textContent = "El correo o la contraseña no coinciden. Puedes usar la cuenta de prueba indicada a la izquierda.";
    $("estado-login").classList.remove("is-success");
    $("estado-login").hidden = false;
    return false;
  }
  const origen = coincidePrueba ? USUARIO_PRUEBA : cuentaRegistrada;
  usuarioActual = { nombre: origen.nombre, email: origen.email, creado: origen.creado, pedidos: origen.pedidos || 0, tipo: origen.tipo };
  guardarSesion();
  actualizarCuentaUI();
  renderizarPerfil();
  $("formulario-login").reset();
  $("estado-login").hidden = true;
  mostrarVista("perfil");
  return true;
}

function registrarCuentaDemo() {
  const nombre = $("registro-nombre").value.trim();
  const email = $("registro-email").value.trim().toLocaleLowerCase("es");
  const clave = $("registro-clave").value;
  const confirmacion = $("registro-confirmar").value;
  const nombreValido = nombre.length >= 2;
  const emailValido = $("registro-email").validity.valid && email !== USUARIO_PRUEBA.email;
  const claveValida = clave.length >= 8 && /[a-záéíóúñ]/i.test(clave) && /\d/.test(clave);
  const confirmacionValida = confirmacion === clave && confirmacion.length > 0;
  const condicionesValidas = $("registro-condiciones").checked;
  marcarCampo($("registro-nombre"), "error-registro-nombre", nombreValido, "Escribe al menos 2 caracteres.");
  marcarCampo($("registro-email"), "error-registro-email", emailValido, email === USUARIO_PRUEBA.email ? "Ese correo pertenece a la cuenta de prueba. Inicia sesión con ella." : "Escribe un correo electrónico válido.");
  marcarCampo($("registro-clave"), "error-registro-clave", claveValida, "Usa al menos 8 caracteres, una letra y un número.");
  marcarCampo($("registro-confirmar"), "error-registro-confirmar", confirmacionValida, "Las contraseñas no coinciden.");
  $("error-registro-condiciones").textContent = condicionesValidas ? "" : "Confirma que entiendes el alcance de la demostración.";
  if (!nombreValido || !emailValido || !claveValida || !confirmacionValida || !condicionesValidas) return false;
  const creado = new Intl.DateTimeFormat("es-EC", { month: "long", year: "numeric" }).format(new Date());
  cuentaRegistrada = { nombre, email, clave, creado, pedidos: 0, tipo: "Cuenta local" };
  try { sessionStorage.setItem(CLAVE_CUENTA_TEMPORAL, JSON.stringify(cuentaRegistrada)); }
  catch (error) { console.warn("No se pudo conservar la cuenta temporal:", error); }
  usuarioActual = { nombre, email, creado, pedidos: 0, tipo: "Cuenta local" };
  guardarSesion();
  actualizarCuentaUI();
  renderizarPerfil();
  $("formulario-registro").reset();
  mostrarVista("perfil");
  return true;
}

function cerrarSesion() {
  usuarioActual = null;
  guardarSesion();
  actualizarCuentaUI();
  seleccionarAuthTab("login");
  $("estado-login").textContent = "Sesión cerrada correctamente.";
  $("estado-login").classList.add("is-success");
  $("estado-login").hidden = false;
  mostrarVista("cuenta");
}
// Accesible desde otro script clásico o desde la consola para la siguiente etapa.
window.agregarAlCarrito = agregarAlCarrito;

function abrirDialogo(titulo, contenido) {
  const dialogo = $("dialogo");
  origenDialogo = document.activeElement;
  $("dialogo-titulo").textContent = titulo;
  $("dialogo-contenido").replaceChildren(contenido);
  dialogo.showModal();
  $("dialogo-titulo").focus();
}
function mostrarDetalles(id) {
  const juego = catalogo.find((item) => item.id === Number(id));
  if (!juego) return;
  const contenido = elemento("div");
  const datos = elemento("dl", "product-facts");
  [["Plataforma", plataformas[juego.plataforma].nombre], ["Edición", juego.edicion], ["Formato", "Clave digital"], ["Región", juego.region], ["Estado", juego.disponible ? "Disponible en la demo" : "No disponible"]].forEach(([nombre, valor]) => datos.append(elemento("dt", "", nombre), elemento("dd", "", valor)));
  const agregar = elemento("button", "button button-primary", "Agregar al carrito");
  agregar.type = "button";
  agregar.dataset.add = juego.id;
  agregar.disabled = !juego.disponible;
  const aviso = elemento("p", "demo-note", "Datos de ejemplo. Verifica la plataforma y la región antes de una compra real.");
  contenido.append(crearImagen(juego, "dialog-art"), elemento("p", "dialog-description", juego.descripcion), datos, crearPrecio(juego, "dialog-prices"), agregar, aviso);
  abrirDialogo(juego.titulo, contenido);
  actualizarBotonesAgregar();
}
function conectarEventos() {
  let temporizadorBusqueda;
  const buscar = () => { estado.busqueda = $("buscar").value.trim(); renderizarCatalogo(); };
  $("buscar").addEventListener("input", () => { clearTimeout(temporizadorBusqueda); temporizadorBusqueda = setTimeout(buscar, 220); });
  $("busqueda-form").addEventListener("submit", (evento) => { evento.preventDefault(); clearTimeout(temporizadorBusqueda); buscar(); mostrarVista("tienda", "#catalogo"); });
  document.querySelectorAll("[data-platform]").forEach((boton) => boton.addEventListener("click", () => filtrarPlataforma(boton.dataset.platform)));
  document.querySelectorAll("[data-filter-link]").forEach((enlace) => enlace.addEventListener("click", () => filtrarPlataforma(enlace.dataset.filterLink)));
  $("ordenar").addEventListener("change", () => { estado.orden = $("ordenar").value; renderizarCatalogo(); });
  $("restablecer").addEventListener("click", () => {
    clearTimeout(temporizadorBusqueda);
    $("buscar").value = "";
    estado.busqueda = "";
    estado.orden = "destacados";
    $("ordenar").value = "destacados";
    filtrarPlataforma("todos");
    $("buscar").focus();
  });
  $("anterior").addEventListener("click", () => desplazarCatalogo(-1));
  $("siguiente").addEventListener("click", () => desplazarCatalogo(1));
  $("lista-juegos").addEventListener("scroll", actualizarFlechas, { passive: true });
  new ResizeObserver(actualizarFlechas).observe($("lista-juegos"));
  document.addEventListener("click", (evento) => {
    const copiar = evento.target.closest("button[data-copy-code]");
    if (copiar) {
      const respuesta = copiar.parentElement.nextElementSibling;
      navigator.clipboard?.writeText(copiar.dataset.copyCode).then(() => {
        respuesta.textContent = "Código copiado.";
      }).catch(() => {
        respuesta.textContent = "No pudimos copiarlo automáticamente. Selecciona el código manualmente.";
      });
      if (!navigator.clipboard) respuesta.textContent = "Selecciona el código manualmente para copiarlo.";
      return;
    }
    const boton = evento.target.closest("button[data-add], button[data-details], button[data-close], button[data-cart-remove]");
    if (!boton) return;
    if (boton.dataset.add) {
      const enDialogo = boton.closest("dialog");
      if (enDialogo) $("dialogo").close();
      agregarAlCarrito(boton.dataset.add);
    }
    if (boton.dataset.details) mostrarDetalles(boton.dataset.details);
    if (boton.dataset.cartRemove) {
      quitarDeSeleccion(Number(boton.dataset.cartRemove));
      $("carrito-titulo").focus();
    }
    if (boton.dataset.close) $("dialogo").close();
  });
  $("abrir-carrito").addEventListener("click", abrirCarritoDialogo);
  $("cerrar-carrito").addEventListener("click", () => $("carrito-dialogo").close());
  $("cerrar-carrito-feedback").addEventListener("click", () => { $("carrito-feedback").hidden = true; $("cerrar-carrito").focus(); });
  $("carrito-dialogo").addEventListener("close", () => { if (origenCarrito?.isConnected) origenCarrito.focus(); });
  $("explorar-juegos").addEventListener("click", () => {
    $("carrito-dialogo").close();
    mostrarVista("tienda", "#catalogo");
    requestAnimationFrame(() => $("buscar").focus({ preventScroll: true }));
  });
  $("vaciar-carrito").addEventListener("click", vaciarCarrito);
  $("continuar-pago").addEventListener("click", abrirCheckout);
  document.querySelectorAll("[data-show-store]").forEach((control) => control.addEventListener("click", (evento) => {
    evento.preventDefault();
    mostrarVista("tienda", control.getAttribute("href") || "#inicio");
  }));
  document.querySelectorAll(".brand, .main-nav a, .footer-platforms a").forEach((enlace) => enlace.addEventListener("click", (evento) => {
    if (document.body.dataset.view === "tienda") return;
    evento.preventDefault();
    mostrarVista("tienda", enlace.getAttribute("href") || "#inicio");
  }));
  document.querySelectorAll("[data-open-cart]").forEach((control) => control.addEventListener("click", () => {
    abrirCarritoDialogo();
  }));
  document.querySelectorAll('input[name="metodo"]').forEach((radio) => radio.addEventListener("change", actualizarMetodoPago));
  $("numero-tarjeta").addEventListener("input", (evento) => {
    const digitos = evento.target.value.replace(/\D/g, "").slice(0, 19);
    evento.target.value = digitos.replace(/(.{4})/g, "$1 ").trim();
  });
  $("fecha-tarjeta").addEventListener("input", (evento) => {
    const digitos = evento.target.value.replace(/\D/g, "").slice(0, 4);
    evento.target.value = digitos.length > 2 ? `${digitos.slice(0, 2)} / ${digitos.slice(2)}` : digitos;
  });
  $("cvv-tarjeta").addEventListener("input", (evento) => { evento.target.value = evento.target.value.replace(/\D/g, "").slice(0, 4); });
  $("formulario-pago").addEventListener("submit", (evento) => {
    evento.preventDefault();
    if (!estado.seleccion.size) {
      $("error-formulario").textContent = "Tu carrito está vacío. Vuelve al catálogo para agregar un juego.";
      $("error-formulario").hidden = false;
      return;
    }
    if (!validarCheckout()) {
      $("error-formulario").textContent = "Revisa los campos marcados antes de continuar.";
      $("error-formulario").hidden = false;
      $("formulario-pago").querySelector(":invalid")?.focus();
      return;
    }
    $("error-formulario").hidden = true;
    finalizarCompra();
  });
  $("abrir-cuenta").addEventListener("click", mostrarCuenta);
  $("usar-cuenta-prueba").addEventListener("click", () => {
    seleccionarAuthTab("login");
    $("login-email").value = USUARIO_PRUEBA.email;
    $("login-clave").value = USUARIO_PRUEBA.clave;
    $("login-email").focus();
  });
  [["tab-login", "login"], ["tab-registro", "registro"]].forEach(([id, tab]) => $(id).addEventListener("click", () => seleccionarAuthTab(tab)));
  $("cuenta").querySelector(".auth-tabs").addEventListener("keydown", (evento) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(evento.key)) return;
    evento.preventDefault();
    seleccionarAuthTab(evento.key === "ArrowLeft" || evento.key === "Home" ? "login" : "registro", true);
  });
  document.querySelectorAll("[data-auth-tab]").forEach((control) => control.addEventListener("click", () => seleccionarAuthTab(control.dataset.authTab, true)));
  document.querySelectorAll("[data-toggle-password]").forEach((control) => control.addEventListener("click", () => {
    const campo = $(control.dataset.togglePassword);
    const mostrar = campo.type === "password";
    campo.type = mostrar ? "text" : "password";
    control.textContent = mostrar ? "Ocultar" : "Mostrar";
    control.setAttribute("aria-pressed", String(mostrar));
    campo.focus();
  }));
  $("formulario-login").addEventListener("submit", (evento) => {
    evento.preventDefault();
    if (!iniciarSesionDemo()) $("formulario-login").querySelector('[aria-invalid="true"]')?.focus();
  });
  $("formulario-registro").addEventListener("submit", (evento) => {
    evento.preventDefault();
    if (!registrarCuentaDemo()) $("formulario-registro").querySelector('[aria-invalid="true"], input:invalid')?.focus();
  });
  $("cerrar-sesion").addEventListener("click", cerrarSesion);
  document.querySelectorAll("[data-profile-store]").forEach((control) => control.addEventListener("click", () => mostrarVista("tienda", "#catalogo")));
  $("cerrar-dialogo").addEventListener("click", () => $("dialogo").close());
  $("dialogo").addEventListener("close", () => { if (origenDialogo?.isConnected) origenDialogo.focus(); });
  // <dialog> gestiona Escape y el fondo inerte. Refuerza el ciclo de Tab
  // para conservar el foco en los controles del diálogo entre navegadores.
  $("dialogo").addEventListener("keydown", (evento) => {
    if (evento.key !== "Tab") return;
    const controles = [...$("dialogo").querySelectorAll("button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled)")].filter((control) => control.getClientRects().length);
    const primero = controles[0];
    const ultimo = controles.at(-1);
    if (!primero) return;
    if (evento.shiftKey && (document.activeElement === primero || document.activeElement === $("dialogo-titulo"))) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  });
  $("deshacer").addEventListener("click", () => {
    deshacerUltimaAccion();
    $("abrir-carrito").focus();
  });
  $("carrito-deshacer").addEventListener("click", () => { deshacerUltimaAccion(); $("carrito-titulo").focus(); });
  $("cerrar-aviso").addEventListener("click", () => { $("feedback").hidden = true; $("abrir-carrito").focus(); });
}

async function iniciar() {
  conectarEventos();
  document.body.dataset.view = "tienda";
  actualizarMetodoPago();
  restaurarSesion();
  restaurarCuentaTemporal();
  actualizarCuentaUI();
  $("abrir-cuenta").disabled = false;
  try {
    const datos = await obtenerVideojuegos();
    const ids = new Set();
    if (!Array.isArray(datos) || !datos.every((juego) => {
      const valido = Number.isSafeInteger(juego.id) && !ids.has(juego.id) &&
        typeof juego.titulo === "string" && typeof juego.edicion === "string" &&
        typeof juego.descripcion === "string" && typeof juego.imagen === "string" &&
        typeof juego.region === "string" && typeof juego.disponible === "boolean" &&
        Object.hasOwn(plataformas, juego.plataforma) &&
        Number.isSafeInteger(juego.precioCentavos) && juego.precioCentavos >= 0 &&
        (juego.precioAnteriorCentavos === null || Number.isSafeInteger(juego.precioAnteriorCentavos) && juego.precioAnteriorCentavos >= 0) &&
        Number.isFinite(juego.valoracion) && juego.valoracion >= 0 && juego.valoracion <= 5;
      ids.add(juego.id);
      return valido;
    })) throw new Error("Formato de catálogo no válido");
    catalogo = datos;
    restaurarCarrito();
    renderizarCatalogo();
    document.querySelectorAll("[data-platform], #ordenar, #abrir-carrito, #abrir-cuenta").forEach((control) => { control.disabled = false; });
    const destacado = catalogo.find((juego) => juego.id === 5);
    if (destacado) {
      $("hero-titulo").textContent = destacado.titulo;
      $("hero-descripcion").textContent = destacado.descripcion;
      const precio = crearPrecio(destacado, "hero-price");
      precio.id = "hero-precio";
      if (descuento(destacado)) precio.append(elemento("span", "discount", `−${descuento(destacado)}%`));
      precio.append(elemento("span", "currency", "USD"));
      $("hero-precio").replaceWith(precio);
      $("hero-agregar").dataset.add = destacado.id;
      $("hero-agregar").disabled = !destacado.disponible;
      $("hero-detalles").dataset.details = destacado.id;
      $("hero-detalles").disabled = false;
    }
    $("anio").textContent = new Date().getFullYear();
    actualizarSeleccion();
  } catch (error) {
    $("lista-juegos").setAttribute("aria-busy", "false");
    $("resultados").textContent = "No pudimos cargar el catálogo. Recarga la página para volver a intentarlo.";
    console.error("Error al cargar el catálogo:", error);
  }
}
iniciar();
