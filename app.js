"use strict";

// Catálogo y cuentas servidos por Supabase; sin datos comerciales locales.
const api = window.GameVaultAPI;
const plataformas = {
  ps5: { nombre: "PlayStation 5", etiqueta: "PS5" },
  xbox: { nombre: "Xbox Series X|S", etiqueta: "XBOX" },
  switch: { nombre: "Nintendo Switch", etiqueta: "SWITCH" }
};
const moneda = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const estado = { busqueda: "", plataforma: "todos", orden: "destacados", seleccion: new Set(), ultimaAccion: null };
const CLAVE_CARRITO = "gamevault:carrito-invitado";
let colaCarrito = Promise.resolve();
let cargandoCuenta = false;
let cambiandoSesion = false;
let historialPedidos = [];
let compraEnCurso = false;
let solicitudCompra = null;
let firmaCompra = null;
let catalogo = [];
let origenDialogo = null;
let origenCarrito = null;
let ultimoPedido = null;
let usuarioActual = null;

const $ = (id) => document.getElementById(id);

async function obtenerVideojuegos() { return api.catalogo(); }
function mensajeError(error) {
  if (/invalid login/i.test(error.message)) return "El correo o la contraseña no coinciden.";
  if (/email not confirmed/i.test(error.message)) return "Confirma tu correo antes de iniciar sesión.";
  if (/fetch|network/i.test(error.message)) return "No hay conexión con Supabase. Comprueba internet y vuelve a intentar.";
  if (/rate limit/i.test(error.message)) return "Demasiados intentos. Espera un momento antes de volver a intentar.";
  return error.message || "No pudimos completar la operación. Intenta de nuevo.";
}
function claveCarritoLocal() { return usuarioActual ? `gamevault:carrito:${usuarioActual.id}` : CLAVE_CARRITO; }

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
    if (!juego) return;
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
  try { localStorage.setItem(claveCarritoLocal(), JSON.stringify([...estado.seleccion])); }
  catch (error) { console.warn("No se pudo guardar el carrito en este navegador."); }
  if (!usuarioActual || cargandoCuenta) return;
  const idCuenta = usuarioActual.id;
  const ids = [...estado.seleccion];
  colaCarrito = colaCarrito.catch(() => {}).then(async () => {
    if (usuarioActual?.id !== idCuenta) return;
    try { await api.guardarCarrito(ids); }
    catch (error) { avisar("No se sincronizó el carrito: " + mensajeError(error)); throw error; }
  });
  // Evita rechazos sin manejar; el checkout vuelve a comprobar esta cola.
  colaCarrito.catch(() => {});
}

function restaurarCarrito() {
  try {
    const guardado = JSON.parse(localStorage.getItem(claveCarritoLocal()) || "[]");
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

function crearJuegoEntregado(juego) {
  const bloque = elemento("section", "delivered-game");
  const datos = elemento("div");
  const etiqueta = elemento("span", "delivered-tag", `${plataformas[juego.plataforma].etiqueta} · Entregado`);
  datos.append(etiqueta, elemento("h2", "", juego.titulo), elemento("p", "", `${juego.edicion} para ${plataformas[juego.plataforma].nombre}`));
  const codigo = juego.codigo;
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

function renderizarConfirmacion(pedido) {
  ultimoPedido = pedido;
  $("juegos-entregados").replaceChildren(...pedido.juegos.map(crearJuegoEntregado));
  $("confirmacion-mensaje").textContent = `Compra demo registrada para ${pedido.email}. Copia tus claves ficticias aquí; no se envían correos ni se realizan cobros.`;
  $("numero-pedido").textContent = pedido.numero;
  $("confirmacion-total").textContent = formatoPrecio(pedido.total);
  $("confirmacion-metodo").textContent = pedido.metodo;
  mostrarVista("confirmacion");
}
async function finalizarCompra() {
  if (compraEnCurso || !estado.seleccion.size) return;
  compraEnCurso = true;
  $("pagar").disabled = true;
  $("pagar").setAttribute("aria-busy", "true");
  try {
    await colaCarrito;
    const ids = [...estado.seleccion].sort((a,b) => a-b);
    const datos = { p_ids: ids, p_correo: $("correo-entrega").value.trim(),
      p_metodo: document.querySelector('input[name="metodo"]:checked').value,
      p_total: calcularTotales(obtenerJuegosCarrito()).subtotal };
    const firma = JSON.stringify([usuarioActual?.id || null, datos]);
    if (!solicitudCompra || firmaCompra !== firma) {
      solicitudCompra = { ...datos, p_id: crypto.randomUUID(), p_comprobante: crypto.randomUUID() + crypto.randomUUID() };
      firmaCompra = firma;
      // Se conserva ANTES de enviar, para recuperar un resultado si se corta la red.
      sessionStorage.setItem('gamevault:compra-pendiente', JSON.stringify(solicitudCompra));
    }
    const pedido = await api.comprar(solicitudCompra);
    sessionStorage.setItem('gamevault:ultimo-comprobante', JSON.stringify({ id: pedido.id, token: solicitudCompra.p_comprobante }));
    sessionStorage.removeItem('gamevault:compra-pendiente');
    solicitudCompra = null; firmaCompra = null;
    estado.seleccion.clear(); estado.ultimaAccion = null;
    actualizarSeleccion();
    $("formulario-pago").reset(); actualizarMetodoPago();
    renderizarConfirmacion(pedido);
    // La compra ya terminó: un fallo al refrescar no debe invitar a comprar de nuevo.
    try {
      catalogo = await obtenerVideojuegos(); renderizarCatalogo();
      if (usuarioActual) await cargarCuenta((await api.sesion())?.user, false);
    } catch (error) { avisar("Compra guardada. No se pudo actualizar el catálogo o el perfil; recarga para verlos."); }
  } catch (error) {
    $("error-formulario").textContent = mensajeError(error);
    $("error-formulario").hidden = false;
  } finally {
    compraEnCurso = false; $("pagar").disabled = !estado.seleccion.size;
    $("pagar").removeAttribute("aria-busy");
  }
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

async function cargarCuenta(user, fusionarInvitado = false) {
  cargandoCuenta = true;
  try {
    if (!user) { usuarioActual = null; historialPedidos = []; estado.seleccion.clear(); restaurarCarrito(); }
    else {
      const [perfil, pedidos, ids] = await Promise.all([api.perfil(user.id), api.pedidos(), api.carrito()]);
      if (!perfil.activo) throw new Error("Tu cuenta está inactiva.");
      const invitado = fusionarInvitado && !usuarioActual ? [...estado.seleccion] : [];
      usuarioActual = { id: user.id, nombre: perfil.nombre, email: user.email,
        creado: new Intl.DateTimeFormat('es-EC', { month: 'long', year: 'numeric' }).format(new Date(perfil.creado_en)),
        pedidos: pedidos.filter(p => p.estado === 'ENTREGADO').length, tipo: perfil.rol?.nombre === 'ADMIN' ? 'Administrador' : 'Cliente' };
      historialPedidos = pedidos;
      estado.seleccion = new Set([...ids, ...invitado].filter(id => catalogo.some(j => j.id === id && j.disponible)));
      if (fusionarInvitado) {
        await api.guardarCarrito([...estado.seleccion]);
        localStorage.removeItem(CLAVE_CARRITO);
      }
    }
    actualizarCuentaUI(); renderizarPerfil();
  } finally { cargandoCuenta = false; }
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
  const lista = $("historial-pedidos");
  lista.replaceChildren();
  if (!historialPedidos.length) lista.append(elemento("p", "", "Todavía no tienes compras."));
  historialPedidos.forEach(pedido => {
    const boton = elemento("button", "button button-secondary", `${pedido.numero} · ${formatoPrecio(pedido.total_centavos)} · ${pedido.estado}`);
    boton.type = "button";
    boton.addEventListener("click", async () => {
      boton.disabled = true;
      try { renderizarConfirmacion(await api.pedido(pedido.id_pedido)); }
      catch (error) { avisar(mensajeError(error)); }
      finally { boton.disabled = false; cambiandoSesion = false; }
    });
    lista.append(boton);
  });
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

async function iniciarSesion() {
  const form = $("formulario-login"), boton = form.querySelector('[type="submit"]');
  if (!form.reportValidity()) return;
  boton.disabled = true; cambiandoSesion = true;
  try {
    await colaCarrito.catch(() => {});
    const { user } = await api.login($("login-email").value.trim(), $("login-clave").value);
    await cargarCuenta(user, true); actualizarSeleccion();
    form.reset(); $("estado-login").hidden = true; mostrarVista("perfil");
  } catch (error) { $("estado-login").textContent = mensajeError(error); $("estado-login").classList.remove("is-success"); $("estado-login").hidden = false; }
  finally { boton.disabled = false; cambiandoSesion = false; }
}
async function registrarCuenta() {
  const form = $("formulario-registro"), boton = form.querySelector('[type="submit"]');
  if (!form.reportValidity()) return;
  const clave = $("registro-clave").value;
  const valida = clave.length >= 8 && /[a-z]/i.test(clave) && /\d/.test(clave);
  const igual = clave === $("registro-confirmar").value;
  marcarCampo($("registro-clave"),"error-registro-clave",valida,"Usa al menos 8 caracteres, una letra y un número.");
  marcarCampo($("registro-confirmar"),"error-registro-confirmar",igual,"Las contraseñas no coinciden.");
  if (!valida || !igual) return;
  boton.disabled = true; cambiandoSesion = true;
  try {
    const { user, session } = await api.registro($("registro-nombre").value.trim(), $("registro-email").value.trim(), clave);
    form.reset();
    if (session) { await cargarCuenta(user,true); actualizarSeleccion(); mostrarVista("perfil"); }
    else {
      seleccionarAuthTab("login");
      $("estado-login").textContent = "Revisa tu correo para confirmar la cuenta y después inicia sesión. Si ya tenías cuenta, usa tus credenciales.";
      $("estado-login").classList.add("is-success"); $("estado-login").hidden = false;
    }
  } catch (error) { $("estado-registro").textContent = mensajeError(error); $("estado-registro").hidden = false; }
  finally { boton.disabled = false; cambiandoSesion = false; }
}
async function cerrarSesion() {
  $("cerrar-sesion").disabled = true; cambiandoSesion = true;
  try {
    await colaCarrito.catch(() => {});
    await api.salir(); await cargarCuenta(null); actualizarSeleccion();
    $("correo-entrega").value = ""; $("juegos-entregados").replaceChildren(); ultimoPedido = null;
    solicitudCompra = null; firmaCompra = null;
    sessionStorage.removeItem('gamevault:ultimo-comprobante'); sessionStorage.removeItem('gamevault:compra-pendiente');
    seleccionarAuthTab("login"); mostrarVista("cuenta");
  } catch (error) { avisar(mensajeError(error)); }
  finally { $("cerrar-sesion").disabled = false; cambiandoSesion = false; }
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
    void iniciarSesion();
  });
  $("formulario-registro").addEventListener("submit", (evento) => {
    evento.preventDefault();
    void registrarCuenta();
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
  // Retira las credenciales y sesiones de la demo anterior.
  localStorage.removeItem('gamevault:sesion'); sessionStorage.removeItem('gamevault:cuenta-temporal');
  if (!localStorage.getItem(CLAVE_CARRITO) && localStorage.getItem('gamevault:carrito')) {
    localStorage.setItem(CLAVE_CARRITO, localStorage.getItem('gamevault:carrito'));
    localStorage.removeItem('gamevault:carrito');
  }
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
    try { await cargarCuenta((await api.sesion())?.user); }
    catch (error) { avisar("No pudimos recuperar tu cuenta: " + mensajeError(error)); }
    renderizarCatalogo();
    document.querySelectorAll("[data-platform], #ordenar, #abrir-carrito, #abrir-cuenta").forEach((control) => { control.disabled = false; });
    const destacado = catalogo.find((juego) => juego.id === 5) || catalogo[0];
    if (destacado) {
      $("hero-titulo").textContent = destacado.titulo;
      document.querySelector('.hero-art img').src = destacado.imagen;
      document.querySelector('.hero-art img').alt = `Portada de ${destacado.titulo}`;
      document.querySelector('.hero-art figcaption').textContent = plataformas[destacado.plataforma].nombre + ' · Clave digital';
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
    // Recuperar una respuesta perdida; no vuelve a comprar automáticamente.
    try {
      const pendiente = JSON.parse(sessionStorage.getItem('gamevault:compra-pendiente') || 'null');
      const ultimo = JSON.parse(sessionStorage.getItem('gamevault:ultimo-comprobante') || 'null');
      const ref = pendiente ? { id: pendiente.p_id, token: pendiente.p_comprobante } : ultimo;
      if (ref && location.hash === '#recuperar-pedido') renderizarConfirmacion(await api.pedido(ref.id,ref.token));
      if (pendiente) {
        const recuperar = elemento('button','button button-secondary','Recuperar compra anterior');
        recuperar.type = 'button';
        recuperar.onclick = async () => {
          try { renderizarConfirmacion(await api.pedido(ref.id,ref.token)); }
          catch(error) { avisar('No se encontró una compra completada. Puedes volver al checkout; se conservará la misma solicitud.'); }
        };
        $('catalogo').prepend(recuperar);
        solicitudCompra = pendiente;
        firmaCompra = JSON.stringify([usuarioActual?.id || null, { p_ids: pendiente.p_ids, p_correo: pendiente.p_correo, p_metodo: pendiente.p_metodo, p_total: pendiente.p_total }]);
      }
    } catch (error) { avisar(mensajeError(error)); }
    // No ejecutar consultas dentro del callback de Auth (puede bloquear el SDK).
    api.onAuth((event, session) => {
      if (cambiandoSesion || (session?.user?.id || null) === (usuarioActual?.id || null)) return;
      setTimeout(async () => {
        try {
          await cargarCuenta(session?.user);
          actualizarSeleccion();
          $("juegos-entregados").replaceChildren(); ultimoPedido = null;
          mostrarVista(session?.user ? 'perfil' : 'cuenta');
        } catch(error) { avisar(mensajeError(error)); }
      },0);
    });
  } catch (error) {
    $("lista-juegos").setAttribute("aria-busy", "false");
    $("resultados").textContent = "No pudimos cargar el catálogo. Recarga la página para volver a intentarlo.";
    console.error("Error al cargar el catálogo:", error);
  }
}
iniciar();
