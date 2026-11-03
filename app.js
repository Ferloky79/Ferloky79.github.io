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
const CLAVE_RETORNO = "gamevault:retorno-login";
const PAGINA = document.body.dataset.page || "inicio";
const ARCHIVOS = { inicio: "index.html", catalogo: "catalogo.html", detalle: "producto.html", carrito: "carrito.html", checkout: "checkout.html", confirmacion: "confirmacion.html", cuenta: "login.html", login: "login.html", registro: "registro.html", perfil: "perfil.html", soporte: "soporte.html", ticket: "ticket.html", admin: "admin.html" };
let colaCarrito = Promise.resolve();
let cargandoCuenta = false;
let cambiandoSesion = false;
let historialPedidos = [];
let compraEnCurso = false;
let solicitudCompra = null;
let firmaCompra = null;
let catalogo = [];
let ultimoPedido = null;
let usuarioActual = null;
let productoDetalleActual = null;
let resenaPropiaActual = null;
let datosAdmin = null;

const $ = (id) => document.getElementById(id);

async function obtenerVideojuegos() { return api.catalogo(); }
function mensajeError(error) {
  if (/invalid login/i.test(error.message)) return "El correo o la contraseña no coinciden.";
  if (/email not confirmed/i.test(error.message)) return "Confirma tu correo antes de iniciar sesión.";
  if (error.code === "23505") return "Ya existe un registro con esos datos.";
  if (error.code === "23503") return "No se puede eliminar porque el registro está relacionado con otros datos.";
  if (error.code === "42501" || /row-level security|permission denied/i.test(error.message)) return "Tu cuenta no tiene permiso para realizar esta acción.";
  if (/resuelto o cerrado/i.test(error.message)) return "El ticket ya no admite respuestas.";
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
  imagen.alt = `Portada del videojuego ${juego.titulo}`;
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
  rating.append(elemento("span", "visually-hidden", "Valoración: "), estrella, document.createTextNode(juego.valoracion.toFixed(1)), elemento("span", "visually-hidden", " de 5"));
  meta.append(plataforma, rating);

  const titulo = elemento("h3");
  titulo.id = `juego-${juego.id}`;
  const detalles = elemento("button", "title-button", juego.titulo);
  detalles.type = "button";
  detalles.dataset.details = juego.id;
  detalles.setAttribute("aria-label", `Ver detalles de ${juego.titulo}`);
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
  if (!$('lista-juegos')) return;
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
  if (!lista) return;
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
  if (!$("carrito-feedback")) { avisar(mensaje, permitirDeshacer); return; }
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
  if ($("carrito")) renderizarCarrito();
  if ($("checkout")) renderizarCheckout();
  if (usuarioActual && $("perfil")) renderizarPerfil();
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
  if (!$("carrito")) return;
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

  const { subtotal, ahorro, total } = calcularTotales(juegos);
  $("carrito-subtotal").textContent = formatoPrecio(subtotal);
  $("carrito-ahorro").textContent = `−${formatoPrecio(ahorro)}`;
  $("fila-ahorro").hidden = ahorro === 0;
  $("carrito-total").replaceChildren(document.createTextNode(`${formatoPrecio(total)} `), elemento("small", "", "USD"));
}

function obtenerJuegosCarrito() {
  return [...estado.seleccion].map((id) => catalogo.find((juego) => juego.id === id)).filter(Boolean);
}

function calcularTotales(juegos) {
  const subtotal = juegos.reduce((acumulado, juego) =>
    acumulado + Math.max(juego.precioCentavos, juego.precioAnteriorCentavos || 0), 0);
  const ahorro = juegos.reduce((total, juego) => total + Math.max(0, (juego.precioAnteriorCentavos || juego.precioCentavos) - juego.precioCentavos), 0);
  const total = subtotal - ahorro;
  return { subtotal, ahorro, total };
}

function crearItemCheckout(juego) {
  const item = elemento("li", "checkout-item");
  const datos = elemento("div");
  datos.append(elemento("h3", "", juego.titulo), elemento("p", "", "Entrega digital inmediata"));
  item.append(crearImagen(juego), datos, elemento("strong", "", formatoPrecio(juego.precioCentavos)));
  return item;
}

function renderizarCheckout() {
  if (!$("checkout")) return;
  const juegos = obtenerJuegosCarrito();
  const { subtotal, ahorro, total } = calcularTotales(juegos);
  $("checkout-productos").replaceChildren(...juegos.map(crearItemCheckout));
  $("checkout-cantidad").textContent = `${juegos.length} ${juegos.length === 1 ? "juego" : "juegos"}`;
  $("checkout-subtotal").textContent = formatoPrecio(subtotal);
  $("checkout-ahorro").textContent = `−${formatoPrecio(ahorro)}`;
  $("checkout-fila-ahorro").hidden = ahorro === 0;
  $("checkout-total").textContent = formatoPrecio(total);
  $("pagar-total").textContent = formatoPrecio(total);
  $("pagar").disabled = juegos.length === 0;
  if (usuarioActual && !$("correo-entrega").value) $("correo-entrega").value = usuarioActual.email;
  $("error-formulario").hidden = juegos.length > 0;
  if (!juegos.length) $("error-formulario").textContent = "Tu carrito está vacío. Vuelve al catálogo para agregar un juego.";
}

function urlDeVista(vista, destino = null) {
  if (vista === "detalle") return `producto.html?id=${encodeURIComponent(destino)}`;
  if (vista === "ticket") return `ticket.html?id=${encodeURIComponent(destino)}`;
  if (vista === "inicio" && destino?.startsWith("#")) return `index.html${destino}`;
  return ARCHIVOS[vista] || "index.html";
}

function mostrarVista(vista, destino = null) {
  const paginaObjetivo = vista === "detalle" ? "producto" : vista === "cuenta" ? "login" : vista;
  if (PAGINA !== paginaObjetivo) {
    location.href = urlDeVista(vista, destino);
    return false;
  }
  document.body.dataset.view = vista;
  const titulo = $(`${vista === "detalle" ? "detalle" : vista === "cuenta" ? "cuenta" : vista}-titulo`);
  requestAnimationFrame(() => titulo?.focus({ preventScroll: true }));
  return true;
}

function abrirCheckout() {
  if (!estado.seleccion.size) return;
  if (!usuarioActual) {
    sessionStorage.setItem(CLAVE_RETORNO, "checkout.html");
    location.href = "login.html";
    return;
  }
  mostrarVista("checkout");
}

function abrirCarritoDialogo() {
  if ($("carrito-feedback")) $("carrito-feedback").hidden = true;
  mostrarVista("carrito");
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
  if (!$('confirmacion')) {
    if (pedido.id) sessionStorage.setItem('gamevault:ultimo-comprobante', JSON.stringify({ id: pedido.id }));
    location.href = "confirmacion.html";
    return;
  }
  $("juegos-entregados").replaceChildren(...pedido.juegos.map(crearJuegoEntregado));
  $("confirmacion-mensaje").textContent = `Pedido registrado para ${pedido.email}. Tus claves digitales están listas para copiar.`;
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
      p_total: calcularTotales(obtenerJuegosCarrito()).total };
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
  if (document.body.dataset.view === "carrito") avisarCarrito(mensaje, true);
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
  if (document.body.dataset.view === "carrito") avisarCarrito(mensaje);
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
        pedidos: pedidos.filter(p => p.estado === 'ENTREGADO').length, esAdmin: perfil.rol?.nombre === 'ADMIN',
        tipo: perfil.rol?.nombre === 'ADMIN' ? 'Administrador' : 'Cliente' };
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
  boton.href = usuarioActual ? "perfil.html" : "login.html";
  $("nav-admin").hidden = !usuarioActual?.esAdmin;
  if ($("perfil-admin")) $("perfil-admin").hidden = !usuarioActual?.esAdmin;
}

function renderizarPerfil() {
  if (!usuarioActual || !$("perfil")) return;
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
  if (!$("panel-login") || !$("panel-registro") || !$("tab-login") || !$("tab-registro")) return;
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
    mostrarVista("perfil");
  } else {
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
    form.reset(); $("estado-login").hidden = true;
    const retorno = sessionStorage.getItem(CLAVE_RETORNO);
    sessionStorage.removeItem(CLAVE_RETORNO);
    location.href = retorno && /^(checkout|perfil|ticket|admin)\.html(?:\?[^#]*)?$/.test(retorno) ? retorno : "perfil.html";
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
    if (session) { await cargarCuenta(user,true); actualizarSeleccion(); location.href = "perfil.html"; }
    else {
      $("estado-registro").textContent = "Revisa tu correo para confirmar la cuenta y después inicia sesión.";
      $("estado-registro").classList.add("is-success"); $("estado-registro").hidden = false;
    }
  } catch (error) { $("estado-registro").textContent = mensajeError(error); $("estado-registro").hidden = false; }
  finally { boton.disabled = false; cambiandoSesion = false; }
}
async function cerrarSesion() {
  $("cerrar-sesion").disabled = true; cambiandoSesion = true;
  try {
    await colaCarrito.catch(() => {});
    await api.salir(); await cargarCuenta(null); actualizarSeleccion();
    ultimoPedido = null;
    solicitudCompra = null; firmaCompra = null;
    sessionStorage.removeItem('gamevault:ultimo-comprobante'); sessionStorage.removeItem('gamevault:compra-pendiente');
    location.href = "login.html";
  } catch (error) { avisar(mensajeError(error)); }
  finally { $("cerrar-sesion").disabled = false; cambiandoSesion = false; }
}
// Accesible desde otro script clásico o desde la consola para la siguiente etapa.
window.agregarAlCarrito = agregarAlCarrito;

function abrirDialogo(titulo, contenido) {
  $("detalle-titulo").textContent = titulo;
  $("detalle-contenido").replaceChildren(contenido);
}
function mostrarDetalles(id) {
  const juego = catalogo.find((item) => item.id === Number(id));
  if (!juego) return;
  if (PAGINA !== "producto") { location.href = `producto.html?id=${encodeURIComponent(juego.id)}`; return; }
  const contenido = document.createDocumentFragment();
  const copia = elemento("div", "product-copy");
  const datos = elemento("dl", "product-facts");
  [["Plataforma", plataformas[juego.plataforma].nombre], ["Edición", juego.edicion], ["Formato", "Clave digital"], ["Región", juego.region], ["Estado", juego.disponible ? "Disponible" : "No disponible"]].forEach(([nombre, valor]) => datos.append(elemento("dt", "", nombre), elemento("dd", "", valor)));
  const agregar = elemento("button", "button button-primary", "Agregar al carrito");
  agregar.type = "button";
  agregar.dataset.add = juego.id;
  agregar.disabled = !juego.disponible;
  const aviso = elemento("p", "product-note", "Verifica la plataforma y la región antes de agregar el producto.");
  copia.append(elemento("p", "dialog-description", juego.descripcion), datos, crearPrecio(juego, "dialog-prices"), agregar, aviso);
  contenido.append(crearImagen(juego, "dialog-art"), copia);
  abrirDialogo(juego.titulo, contenido);
  actualizarBotonesAgregar();
  mostrarVista("detalle", juego.id);
  productoDetalleActual = juego.id;
  void cargarResenas(juego.id);
}

function fechaLegible(valor) {
  return new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeStyle: "short" }).format(new Date(valor));
}
function estadoVisible(valor) { return valor.replaceAll("_", " ").toLocaleLowerCase("es").replace(/^./, c => c.toLocaleUpperCase("es")); }

async function cargarResenas(idProducto) {
  const lista = $("lista-resenas"), formulario = $("resena-formulario");
  lista.replaceChildren(elemento("p", "loading-state", "Cargando reseñas…"));
  formulario.replaceChildren();
  try {
    const { id_videojuego: idJuego } = await api.idVideojuego(idProducto);
    const [resenas, resumen, propia] = await Promise.all([
      api.resenas(idJuego), api.resumenResenas(idJuego),
      usuarioActual ? api.resenaPropia(idJuego, usuarioActual.id) : Promise.resolve(null)
    ]);
    if (productoDetalleActual !== idProducto) return;
    resenaPropiaActual = propia;
    $("resenas-resumen").textContent = Number(resumen.total)
      ? `${Number(resumen.promedio).toFixed(1)} de 5 · ${resumen.total} ${Number(resumen.total) === 1 ? "reseña" : "reseñas"}`
      : "Sin reseñas";
    if (!usuarioActual) {
      const aviso = elemento("div", "review-form login-required");
      aviso.append(elemento("p", "", "Inicia sesión para publicar tu reseña. Tu nombre visible aparecerá junto a ella."));
      const enlace = elemento("a", "button button-secondary", "Iniciar sesión"); enlace.href = "login.html"; aviso.append(enlace); formulario.append(aviso);
    } else {
      const form = elemento("form", "review-form"); form.id = "formulario-resena";
      const titulo = elemento("h3", "", propia ? "Edita tu reseña" : "Escribe una reseña");
      const nota = elemento("p", "field-help", `Se publicará con el nombre visible «${usuarioActual.nombre}».`);
      const labelP = elemento("label", "", "Puntuación"); labelP.htmlFor = "resena-puntuacion";
      const puntos = elemento("select"); puntos.id = "resena-puntuacion";
      [5,4,3,2,1].forEach(n => { const o = elemento("option", "", `${n} ${n === 1 ? "estrella" : "estrellas"}`); o.value = n; puntos.append(o); });
      puntos.value = propia?.puntuacion || "5";
      const labelC = elemento("label", "", "Comentario"); labelC.htmlFor = "resena-comentario";
      const comentario = elemento("textarea"); comentario.id = "resena-comentario"; comentario.minLength = 10; comentario.maxLength = 2000; comentario.rows = 4; comentario.required = true; comentario.value = propia?.comentario || "";
      const acciones = elemento("div", "form-actions"); const guardar = elemento("button", "button button-primary", propia ? "Guardar cambios" : "Publicar reseña"); guardar.type = "submit"; acciones.append(guardar);
      if (propia) { const borrar = elemento("button", "button button-danger", "Eliminar mi reseña"); borrar.type = "button"; borrar.addEventListener("click", async () => { if (!confirm("¿Eliminar tu reseña?")) return; await ejecutarResena(() => api.eliminarResena(propia.id_resena), idProducto); }); acciones.append(borrar); }
      const estadoForm = elemento("p", "auth-status"); estadoForm.setAttribute("role", "alert"); estadoForm.hidden = true;
      form.append(titulo, nota, labelP, puntos, labelC, comentario, acciones, estadoForm);
      form.addEventListener("submit", async e => { e.preventDefault(); if (!form.reportValidity()) return; await ejecutarResena(() => propia ? api.editarResena(propia.id_resena, { puntuacion: Number(puntos.value), comentario: comentario.value.trim() }) : api.crearResena({ id_videojuego: idJuego, puntuacion: Number(puntos.value), comentario: comentario.value.trim() }), idProducto, guardar, estadoForm); });
      formulario.append(form);
    }
    lista.replaceChildren();
    if (!resenas.length) lista.append(elemento("p", "empty-inline", "Todavía no hay reseñas. Sé la primera persona en opinar."));
    resenas.forEach(r => {
      const articulo = elemento("article", "review-card");
      const cabecera = elemento("div", "review-card-heading"); cabecera.append(elemento("strong", "", r.autor), elemento("span", "review-stars", `${"★".repeat(r.puntuacion)}${"☆".repeat(5-r.puntuacion)}`));
      articulo.append(cabecera, elemento("p", "", r.comentario), elemento("time", "", fechaLegible(r.creado_en)));
      if (usuarioActual?.esAdmin || r.es_propia) { const borrar = elemento("button", "text-button danger-text", "Eliminar"); borrar.type = "button"; borrar.addEventListener("click", async () => { if (!confirm("¿Eliminar esta reseña?")) return; await ejecutarResena(() => api.eliminarResena(r.id_resena), idProducto); }); articulo.append(borrar); }
      lista.append(articulo);
    });
  } catch (error) { lista.replaceChildren(elemento("p", "error-state", mensajeError(error))); }
}
async function ejecutarResena(operacion, idProducto, boton = null, salida = null) {
  if (boton) boton.disabled = true;
  try { await operacion(); await cargarResenas(idProducto); }
  catch (error) { if (salida) { salida.textContent = mensajeError(error); salida.hidden = false; } else avisar(mensajeError(error)); }
  finally { if (boton) boton.disabled = false; }
}

async function cargarSoporte() {
  if (PAGINA !== "soporte") return;
  const sinSesion = !usuarioActual;
  $("soporte-sesion").hidden = !sinSesion; $("soporte-contenido").hidden = sinSesion;
  if (sinSesion) return;
  const selector = $("ticket-pedido"); selector.replaceChildren(new Option("Sin pedido relacionado", ""));
  historialPedidos.forEach(p => selector.append(new Option(`${p.numero} · ${formatoPrecio(p.total_centavos)}`, p.id_pedido)));
  await listarTickets();
}
async function listarTickets() {
  const lista = $("lista-tickets"); lista.replaceChildren(elemento("p", "loading-state", "Cargando tickets…"));
  try {
    const tickets = await api.tickets(); lista.replaceChildren();
    if (!tickets.length) lista.append(elemento("p", "empty-inline", "No hay tickets para mostrar."));
    tickets.forEach(t => {
      const enlace = elemento("a", "ticket-card"); enlace.href = `ticket.html?id=${encodeURIComponent(t.id_ticket)}`;
      const cabecera = elemento("div", "ticket-card-heading"); cabecera.append(elemento("strong", "", t.asunto), elemento("span", `status status-${t.estado.toLocaleLowerCase("es")}`, estadoVisible(t.estado)));
      enlace.append(cabecera, elemento("span", "", `${t.numero} · ${t.categoria} · ${fechaLegible(t.actualizado_en)}`)); lista.append(enlace);
    });
  } catch (error) { lista.replaceChildren(elemento("p", "error-state", mensajeError(error))); }
}
async function abrirTicket(id) {
  if (!usuarioActual) { sessionStorage.setItem(CLAVE_RETORNO, `ticket.html?id=${encodeURIComponent(id)}`); location.replace("login.html"); return; }
  const destino = $("ticket-detalle"); destino.replaceChildren(elemento("p", "loading-state", "Cargando conversación…"));
  try {
    const [ticket, mensajes] = await Promise.all([api.ticket(id), api.mensajesTicket(id)]);
    const frag = document.createDocumentFragment(); const cab = elemento("div", "view-heading ticket-heading"); const info = elemento("div"); const h = elemento("h1", "", ticket.asunto); h.id = "ticket-titulo"; h.tabIndex = -1; info.append(elemento("p", "eyebrow", ticket.numero), h, elemento("p", "", `${ticket.categoria} · ${fechaLegible(ticket.creado_en)}`)); cab.append(info);
    if (usuarioActual.esAdmin) { const select = elemento("select", "status-select"); ["ABIERTO","EN_PROCESO","RESUELTO","CERRADO"].forEach(e => select.append(new Option(estadoVisible(e), e))); select.value = ticket.estado; select.addEventListener("change", async () => { select.disabled = true; try { await api.cambiarEstadoTicket(ticket.id_ticket, select.value); await abrirTicket(ticket.id_ticket); } catch (error) { avisar(mensajeError(error)); } finally { select.disabled = false; } }); cab.append(select); }
    const desc = elemento("section", "ticket-description"); desc.append(elemento("h2", "", "Descripción inicial"), elemento("p", "", ticket.descripcion));
    const conversacion = elemento("section", "conversation"); conversacion.append(elemento("h2", "", "Conversación"));
    if (!mensajes.length) conversacion.append(elemento("p", "empty-inline", "Aún no hay respuestas."));
    mensajes.forEach(m => { const propioCliente = m.id_usuario === ticket.id_usuario; const mensaje = elemento("article", `message ${propioCliente ? "message-client" : "message-admin"}`); mensaje.append(elemento("strong", "", propioCliente ? "Cliente" : "Soporte"), elemento("p", "", m.mensaje), elemento("time", "", fechaLegible(m.creado_en))); conversacion.append(mensaje); });
    frag.append(cab, desc, conversacion);
    if (["ABIERTO","EN_PROCESO"].includes(ticket.estado)) { const form = elemento("form", "reply-form"); const label = elemento("label", "", "Nueva respuesta"); label.htmlFor = "respuesta-ticket"; const area = elemento("textarea"); area.id = "respuesta-ticket"; area.maxLength = 5000; area.rows = 4; area.required = true; const boton = elemento("button", "button button-primary", "Enviar respuesta"); boton.type = "submit"; form.append(label, area, boton); form.addEventListener("submit", async e => { e.preventDefault(); if (!form.reportValidity()) return; boton.disabled = true; try { await api.responderTicket(ticket.id_ticket, area.value.trim()); await abrirTicket(ticket.id_ticket); } catch (error) { avisar(mensajeError(error)); } finally { boton.disabled = false; } }); frag.append(form); }
    else frag.append(elemento("p", "closed-notice", "Este ticket está resuelto o cerrado y ya no admite respuestas."));
    destino.replaceChildren(frag); requestAnimationFrame(() => h.focus({ preventScroll: true }));
  } catch (error) { destino.replaceChildren(elemento("p", "error-state", mensajeError(error))); }
}

function adminEstado(mensaje, error = false) { const salida = $("admin-estado"); salida.textContent = mensaje; salida.classList.toggle("is-error", error); salida.hidden = false; }
async function cargarAdmin() {
  if (PAGINA !== "admin") return;
  const autorizado = Boolean(usuarioActual?.esAdmin);
  $("admin-denegado").hidden = autorizado; $("admin-contenido").hidden = !autorizado;
  if (!autorizado) return;
  try { datosAdmin = await api.adminCatalogo(); renderizarAdmin(); }
  catch (error) { adminEstado(mensajeError(error), true); }
}
function opcionTextoProducto(p) { const v = datosAdmin.videojuegos.find(x => x.id_videojuego === p.id_videojuego); return `#${p.id_producto} · ${v?.titulo || "Juego"} · ${p.edicion}`; }
function renderizarAdmin() {
  const juegoSel = $("admin-producto-juego"), catSel = $("admin-producto-categoria"), claveSel = $("admin-claves-producto");
  juegoSel.replaceChildren(...datosAdmin.videojuegos.map(v => new Option(v.titulo, v.id_videojuego)));
  catSel.replaceChildren(...datosAdmin.categorias.map(c => new Option(c.nombre, c.id_categoria)));
  claveSel.replaceChildren(...datosAdmin.productos.map(p => new Option(opcionTextoProducto(p), p.id_producto)));
  const juegos = $("admin-juegos"); juegos.replaceChildren(); datosAdmin.videojuegos.forEach(v => { const fila = elemento("article", "admin-record"); const texto = elemento("div"); texto.append(elemento("strong", "", v.titulo), elemento("span", "", `Editorial: ${Number(v.valoracion_referencia).toFixed(1)} · ID ${v.id_videojuego}`)); const acciones = elemento("div", "record-actions"); const editar = elemento("button", "text-button", "Editar"); editar.type="button"; editar.onclick=()=>rellenarJuego(v); const borrar=elemento("button","text-button danger-text","Eliminar"); borrar.type="button"; borrar.onclick=()=>eliminarAdmin("videojuego",v.id_videojuego,v.titulo); acciones.append(editar,borrar); fila.append(texto,acciones); juegos.append(fila); });
  const productos = $("admin-productos"); productos.replaceChildren(); datosAdmin.productos.forEach(p => { const stock=datosAdmin.claves.filter(k=>k.id_producto===p.id_producto&&k.estado==="DISPONIBLE").length; const fila=elemento("article","admin-record"); const texto=elemento("div"); texto.append(elemento("strong","",opcionTextoProducto(p)),elemento("span","",`${formatoPrecio(p.precio_centavos)} · ${p.publicado?"Publicado":"Oculto"} · Stock ${stock}`)); const acciones=elemento("div","record-actions"); const editar=elemento("button","text-button","Editar"); editar.type="button"; editar.onclick=()=>rellenarProducto(p); const borrar=elemento("button","text-button danger-text","Eliminar"); borrar.type="button"; borrar.onclick=()=>eliminarAdmin("producto",p.id_producto,opcionTextoProducto(p)); acciones.append(editar,borrar); fila.append(texto,acciones); productos.append(fila); });
  const categorias=$("admin-categorias"); categorias.replaceChildren(); datosAdmin.categorias.forEach(c=>{ const fila=elemento("label","admin-record check-row"); const check=document.createElement("input"); check.type="checkbox"; check.checked=c.activo; check.onchange=async()=>{check.disabled=true;try{await api.guardarCategoria(c.id_categoria,{activo:check.checked});await recargarAdmin("Plataforma actualizada.");}catch(error){adminEstado(mensajeError(error),true);check.checked=!check.checked;}finally{check.disabled=false;}}; fila.append(check,document.createTextNode(`${c.nombre} (${c.codigo})`)); categorias.append(fila); });
  const claves=$("admin-claves"); claves.replaceChildren(); const disponibles=datosAdmin.claves.filter(k=>k.estado==="DISPONIBLE");
  if(!disponibles.length)claves.append(elemento("p","empty-inline","No hay claves disponibles."));
  disponibles.forEach(k=>{const fila=elemento("article","admin-record");const texto=elemento("div");texto.append(elemento("strong","",k.codigo),elemento("span","",opcionTextoProducto(datosAdmin.productos.find(p=>p.id_producto===k.id_producto)||{id_producto:k.id_producto,edicion:""})));const borrar=elemento("button","text-button danger-text","Eliminar");borrar.type="button";borrar.onclick=async()=>{if(!confirm("¿Eliminar esta clave disponible?"))return;borrar.disabled=true;try{await api.eliminarClave(k.id_clave);await recargarAdmin("Clave disponible eliminada.");}catch(error){adminEstado(mensajeError(error),true);}finally{borrar.disabled=false;}};fila.append(texto,borrar);claves.append(fila);});
}
function rellenarJuego(v=null){$("formulario-videojuego").reset();$("admin-juego-id").value=v?.id_videojuego||"";$("admin-juego-titulo").value=v?.titulo||"";$("admin-juego-descripcion").value=v?.descripcion||"";$("admin-juego-valoracion").value=v?.valoracion_referencia??"";$("admin-juego-titulo").focus();}
function rellenarProducto(p=null){$("formulario-producto").reset();$("admin-producto-id").value=p?.id_producto||""; if(p){$("admin-producto-juego").value=p.id_videojuego;$("admin-producto-categoria").value=p.id_categoria;$("admin-producto-edicion").value=p.edicion;$("admin-producto-region").value=p.region;$("admin-producto-precio").value=(p.precio_centavos/100).toFixed(2);$("admin-producto-anterior").value=p.precio_anterior_centavos==null?"":(p.precio_anterior_centavos/100).toFixed(2);$("admin-producto-imagen").value=p.imagen_url;$("admin-producto-publicado").checked=p.publicado;}$("admin-producto-juego").focus();}
async function recargarAdmin(mensaje="Datos actualizados."){datosAdmin=await api.adminCatalogo();renderizarAdmin();catalogo=await obtenerVideojuegos();renderizarCatalogo();adminEstado(mensaje);}
async function eliminarAdmin(tipo,id,nombre){if(!confirm(`¿Eliminar ${nombre}? Esta acción puede rechazarse si existen productos, pedidos, reseñas o claves relacionados.`))return;try{await(tipo==="videojuego"?api.eliminarVideojuego(id):api.eliminarProducto(id));await recargarAdmin("Registro eliminado.");}catch(error){adminEstado("No se pudo eliminar: "+mensajeError(error),true);}}

function aplicarRuta() {
  if (!catalogo.length) return;
  const ruta = decodeURIComponent(location.hash || "#inicio");
  const producto = ruta.match(/^#producto\/(\d+)$/);
  if (producto) {
    const juego = catalogo.find((item) => item.id === Number(producto[1]));
    if (juego) { mostrarDetalles(juego.id); return; }
    history.replaceState(null, "", "#catalogo");
    mostrarVista("catalogo", "#catalogo", false);
    return;
  }
  if (ruta === "#carrito") { renderizarCarrito(); mostrarVista("carrito", null, false); return; }
  if (ruta === "#checkout") {
    if (estado.seleccion.size) { renderizarCheckout(); mostrarVista("checkout", null, false); return; }
    history.replaceState(null, "", "#carrito"); renderizarCarrito(); mostrarVista("carrito", null, false); return;
  }
  if (ruta === "#registro") { seleccionarAuthTab("registro"); mostrarVista("cuenta", null, false); return; }
  if (ruta === "#cuenta") { seleccionarAuthTab("login"); mostrarVista(usuarioActual ? "perfil" : "cuenta", null, false); return; }
  if (ruta === "#perfil") { mostrarVista(usuarioActual ? "perfil" : "cuenta", null, false); return; }
  if (ruta === "#soporte") { void cargarSoporte(); return; }
  const ticket = ruta.match(/^#ticket\/([0-9a-f-]+)$/i);
  if (ticket) { void abrirTicket(ticket[1]); return; }
  if (ruta === "#admin") { void cargarAdmin(); return; }
  if (ruta === "#confirmacion" && ultimoPedido) { mostrarVista("confirmacion", null, false); return; }
  if (ruta === "#catalogo") { mostrarVista("catalogo", "#catalogo", false); return; }
  const anclasInicio = new Set(["#inicio", "#oferta", "#ayuda", "#canjear", "#reembolso"]);
  const destino = anclasInicio.has(ruta) ? ruta : "#inicio";
  if (destino !== ruta) history.replaceState(null, "", destino);
  mostrarVista("inicio", destino, false);
}
function conectarEventos() {
  let temporizadorBusqueda;
  const buscar = () => { estado.busqueda = $("buscar").value.trim(); renderizarCatalogo(); };
  $("buscar").addEventListener("input", () => { clearTimeout(temporizadorBusqueda); temporizadorBusqueda = setTimeout(buscar, 220); });
  $("busqueda-form").addEventListener("submit", (evento) => { evento.preventDefault(); clearTimeout(temporizadorBusqueda); buscar(); mostrarVista("catalogo", "#catalogo"); });
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
      agregarAlCarrito(boton.dataset.add);
    }
    if (boton.dataset.details) mostrarDetalles(boton.dataset.details);
    if (boton.dataset.cartRemove) {
      quitarDeSeleccion(Number(boton.dataset.cartRemove));
      $("carrito-titulo").focus();
    }
  });
  $("abrir-carrito").addEventListener("click", abrirCarritoDialogo);
  $("cerrar-carrito-feedback").addEventListener("click", () => { $("carrito-feedback").hidden = true; $("carrito-titulo").focus(); });
  $("explorar-juegos").addEventListener("click", () => {
    requestAnimationFrame(() => $("buscar").focus({ preventScroll: true }));
  });
  $("vaciar-carrito").addEventListener("click", vaciarCarrito);
  $("continuar-pago").addEventListener("click", abrirCheckout);
  document.querySelectorAll("[data-show-store]").forEach((control) => control.addEventListener("click", (evento) => {
    evento.preventDefault();
    const destino = control.getAttribute("href") || "#inicio";
    mostrarVista(destino === "#catalogo" ? "catalogo" : "inicio", destino);
  }));
  document.querySelectorAll(".brand, .main-nav a, .footer-platforms a").forEach((enlace) => enlace.addEventListener("click", (evento) => {
    evento.preventDefault();
    const destino = enlace.getAttribute("href") || "#inicio";
    if (destino === "#catalogo" || destino === "#inicio" || destino === "#oferta") mostrarVista(destino === "#catalogo" ? "catalogo" : "inicio", destino);
    else { if (location.hash === destino) aplicarRuta(); else location.hash = destino; }
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
  [["tab-login", "login"], ["tab-registro", "registro"]].forEach(([id, tab]) => $(id).addEventListener("click", () => {
    seleccionarAuthTab(tab);
    const hash = tab === "registro" ? "#registro" : "#cuenta";
    if (location.hash !== hash) history.pushState(null, "", hash);
  }));
  $("cuenta").querySelector(".auth-tabs").addEventListener("keydown", (evento) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(evento.key)) return;
    evento.preventDefault();
    seleccionarAuthTab(evento.key === "ArrowLeft" || evento.key === "Home" ? "login" : "registro", true);
  });
  document.querySelectorAll("[data-auth-tab]").forEach((control) => control.addEventListener("click", () => {
    seleccionarAuthTab(control.dataset.authTab, true);
    history.pushState(null, "", control.dataset.authTab === "registro" ? "#registro" : "#cuenta");
  }));
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
  $("actualizar-tickets").addEventListener("click", listarTickets);
  $("formulario-ticket").addEventListener("submit", async evento => {
    evento.preventDefault(); const form=evento.currentTarget, boton=form.querySelector('[type="submit"]'), salida=$("ticket-form-estado");
    if(!form.reportValidity())return; boton.disabled=true; salida.hidden=true;
    try{const creado=await api.crearTicket({asunto:$("ticket-asunto").value.trim(),descripcion:$("ticket-descripcion").value.trim(),categoria:$("ticket-categoria").value,id_pedido:$("ticket-pedido").value||null});form.reset();location.hash=`#ticket/${creado.id_ticket}`;}
    catch(error){salida.textContent=mensajeError(error);salida.hidden=false;}finally{boton.disabled=false;}
  });
  $("recargar-admin").addEventListener("click", () => void cargarAdmin());
  $("nuevo-juego").addEventListener("click",()=>rellenarJuego()); $("nuevo-producto").addEventListener("click",()=>rellenarProducto());
  $("formulario-videojuego").addEventListener("submit",async evento=>{evento.preventDefault();const form=evento.currentTarget;if(!form.reportValidity())return;const boton=form.querySelector('[type="submit"]');boton.disabled=true;try{await api.guardarVideojuego(Number($("admin-juego-id").value)||null,{titulo:$("admin-juego-titulo").value.trim(),descripcion:$("admin-juego-descripcion").value.trim(),valoracion_referencia:Number($("admin-juego-valoracion").value)});rellenarJuego();await recargarAdmin("Videojuego guardado.");}catch(error){adminEstado(mensajeError(error),true);}finally{boton.disabled=false;}});
  $("formulario-producto").addEventListener("submit",async evento=>{evento.preventDefault();const form=evento.currentTarget;if(!form.reportValidity())return;const precio=Math.round(Number($("admin-producto-precio").value)*100),anteriorTexto=$("admin-producto-anterior").value,anterior=anteriorTexto?Math.round(Number(anteriorTexto)*100):null;if(anterior!==null&&anterior<=precio){adminEstado("El precio anterior debe ser mayor que el precio actual.",true);return;}const boton=form.querySelector('[type="submit"]');boton.disabled=true;try{await api.guardarProducto(Number($("admin-producto-id").value)||null,{id_videojuego:Number($("admin-producto-juego").value),id_categoria:Number($("admin-producto-categoria").value),edicion:$("admin-producto-edicion").value.trim(),region:$("admin-producto-region").value.trim(),precio_centavos:precio,precio_anterior_centavos:anterior,imagen_url:$("admin-producto-imagen").value.trim(),publicado:$("admin-producto-publicado").checked});rellenarProducto();await recargarAdmin("Producto guardado.");}catch(error){adminEstado(mensajeError(error),true);}finally{boton.disabled=false;}});
  $("formulario-claves").addEventListener("submit",async evento=>{evento.preventDefault();const form=evento.currentTarget;if(!form.reportValidity())return;const codigos=[...new Set($("admin-claves-codigos").value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean))];if(!codigos.length||codigos.some(x=>!x.startsWith("DEMO-")||x.length>120)){adminEstado("Cada clave debe empezar por DEMO-, ocupar una línea y tener hasta 120 caracteres.",true);return;}const boton=form.querySelector('[type="submit"]');boton.disabled=true;try{await api.agregarClaves(Number($("admin-claves-producto").value),codigos);form.reset();await recargarAdmin(`${codigos.length} claves añadidas.`);}catch(error){adminEstado(mensajeError(error),true);}finally{boton.disabled=false;}});
  document.querySelectorAll("[data-profile-store]").forEach((control) => control.addEventListener("click", () => mostrarVista("catalogo", "#catalogo")));
  addEventListener("hashchange", aplicarRuta);
  addEventListener("popstate", aplicarRuta);
  // <dialog> gestiona Escape y el fondo inerte. Refuerza el ciclo de Tab
  // para conservar el foco en los controles del diálogo entre navegadores.
  $("deshacer").addEventListener("click", () => {
    deshacerUltimaAccion();
    $("abrir-carrito").focus();
  });
  $("carrito-deshacer").addEventListener("click", () => { deshacerUltimaAccion(); $("carrito-titulo").focus(); });
  $("cerrar-aviso").addEventListener("click", () => { $("feedback").hidden = true; $("abrir-carrito").focus(); });
}

async function iniciarLegado() {
  conectarEventos();
  document.body.dataset.view = "cargando";
  actualizarMetodoPago();
  // Retira las credenciales y sesiones de la versión anterior.
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
    const destacado = catalogo[Math.floor(Math.random() * catalogo.length)];
    if (destacado) {
      $("hero-titulo").textContent = destacado.titulo;
      document.querySelector('.hero-art img').src = destacado.imagen;
      document.querySelector('.hero-art img').alt = `Portada del videojuego ${destacado.titulo}`;
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
    if (location.hash !== "#confirmacion") aplicarRuta();
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

// Inicialización multipágina: solo conecta controles presentes en el documento.
function conectarEventos() {
  const al = (id, evento, fn) => $(id)?.addEventListener(evento, fn);
  let temporizadorBusqueda;
  if ($("buscar")) {
    const parametros = new URLSearchParams(location.search);
    $("buscar").value = parametros.get("q") || "";
    al("busqueda-form", "submit", (evento) => {
      if (PAGINA !== "catalogo") return;
      evento.preventDefault();
      estado.busqueda = $("buscar").value.trim();
      history.pushState(null, "", estado.busqueda ? `?q=${encodeURIComponent(estado.busqueda)}` : "catalogo.html");
      renderizarCatalogo();
    });
    if (PAGINA === "catalogo") al("buscar", "input", () => {
      clearTimeout(temporizadorBusqueda);
      temporizadorBusqueda = setTimeout(() => { estado.busqueda = $("buscar").value.trim(); renderizarCatalogo(); }, 220);
    });
  }
  document.querySelectorAll("[data-platform]").forEach(boton => boton.addEventListener("click", () => filtrarPlataforma(boton.dataset.platform)));
  al("ordenar", "change", () => { estado.orden = $("ordenar").value; renderizarCatalogo(); });
  al("restablecer", "click", () => { $("buscar").value = ""; estado.busqueda = ""; estado.orden = "destacados"; $("ordenar").value = "destacados"; filtrarPlataforma("todos"); history.replaceState(null, "", "catalogo.html"); $("buscar").focus(); });
  al("anterior", "click", () => desplazarCatalogo(-1));
  al("siguiente", "click", () => desplazarCatalogo(1));
  al("lista-juegos", "scroll", actualizarFlechas);
  if ($("lista-juegos") && window.ResizeObserver) new ResizeObserver(actualizarFlechas).observe($("lista-juegos"));

  document.addEventListener("click", (evento) => {
    const copiar = evento.target.closest("button[data-copy-code]");
    if (copiar) {
      const salida = copiar.parentElement.nextElementSibling;
      navigator.clipboard?.writeText(copiar.dataset.copyCode).then(() => { salida.textContent = "Código copiado."; }).catch(() => { salida.textContent = "Selecciona el código manualmente."; });
      return;
    }
    const boton = evento.target.closest("button[data-add], button[data-details], button[data-cart-remove]");
    if (!boton) return;
    if (boton.dataset.add) agregarAlCarrito(boton.dataset.add);
    if (boton.dataset.details) mostrarDetalles(boton.dataset.details);
    if (boton.dataset.cartRemove) quitarDeSeleccion(Number(boton.dataset.cartRemove));
  });
  al("cerrar-aviso", "click", () => { $("feedback").hidden = true; });
  al("deshacer", "click", deshacerUltimaAccion);
  al("cerrar-carrito-feedback", "click", () => { $("carrito-feedback").hidden = true; });
  al("carrito-deshacer", "click", deshacerUltimaAccion);
  al("vaciar-carrito", "click", vaciarCarrito);
  al("continuar-pago", "click", abrirCheckout);

  document.querySelectorAll('input[name="metodo"]').forEach(radio => radio.addEventListener("change", actualizarMetodoPago));
  al("numero-tarjeta", "input", evento => { const d = evento.target.value.replace(/\D/g, "").slice(0, 19); evento.target.value = d.replace(/(.{4})/g, "$1 ").trim(); });
  al("fecha-tarjeta", "input", evento => { const d = evento.target.value.replace(/\D/g, "").slice(0, 4); evento.target.value = d.length > 2 ? `${d.slice(0, 2)} / ${d.slice(2)}` : d; });
  al("cvv-tarjeta", "input", evento => { evento.target.value = evento.target.value.replace(/\D/g, "").slice(0, 4); });
  al("formulario-pago", "submit", evento => {
    evento.preventDefault();
    if (!estado.seleccion.size) { $("error-formulario").textContent = "Tu carrito está vacío. Vuelve al catálogo para agregar un juego."; $("error-formulario").hidden = false; return; }
    if (!validarCheckout()) { $("error-formulario").textContent = "Revisa los campos marcados antes de continuar."; $("error-formulario").hidden = false; $("formulario-pago").querySelector(":invalid")?.focus(); return; }
    $("error-formulario").hidden = true; void finalizarCompra();
  });

  document.querySelectorAll("[data-toggle-password]").forEach(control => control.addEventListener("click", () => { const campo = $(control.dataset.togglePassword); const mostrar = campo.type === "password"; campo.type = mostrar ? "text" : "password"; control.textContent = mostrar ? "Ocultar" : "Mostrar"; control.setAttribute("aria-pressed", String(mostrar)); campo.focus(); }));
  al("formulario-login", "submit", evento => { evento.preventDefault(); void iniciarSesion(); });
  al("formulario-registro", "submit", evento => { evento.preventDefault(); void registrarCuenta(); });
  al("cerrar-sesion", "click", cerrarSesion);
  al("actualizar-tickets", "click", listarTickets);
  al("formulario-ticket", "submit", async evento => {
    evento.preventDefault(); const form = evento.currentTarget, boton = form.querySelector('[type="submit"]'), salida = $("ticket-form-estado");
    if (!form.reportValidity()) return; boton.disabled = true; salida.hidden = true;
    try { const creado = await api.crearTicket({ asunto: $("ticket-asunto").value.trim(), descripcion: $("ticket-descripcion").value.trim(), categoria: $("ticket-categoria").value, id_pedido: $("ticket-pedido").value || null }); location.href = `ticket.html?id=${encodeURIComponent(creado.id_ticket)}`; }
    catch (error) { salida.textContent = mensajeError(error); salida.hidden = false; } finally { boton.disabled = false; }
  });
  al("recargar-admin", "click", cargarAdmin);
  al("nuevo-juego", "click", () => rellenarJuego());
  al("nuevo-producto", "click", () => rellenarProducto());
  al("formulario-videojuego", "submit", async evento => { evento.preventDefault(); const form=evento.currentTarget;if(!form.reportValidity())return;const boton=form.querySelector('[type="submit"]');boton.disabled=true;try{await api.guardarVideojuego(Number($("admin-juego-id").value)||null,{titulo:$("admin-juego-titulo").value.trim(),descripcion:$("admin-juego-descripcion").value.trim(),valoracion_referencia:Number($("admin-juego-valoracion").value)});rellenarJuego();await recargarAdmin("Videojuego guardado.");}catch(error){adminEstado(mensajeError(error),true);}finally{boton.disabled=false;} });
  al("formulario-producto", "submit", async evento => { evento.preventDefault();const form=evento.currentTarget;if(!form.reportValidity())return;const precio=Math.round(Number($("admin-producto-precio").value)*100),texto=$("admin-producto-anterior").value,anterior=texto?Math.round(Number(texto)*100):null;if(anterior!==null&&anterior<=precio){adminEstado("El precio anterior debe ser mayor que el actual.",true);return;}const boton=form.querySelector('[type="submit"]');boton.disabled=true;try{await api.guardarProducto(Number($("admin-producto-id").value)||null,{id_videojuego:Number($("admin-producto-juego").value),id_categoria:Number($("admin-producto-categoria").value),edicion:$("admin-producto-edicion").value.trim(),region:$("admin-producto-region").value.trim(),precio_centavos:precio,precio_anterior_centavos:anterior,imagen_url:$("admin-producto-imagen").value.trim(),publicado:$("admin-producto-publicado").checked});rellenarProducto();await recargarAdmin("Producto guardado.");}catch(error){adminEstado(mensajeError(error),true);}finally{boton.disabled=false;} });
  al("formulario-claves", "submit", async evento => { evento.preventDefault();const form=evento.currentTarget;if(!form.reportValidity())return;const codigos=[...new Set($("admin-claves-codigos").value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean))];if(!codigos.length||codigos.some(x=>!x.startsWith("DEMO-")||x.length>120)){adminEstado("Cada clave debe empezar por DEMO-.",true);return;}const boton=form.querySelector('[type="submit"]');boton.disabled=true;try{await api.agregarClaves(Number($("admin-claves-producto").value),codigos);form.reset();await recargarAdmin(`${codigos.length} claves añadidas.`);}catch(error){adminEstado(mensajeError(error),true);}finally{boton.disabled=false;} });
  addEventListener("popstate", () => { if (PAGINA === "catalogo") { estado.busqueda = new URLSearchParams(location.search).get("q") || ""; $("buscar").value = estado.busqueda; renderizarCatalogo(); } });
}

async function aplicarRuta() {
  const parametros = new URLSearchParams(location.search);
  if (PAGINA === "catalogo") {
    estado.busqueda = parametros.get("q") || "";
    const plataforma = parametros.get("plataforma");
    if (plataforma && Object.hasOwn(plataformas, plataforma)) estado.plataforma = plataforma;
    renderizarCatalogo();
  } else if (PAGINA === "producto") {
    const id = Number(parametros.get("id"));
    const juego = catalogo.find(item => item.id === id);
    if (juego) mostrarDetalles(id);
    else { $("producto-no-encontrado").hidden = false; $("detalle-contenido").hidden = true; $("resenas").hidden = true; $("detalle-titulo").textContent = "Producto no encontrado"; }
  } else if (PAGINA === "carrito") renderizarCarrito();
  else if (PAGINA === "checkout") {
    if (!estado.seleccion.size) { renderizarCheckout(); $("error-formulario").hidden = false; $("error-formulario").textContent = "Tu carrito está vacío. Agrega un producto antes de continuar."; }
    else if (!usuarioActual) { sessionStorage.setItem(CLAVE_RETORNO, "checkout.html"); location.replace("login.html"); }
    else { renderizarCheckout(); actualizarMetodoPago(); }
  } else if (PAGINA === "confirmacion") {
    const ref = JSON.parse(sessionStorage.getItem('gamevault:ultimo-comprobante') || 'null');
    if (!ref?.id) { $("confirmacion").querySelector(".confirmation-card").hidden = true; $("confirmacion-no-disponible").hidden = false; }
    else try { renderizarConfirmacion(await api.pedido(ref.id, ref.token)); } catch (error) { $("confirmacion").querySelector(".confirmation-card").hidden = true; $("confirmacion-no-disponible").hidden = false; }
  } else if (PAGINA === "perfil") {
    if (!usuarioActual) { sessionStorage.setItem(CLAVE_RETORNO, "perfil.html"); location.replace("login.html"); } else renderizarPerfil();
  } else if (PAGINA === "soporte") await cargarSoporte();
  else if (PAGINA === "ticket") {
    const id = parametros.get("id");
    if (!id) $("ticket-detalle").replaceChildren(elemento("p", "error-state", "No se indicó un ticket válido.")); else await abrirTicket(id);
  } else if (PAGINA === "admin") await cargarAdmin();
}

async function iniciar() {
  conectarEventos();
  localStorage.removeItem('gamevault:sesion'); sessionStorage.removeItem('gamevault:cuenta-temporal');
  if (!localStorage.getItem(CLAVE_CARRITO) && localStorage.getItem('gamevault:carrito')) { localStorage.setItem(CLAVE_CARRITO, localStorage.getItem('gamevault:carrito')); localStorage.removeItem('gamevault:carrito'); }
  try {
    const datos = await obtenerVideojuegos();
    const ids = new Set();
    if (!Array.isArray(datos) || !datos.every(juego => { const valido = Number.isSafeInteger(juego.id) && !ids.has(juego.id) && typeof juego.titulo === "string" && typeof juego.descripcion === "string" && Object.hasOwn(plataformas, juego.plataforma) && Number.isSafeInteger(juego.precioCentavos); ids.add(juego.id); return valido; })) throw new Error("Formato de catálogo no válido");
    catalogo = datos; restaurarCarrito();
    try { await cargarCuenta((await api.sesion())?.user); } catch (error) { avisar("No pudimos recuperar tu cuenta: " + mensajeError(error)); }
    actualizarCuentaUI(); actualizarSeleccion();
    document.querySelectorAll("[data-platform], #ordenar").forEach(control => { control.disabled = false; });
    if (PAGINA === "inicio") {
      const destacado = catalogo[Math.floor(Math.random() * catalogo.length)];
      if (destacado) { $("hero-titulo").textContent = destacado.titulo; const imagen = document.querySelector('.hero-art img'); imagen.src = destacado.imagen; imagen.alt = `Portada del videojuego ${destacado.titulo}`; $("hero-descripcion").textContent = destacado.descripcion; const precio=crearPrecio(destacado,"hero-price");precio.id="hero-precio";$("hero-precio").replaceWith(precio);$("hero-agregar").dataset.add=destacado.id;$("hero-agregar").disabled=!destacado.disponible;$("hero-detalles").dataset.details=destacado.id;$("hero-detalles").disabled=false; }
    }
    $("anio").textContent = new Date().getFullYear();
    await aplicarRuta();
    api.onAuth((event, session) => { if (cambiandoSesion || (session?.user?.id || null) === (usuarioActual?.id || null)) return; setTimeout(() => location.reload(), 0); });
  } catch (error) {
    if ($("resultados")) $("resultados").textContent = "No pudimos cargar el catálogo. Recarga la página para intentarlo de nuevo.";
    else avisar("No pudimos cargar GameVault: " + mensajeError(error));
    console.error(error);
  }
}

iniciar();
