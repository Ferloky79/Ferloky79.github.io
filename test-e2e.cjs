"use strict";

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const port = 9333;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "gamevault-e2e-"));
const pageUrl = `file:///${path.resolve("index.html").replace(/\\/g, "/").replace(/ /g, "%20")}`;
const results = [];
const browserErrors = [];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function record(name, passed, detail = "") {
  results.push({ name, passed: Boolean(passed), detail: detail || "" });
  if (!passed) throw new Error(`${name}: ${detail}`);
}
function contrast(foreground, background) {
  const luminance = (hex) => {
    const channels = hex.match(/[a-f\d]{2}/gi).map((value) => parseInt(value, 16) / 255).map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
  };
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
}

class CDP {
  constructor(socket) {
    this.socket = socket;
    this.id = 0;
    this.pending = new Map();
    socket.onmessage = ({ data }) => {
      const message = JSON.parse(data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message)); else resolve(message.result);
      }
      if (message.method === "Runtime.exceptionThrown") browserErrors.push(message.params.exceptionDetails.text || "Excepción de JavaScript");
      if (message.method === "Log.entryAdded" && message.params.entry.level === "error") browserErrors.push(message.params.entry.text);
    };
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  }
}

async function connect(url) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = () => reject(new Error("No se pudo conectar con Chrome DevTools"));
  });
  return new CDP(socket);
}

async function waitFor(test, timeout = 5000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await test()) return;
    await delay(50);
  }
  throw new Error("Tiempo de espera agotado");
}

async function run() {
  const chrome = spawn(chromePath, [
    "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--window-size=1440,1000", pageUrl
  ], { windowsHide: true, stdio: "ignore" });
  try {
    let targets;
    await waitFor(async () => {
      try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); return targets.length > 0; }
      catch { return false; }
    }, 10000);
    const cdp = await connect(targets.find((target) => target.type === "page").webSocketDebuggerUrl);
    await cdp.send("Runtime.enable");
    await cdp.send("Log.enable");
    await cdp.send("Page.enable");
    await waitFor(() => cdp.evaluate("document.readyState === 'complete' && document.querySelectorAll('.game-card').length > 0"));

    const evaluate = (fn, ...args) => cdp.evaluate(`(${fn.toString()})(${args.map((arg) => JSON.stringify(arg)).join(",")})`);
    const click = async (selector) => { await evaluate((value) => { const node = document.querySelector(value); if (!node) throw new Error(`No existe ${value}`); node.click(); }, selector); await delay(80); };
    const fill = (selector, value) => evaluate((target, text) => { const node = document.querySelector(target); node.value = text; node.dispatchEvent(new Event("input", { bubbles: true })); node.dispatchEvent(new Event("change", { bubbles: true })); }, selector, value);
    const submit = async (selector) => { await evaluate((value) => document.querySelector(value).requestSubmit(), selector); await delay(100); };
    const visible = (selector) => evaluate((value) => { const node = document.querySelector(value); return Boolean(node && !node.hidden && getComputedStyle(node).display !== "none"); }, selector);
    const text = (selector) => evaluate((value) => document.querySelector(value)?.textContent.trim() || "", selector);
    const accessibleAudit = () => evaluate(() => {
      const visibleNode = (node) => node.getClientRects().length > 0 && getComputedStyle(node).visibility !== "hidden";
      const controls = [...document.querySelectorAll("button, a[href], input, select, summary")].filter(visibleNode);
      const unnamed = controls.filter((node) => {
        if (node.matches('input[type="hidden"]')) return false;
        const labels = node.labels ? [...node.labels].map((label) => label.innerText).join(" ") : "";
        return !(node.getAttribute("aria-label") || node.getAttribute("aria-labelledby") || labels || node.innerText || node.title || node.placeholder || node.value).trim();
      }).map((node) => node.outerHTML.slice(0, 140));
      const tooSmall = controls.filter((node) => !node.matches('a, input[type="radio"], input[type="checkbox"], .visually-hidden-focusable:not(:focus)')).filter((node) => { const box = node.getBoundingClientRect(); return box.width < 24 || box.height < 24; }).map((node) => `${node.tagName.toLowerCase()}#${node.id || ""}:${Math.round(node.getBoundingClientRect().width)}x${Math.round(node.getBoundingClientRect().height)}`);
      return { unnamed, tooSmall };
    });
    const semanticAudit = () => evaluate(() => {
      const visibleNode = (node) => node.getClientRects().length > 0 && getComputedStyle(node).visibility !== "hidden";
      return {
        visibleH1: [...document.querySelectorAll("h1")].filter(visibleNode).length,
        imagesWithoutAlt: [...document.querySelectorAll("img:not([alt])")].filter(visibleNode).length,
        unlabeledFields: [...document.querySelectorAll("input:not([type=hidden]), select")].filter(visibleNode).filter((node) => !(node.labels?.length || node.getAttribute("aria-label") || node.getAttribute("aria-labelledby"))).length
      };
    });

    record("Catálogo completo", await evaluate(() => document.querySelectorAll(".game-card").length) === 13, "Se esperaban 13 juegos");
    await evaluate(() => { document.querySelectorAll("img").forEach((image) => { image.loading = "eager"; }); window.scrollTo(0, document.body.scrollHeight); });
    await waitFor(() => evaluate(() => [...document.images].every((image) => image.complete)), 10000);
    const brokenImages = await evaluate(() => [...document.images].filter((image) => !image.naturalWidth).map((image) => image.src));
    record("Imágenes válidas", brokenImages.length === 0, brokenImages.join(", "));
    let audit = await accessibleAudit();
    record("Controles nombrados en catálogo", audit.unnamed.length === 0, audit.unnamed.join(" | "));
    record("Tamaño mínimo de controles en catálogo", audit.tooSmall.length === 0, audit.tooSmall.join(" | "));
    let semantics = await semanticAudit();
    record("Estructura semántica del catálogo", semantics.visibleH1 === 1 && semantics.imagesWithoutAlt === 0 && semantics.unlabeledFields === 0, JSON.stringify(semantics));
    const contrastPairs = [["#f7f8fc", "#08090d"], ["#aeb5c8", "#08090d"], ["#ffffff", "#2465d6"], ["#231003", "#ff963f"], ["#073528", "#00d49c"], ["#92f6dc", "#15221e"], ["#ffb3b3", "#10121c"]];
    const failedContrast = contrastPairs.map(([fg, bg]) => ({ fg, bg, ratio: contrast(fg, bg) })).filter((pair) => pair.ratio < 4.5);
    record("Contraste AA de tokens de texto", failedContrast.length === 0, JSON.stringify(failedContrast));

    await click('[data-platform="ps5"]');
    record("Filtro PS5", await evaluate(() => document.querySelectorAll(".game-card").length) === 6);
    await fill("#buscar", "Zelda");
    await delay(300);
    record("Búsqueda combinada", await evaluate(() => document.querySelectorAll(".game-card").length) === 0, "PS5 + Zelda debe producir cero resultados");
    await click("#restablecer");
    record("Restablecer búsqueda", await evaluate(() => document.querySelectorAll(".game-card").length) === 13);
    await evaluate(() => { const select = document.querySelector("#ordenar"); select.value = "precio-desc"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    record("Orden por mayor precio", (await text(".game-card .current-price")).includes("$69.99"));
    await click('[data-details="7"]');
    record("Detalles de producto", await evaluate(() => document.querySelector("#dialogo").open) && await text("#dialogo-titulo") === "God of War Ragnarök");
    await click("#cerrar-dialogo");

    await click('[data-add="1"]');
    await click('[data-add="1"]');
    record("Prevención de duplicados", await text("#contador-carrito") === "1" && (await text("#mensaje")).includes("ya está"));
    await click('[data-add="6"]');
    record("Agregar al carrito", await text("#contador-carrito") === "2");
    await click("#abrir-carrito");
    record("Carrito con dos productos", await evaluate(() => document.querySelectorAll(".cart-item").length) === 2);
    await click(".cart-remove");
    record("Aviso al quitar", await visible("#carrito-feedback") && await text("#contador-carrito") === "1");
    await click("#carrito-deshacer");
    record("Deshacer eliminación", await text("#contador-carrito") === "2" && await evaluate(() => document.querySelectorAll(".cart-item").length) === 2);
    await click("#vaciar-carrito");
    record("Vaciar carrito", await text("#contador-carrito") === "0" && await visible("#carrito-vacio"));
    await click("#carrito-deshacer");
    record("Deshacer vaciado", await text("#contador-carrito") === "2" && await evaluate(() => document.querySelectorAll(".cart-item").length) === 2);
    audit = await accessibleAudit();
    record("Controles nombrados en carrito", audit.unnamed.length === 0, audit.unnamed.join(" | "));
    await click("#cerrar-carrito");

    await click("#abrir-cuenta");
    record("Vista de inicio de sesión", await visible("#cuenta"));
    audit = await accessibleAudit();
    record("Controles nombrados en acceso", audit.unnamed.length === 0, audit.unnamed.join(" | "));
    await submit("#formulario-login");
    record("Validación del inicio de sesión", await evaluate(() => document.querySelector("#login-email").getAttribute("aria-invalid") === "true"));
    await click('[data-toggle-password="login-clave"]');
    record("Mostrar contraseña", await evaluate(() => document.querySelector("#login-clave").type === "text"));
    await click('[data-toggle-password="login-clave"]');
    await click("#usar-cuenta-prueba");
    await submit("#formulario-login");
    record("Inicio con usuario de prueba", await visible("#perfil") && await text("#perfil-email") === "demo@gamevault.com");
    await click("#cerrar-sesion");
    await click("#tab-registro");
    await submit("#formulario-registro");
    record("Validación del registro", await evaluate(() => document.querySelector("#registro-nombre").getAttribute("aria-invalid") === "true") && (await text("#error-registro-condiciones")).length > 0);
    await fill("#registro-nombre", "Usuario Nuevo");
    await fill("#registro-email", "nuevo@ejemplo.com");
    await fill("#registro-clave", "Prueba123");
    await fill("#registro-confirmar", "Prueba123");
    await click("#registro-condiciones");
    await submit("#formulario-registro");
    record("Registro y perfil", await visible("#perfil") && await text("#perfil-email") === "nuevo@ejemplo.com");
    await click("#cerrar-sesion");
    await fill("#login-email", "nuevo@ejemplo.com");
    await fill("#login-clave", "Prueba123");
    await submit("#formulario-login");
    record("Reingreso con cuenta creada", await visible("#perfil"));
    await cdp.send("Page.reload", { ignoreCache: true });
    await waitFor(() => cdp.evaluate("document.readyState === 'complete' && document.querySelectorAll('.game-card').length === 13"));
    await delay(100);
    await click("#abrir-cuenta");
    record("Persistencia de sesión al recargar", await visible("#perfil") && await text("#perfil-email") === "nuevo@ejemplo.com");
    await click("[data-profile-store]");

    await click("#abrir-carrito");
    await click("#continuar-pago");
    record("Navegación al checkout", await visible("#checkout") && await evaluate(() => document.querySelectorAll(".checkout-item").length) === 2);
    await click("[data-open-cart]");
    await click("#cerrar-carrito");
    record("El carrito conserva el contexto del checkout", await visible("#checkout"));
    await click('input[value="paypal"]');
    record("Cambio a PayPal", await visible("#info-paypal") && !(await visible("#campos-tarjeta")));
    await click('input[value="tarjeta"]');
    await submit("#formulario-pago");
    record("Validación del checkout", !(await visible("#error-formulario")) === false && (await text("#error-formulario")).length > 0);
    await fill("#correo-entrega", "nuevo@ejemplo.com");
    await fill("#numero-tarjeta", "4242424242424242");
    await fill("#fecha-tarjeta", "1230");
    await fill("#cvv-tarjeta", "123");
    await submit("#formulario-pago");
    record("Confirmación de compra", await visible("#confirmacion") && await evaluate(() => document.querySelectorAll(".delivered-game").length) === 2);
    record("Carrito vacío después de confirmar", await text("#contador-carrito") === "0");
    await click("[data-copy-code]");
    record("Respuesta al copiar código", (await text(".copy-feedback")).length > 0);
    audit = await accessibleAudit();
    record("Controles nombrados en confirmación", audit.unnamed.length === 0, audit.unnamed.join(" | "));
    semantics = await semanticAudit();
    record("Estructura semántica de confirmación", semantics.visibleH1 === 1 && semantics.imagesWithoutAlt === 0 && semantics.unlabeledFields === 0, JSON.stringify(semantics));
    await click(".confirmation-home");
    await click("#abrir-cuenta");
    record("Pedido reflejado en perfil", await text("#perfil-pedidos") === "1");
    await click("[data-profile-store]");

    for (const [width, height] of [[1440, 1000], [1024, 900], [768, 900], [390, 844], [320, 700]]) {
      await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600 });
      await delay(100);
      const overflow = await evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
      record(`Sin desbordamiento horizontal a ${width}px`, overflow.scroll <= overflow.client + 1, `${overflow.scroll}/${overflow.client}`);
    }
    await cdp.send("Emulation.clearDeviceMetricsOverride");
    record("Sin errores de navegador", browserErrors.length === 0, browserErrors.join(" | "));

    console.log(JSON.stringify({ passed: results.filter((item) => item.passed).length, failed: results.filter((item) => !item.passed).length, results }, null, 2));
    cdp.socket.close();
  } finally {
    chrome.kill();
    if (chrome.exitCode === null) await Promise.race([new Promise((resolve) => chrome.once("exit", resolve)), delay(3000)]);
    try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 }); }
    catch { /* Chrome puede retener archivos temporales unos segundos en Windows. */ }
  }
}

run().catch((error) => {
  console.error(JSON.stringify({ error: error.message, passedBeforeFailure: results }, null, 2));
  process.exitCode = 1;
});
