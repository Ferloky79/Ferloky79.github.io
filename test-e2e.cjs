'use strict';
// Recorrido E2E con API controlada: todas las escrituras son locales al navegador.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const catalogo = require('./tests/fixtures/catalogo.json');
const root = __dirname;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const file = path.join(root, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  try {
    const mime = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.jpg': 'image/jpeg', '.avif': 'image/avif' }[path.extname(file)];
    if (mime) res.setHeader('Content-Type', mime);
    res.end(fs.readFileSync(file));
  } catch { res.writeHead(404).end(); }
});

const mock = `
window.GameVaultAPI = (() => {
 const games = ${JSON.stringify(catalogo)};
 const get = (key, fallback) => JSON.parse(localStorage.getItem('qa:'+key) || JSON.stringify(fallback));
 const set = (key, value) => { localStorage.setItem('qa:'+key, JSON.stringify(value)); return value; };
 const current = () => get('user', null);
 return {
  catalogo: async () => games,
  sesion: async () => current() ? {user:current()} : null,
  login: async (email,password) => { if(password!=='Prueba123') throw Error('Invalid login credentials'); const user={id:email.startsWith('admin')?'qa-admin':'qa-user',email};set('user',user);return {user}; },
  registro: async () => ({user:{id:'qa-new'},session:null}), salir: async () => set('user',null),
  perfil: async () => {const u=current();return {nombre:u.email.startsWith('admin')?'Admin QA':'Usuario QA',activo:true,creado_en:'2026-10-26T10:00:00Z',rol:{nombre:u.email.startsWith('admin')?'ADMIN':'CLIENTE'}};},
  pedidos: async () => get('orders',[]).map(o=>({id_pedido:o.id,numero:o.numero,total_centavos:o.total,estado:o.estado})),
  carrito: async () => get('cart',[]), guardarCarrito: async ids => set('cart',ids),
  comprar: async s => {let orders=get('orders',[]);let order=orders.find(o=>o.id===s.p_id);if(order)return order;order={id:s.p_id,numero:'GV-QA',total:s.p_total,email:s.p_correo,metodo:s.p_metodo==='paypal'?'PayPal (demo)':'Tarjeta (demo)',estado:'ENTREGADO',juegos:s.p_ids.map(id=>({...games.find(g=>g.id===id),codigo:'DEMO-QA-'+id}))};orders.push(order);set('orders',orders);set('cart',[]);return order;},
  pedido: async id => {const order=get('orders',[]).find(o=>o.id===id);if(!order)throw Error('Pedido no disponible');return order;},
  idVideojuego: async id => ({id_videojuego:id}), resenas:async()=>[], resumenResenas:async()=>({total:0,promedio:null}), resenaPropia:async()=>null,
  crearResena:async()=>({}),editarResena:async()=>({}),eliminarResena:async()=>({}),
  tickets: async () => get('tickets',[]), ticket: async id => {const t=get('tickets',[]).find(x=>x.id_ticket===id);if(!t)throw Error('Ticket no disponible');return t;},
  crearTicket: async d => {const t={...d,id_ticket:'11111111-1111-4111-8111-111111111111',id_usuario:current().id,numero:'TK-QA',estado:'ABIERTO',creado_en:new Date().toISOString(),actualizado_en:new Date().toISOString()};set('tickets',[...get('tickets',[]),t]);return t;},
  mensajesTicket:async()=>[],responderTicket:async()=>({}),cambiarEstadoTicket:async()=>({}),
  adminCatalogo: async () => ({videojuegos:games.map(g=>({id_videojuego:g.id,titulo:g.titulo,descripcion:g.descripcion,valoracion_referencia:g.valoracion})),productos:games.map(g=>({id_producto:g.id,id_videojuego:g.id,id_categoria:g.plataforma==='ps5'?1:g.plataforma==='xbox'?2:3,edicion:g.edicion,region:g.region,precio_centavos:g.precioCentavos,precio_anterior_centavos:g.precioAnteriorCentavos,imagen_url:g.imagen,publicado:true})),categorias:[{id_categoria:1,codigo:'ps5',nombre:'PlayStation 5',activo:true},{id_categoria:2,codigo:'xbox',nombre:'Xbox',activo:true},{id_categoria:3,codigo:'switch',nombre:'Switch',activo:true}],claves:[]}),
  guardarVideojuego:async()=>({}),eliminarVideojuego:async()=>({}),guardarProducto:async()=>({}),eliminarProducto:async()=>({}),guardarCategoria:async()=>({}),agregarClaves:async()=>[],eliminarClave:async()=>({}),onAuth:()=>({})
 };
})();`;

async function esperar(page, pagina) {
  await page.waitForFunction(p => document.body.dataset.page === p && document.querySelector('#contador-carrito'), pagina);
}

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/supabase-api.js', route => route.fulfill({ contentType: 'text/javascript', body: mock }));

    // Las ocho páginas mínimas responden directamente por URL.
    for (const file of ['index.html','catalogo.html','producto.html?id=1','carrito.html','checkout.html','confirmacion.html','login.html','registro.html']) {
      const response = await page.goto(`${base}/${file}`);
      assert.equal(response.status(), 200, file);
      assert.ok(await page.locator('main#contenido').count(), file);
    }

    // Salidas claras para entradas directas inválidas o sin estado previo.
    await page.goto(`${base}/producto.html?id=999999`); await esperar(page, 'producto');
    await page.waitForFunction(() => !document.querySelector('#producto-no-encontrado').hidden);
    assert.match(await page.locator('#producto-no-encontrado').textContent(), /no encontrado/i);
    await page.goto(`${base}/checkout.html`); await esperar(page, 'checkout');
    await page.waitForFunction(() => !document.querySelector('#error-formulario').hidden);
    assert.match(await page.locator('#error-formulario').textContent(), /vacío/i);

    // Catálogo → detalle, recarga y navegación Atrás/Adelante.
    await page.goto(`${base}/catalogo.html`); await esperar(page, 'catalogo');
    await page.waitForFunction(() => document.querySelectorAll('.game-card').length === 13);
    await page.locator('[data-platform="switch"]').click();
    assert.equal(await page.locator('.game-card').count(), 3);
    await page.locator('[data-platform="todos"]').click();
    await page.locator('[data-details="1"]').first().click(); await esperar(page, 'producto');
    assert.equal(new URL(page.url()).pathname, '/producto.html');
    assert.equal(new URL(page.url()).searchParams.get('id'), '1');
    await page.reload(); await esperar(page, 'producto');
    await page.waitForFunction(() => /EA SPORTS FC 24/.test(document.querySelector('#detalle-titulo').textContent));
    await page.goBack(); await esperar(page, 'catalogo');
    await page.goForward(); await esperar(page, 'producto');
    await page.goBack(); await esperar(page, 'catalogo');

    // El carrito sobrevive al cambio de archivo y a la recarga.
    await page.locator('[data-add="1"]').first().click();
    await page.locator('#abrir-carrito').click(); await esperar(page, 'carrito');
    await page.waitForFunction(() => document.querySelectorAll('.cart-item').length === 1);
    await page.reload(); await esperar(page, 'carrito');
    await page.waitForFunction(() => document.querySelectorAll('.cart-item').length === 1);
    assert.equal(await page.locator('#carrito-total').textContent(), '$59.99 USD');

    // Checkout protegido: login y retorno se conservan sin parámetros privados.
    await page.locator('#continuar-pago').click(); await esperar(page, 'login');
    assert.equal(await page.evaluate(() => sessionStorage.getItem('gamevault:retorno-login')), 'checkout.html');
    await page.locator('#login-email').fill('qa@example.invalid');
    await page.locator('#login-clave').fill('Prueba123');
    await page.locator('#formulario-login button[type="submit"]').click(); await esperar(page, 'checkout');
    assert.equal(new URL(page.url()).search, '');
    await page.waitForFunction(() => document.querySelectorAll('#checkout-productos li').length === 1);
    await page.locator('.payment-option').filter({ has: page.locator('input[value="paypal"]') }).click();
    await page.locator('#pagar').click(); await esperar(page, 'confirmacion');
    await page.waitForFunction(() => /DEMO-QA-1/.test(document.querySelector('#juegos-entregados').textContent));
    assert.equal(new URL(page.url()).search, '');
    await page.reload(); await esperar(page, 'confirmacion');
    await page.waitForFunction(() => /DEMO-QA-1/.test(document.querySelector('#juegos-entregados').textContent));

    // Perfil, soporte/ticket privado y administración denegada a CLIENTE.
    await page.goto(`${base}/perfil.html`); await esperar(page, 'perfil');
    await page.waitForFunction(() => document.querySelector('#perfil-pedidos').textContent === '1');
    assert.equal(await page.locator('#perfil-nombre').textContent(), 'Usuario QA');
    await page.goto(`${base}/soporte.html`); await esperar(page, 'soporte');
    await page.locator('#ticket-asunto').fill('Problema de prueba');
    await page.locator('#ticket-descripcion').fill('Descripción suficientemente extensa para soporte.');
    await page.locator('#formulario-ticket button[type="submit"]').click(); await esperar(page, 'ticket');
    await page.waitForFunction(() => /Problema de prueba/.test(document.querySelector('#ticket-detalle').textContent));
    await page.goto(`${base}/admin.html`); await esperar(page, 'admin');
    await page.waitForFunction(() => !document.querySelector('#admin-denegado').hidden);
    assert.match(await page.locator('#admin-denegado').textContent(), /Acceso restringido/);
    await page.evaluate(() => localStorage.setItem('qa:user', JSON.stringify({ id: 'qa-admin', email: 'admin@example.invalid' })));
    await page.reload(); await esperar(page, 'admin');
    await page.waitForFunction(() => !document.querySelector('#admin-contenido').hidden && document.querySelectorAll('#admin-productos .admin-record').length === 13);
    assert.equal(await page.locator('#admin-denegado').isHidden(), true);

    // Teclado y anchos móviles: foco visible y sin desbordamiento horizontal.
    await page.goto(`${base}/catalogo.html`); await esperar(page, 'catalogo');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.classList.contains('skip-link')), true);
    await page.keyboard.press('Enter');
    assert.equal(new URL(page.url()).hash, '#contenido');
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `desbordamiento a ${width}px`);
    }

    assert.deepEqual(errors, []);
    console.log('OK: 12 páginas reales; enlaces directos, recarga, Atrás/Adelante, carrito/sesión/comprobante, compra simulada, perfil, soporte, permisos, teclado y móvil.');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
