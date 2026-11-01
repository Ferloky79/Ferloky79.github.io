'use strict';
// Interfaz con API controlada: no crea cuentas ni pedidos en Supabase.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const catalogo = require('./tests/fixtures/catalogo.json');
const root = __dirname;
const server = http.createServer((req,res) => {
  const url = new URL(req.url,'http://localhost');
  const file = path.join(root, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  try {
    const mime = {'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json'}[path.extname(file)];
    if (mime) res.setHeader('Content-Type',mime);
    res.end(fs.readFileSync(file));
  } catch { res.writeHead(404).end(); }
});
const mock = `
window.GameVaultAPI = (() => {
 const games = ${JSON.stringify(catalogo)};
 let user = null, ids = [], orders = [], reviews = [], tickets = [], messages = [];
 return {
 catalogo: async () => games,
 sesion: async () => user ? {user} : null,
 login: async (email,password) => { if(password!=='Prueba123') throw Error('Invalid login credentials'); user={id:'qa-user',email}; return {user}; },
 registro: async () => ({user:{id:'qa-new'},session:null}),
 salir: async () => {user=null;},
 perfil: async () => ({nombre:user?.email?.startsWith('admin')?'Admin QA':'Usuario QA',activo:true,creado_en:'2026-10-26T10:00:00Z',rol:{nombre:user?.email?.startsWith('admin')?'ADMIN':'CLIENTE'}}),
 pedidos: async () => orders.map(o=>({id_pedido:o.id,numero:o.numero,total_centavos:o.total,estado:o.estado})),
 carrito: async () => ids,
 guardarCarrito: async items => { ids=[...items]; },
 comprar: async s => {
  window.__intentos=(window.__intentos||0)+1;
  await new Promise(r=>setTimeout(r,50));
  if(window.__fallarCompra) throw Error('Sin conexión de prueba');
  let order=orders.find(o=>o.id===s.p_id); if(order) return order;
  order={id:s.p_id,numero:'GV-QA',total:s.p_total,email:s.p_correo,metodo:'PayPal (demo)',estado:'ENTREGADO',juegos:s.p_ids.map(id=>({...games.find(g=>g.id===id),codigo:'DEMO-QA-'+id}))};
  orders.push(order);ids=[];return order;
 },
 pedido: async id => {const order=orders.find(o=>o.id===id); if(!order)throw Error('Pedido no disponible');return order;},
 idVideojuego: async id => ({id_videojuego:id}),
 resenas: async id => reviews.filter(r=>r.id_videojuego===id).map(r=>({...r,autor:'Usuario QA',es_propia:user?.id==='qa-user'})),
 resumenResenas: async id => {const x=reviews.filter(r=>r.id_videojuego===id);return {total:x.length,promedio:x.length?x.reduce((s,r)=>s+r.puntuacion,0)/x.length:null};},
 resenaPropia: async id => reviews.find(r=>r.id_videojuego===id)||null,
 crearResena: async d => {const r={...d,id_resena:'review-1',creado_en:new Date().toISOString(),actualizado_en:new Date().toISOString()};reviews.push(r);return r;},
 editarResena: async (id,d) => Object.assign(reviews.find(r=>r.id_resena===id),d),
 eliminarResena: async id => {reviews=reviews.filter(r=>r.id_resena!==id);return {id_resena:id};},
 tickets: async () => tickets,
 ticket: async id => {const t=tickets.find(x=>x.id_ticket===id);if(!t)throw Error('Ticket no disponible');return t;},
 crearTicket: async d => {const t={...d,id_ticket:'11111111-1111-4111-8111-111111111111',id_usuario:user.id,numero:'TK-QA',estado:'ABIERTO',creado_en:new Date().toISOString(),actualizado_en:new Date().toISOString()};tickets.push(t);return t;},
 mensajesTicket: async id => messages.filter(m=>m.id_ticket===id),
 responderTicket: async (id,mensaje) => {const m={id_mensaje:crypto.randomUUID(),id_ticket:id,id_usuario:user.id,mensaje,creado_en:new Date().toISOString()};messages.push(m);return m;},
 cambiarEstadoTicket: async (id,estado) => Object.assign(tickets.find(t=>t.id_ticket===id),{estado}),
 adminCatalogo: async () => ({videojuegos:games.map(g=>({id_videojuego:g.id,titulo:g.titulo,descripcion:g.descripcion,valoracion_referencia:g.valoracion})),productos:games.map(g=>({id_producto:g.id,id_videojuego:g.id,id_categoria:g.plataforma==='ps5'?1:g.plataforma==='xbox'?2:3,edicion:g.edicion,region:g.region,precio_centavos:g.precioCentavos,precio_anterior_centavos:g.precioAnteriorCentavos,imagen_url:g.imagen,publicado:true})),categorias:[{id_categoria:1,codigo:'ps5',nombre:'PlayStation 5',activo:true},{id_categoria:2,codigo:'xbox',nombre:'Xbox',activo:true},{id_categoria:3,codigo:'switch',nombre:'Switch',activo:true}],claves:[]}),
 guardarVideojuego: async () => ({}), eliminarVideojuego:async()=>({}),guardarProducto:async()=>({}),eliminarProducto:async()=>({}),guardarCategoria:async()=>({}),agregarClaves:async()=>[],eliminarClave:async()=>({}),
 onAuth: () => ({})
 };
})();`;
(async () => {
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser = await chromium.launch({headless:true,
    ...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH}:{}),
    args:['--no-sandbox','--disable-dev-shm-usage']});
  try {
    const page = await browser.newPage(); const errors=[];
    await page.addInitScript(()=>{ Math.random=()=>0.999; });
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/supabase-api.js',route=>route.fulfill({contentType:'text/javascript',body:mock}));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(()=>document.querySelectorAll('.game-card').length===13);
    assert.equal(await page.locator('.game-card').count(),13);
    assert.equal(await page.locator('body').getAttribute('data-view'),'inicio');
    assert.equal(await page.locator('#hero-titulo').textContent(),'Marvel’s Wolverine');
    await page.locator('.main-nav a[href="#catalogo"]').click();
    await page.waitForFunction(()=>document.body.dataset.view==='catalogo');
    await page.locator('[data-platform="switch"]').click();
    assert.equal(await page.locator('.game-card').count(),3);
    await page.locator('#buscar').fill('Mario Kart');
    await page.waitForTimeout(260);
    assert.equal(await page.locator('.game-card').count(),1);
    await page.locator('#restablecer').evaluate(b=>b.click());
    await page.locator('[data-details="1"]').first().click();
    await page.waitForFunction(()=>document.body.dataset.view==='detalle');
    assert.equal(new URL(page.url()).hash,'#producto/1');
    await page.reload();
    await page.waitForFunction(()=>document.body.dataset.view==='detalle');
    assert.match(await page.locator('#detalle-titulo').textContent(),/EA SPORTS FC 24/);
    assert.match(await page.locator('#resenas-resumen').textContent(),/Sin reseñas/);
    await page.goBack();
    await page.waitForFunction(()=>document.body.dataset.view==='catalogo');
    await page.locator('[data-add="1"]').first().click();
    await page.locator('#abrir-carrito').click();
    assert.equal(new URL(page.url()).hash,'#carrito');
    assert.equal(await page.locator('#lista-carrito .cart-item').count(),1);
    await page.locator('#carrito [data-cart-remove="1"]').click();
    await page.locator('#carrito-deshacer').click();
    assert.equal(await page.locator('#lista-carrito .cart-item').count(),1);
    await page.locator('#carrito a[href="#catalogo"]').first().click();
    await page.locator('#abrir-cuenta').click();
    await page.locator('#login-email').fill('qa@example.invalid');
    await page.locator('#login-clave').fill('incorrecta');
    await page.locator('#formulario-login [type="submit"]').click();
    await page.waitForFunction(()=>!document.querySelector('#estado-login').hidden);
    assert.match(await page.locator('#estado-login').textContent(),/no coinciden/);
    await page.locator('#login-clave').fill('Prueba123');
    await page.locator('#formulario-login [type="submit"]').click();
    await page.waitForFunction(()=>document.body.dataset.view==='perfil');
    assert.equal(await page.locator('#perfil-nombre').textContent(),'Usuario QA');
    assert.equal(await page.locator('#perfil-carrito').textContent(),'1');
    await page.goto(new URL('#producto/1',page.url()).href);
    await page.waitForFunction(()=>document.body.dataset.view==='detalle');
    await page.locator('#resena-comentario').fill('Una reseña completa creada por la prueba.');
    await page.locator('#formulario-resena [type="submit"]').click();
    await page.waitForFunction(()=>document.querySelectorAll('.review-card').length===1);
    assert.match(await page.locator('#resenas-resumen').textContent(),/5.0 de 5/);
    await page.goto(new URL('#soporte',page.url()).href);
    await page.waitForFunction(()=>document.body.dataset.view==='soporte');
    await page.locator('#ticket-asunto').fill('Problema de prueba');
    await page.locator('#ticket-descripcion').fill('Descripción suficientemente extensa para soporte.');
    await page.locator('#formulario-ticket [type="submit"]').click();
    await page.waitForFunction(()=>document.body.dataset.view==='ticket');
    await page.locator('#respuesta-ticket').fill('Necesito ayuda con este caso.');
    await page.locator('.reply-form [type="submit"]').click();
    await page.waitForFunction(()=>document.querySelectorAll('.message').length===1);
    assert.match(await page.locator('.conversation').textContent(),/Necesito ayuda/);
    await page.goto(new URL('#perfil',page.url()).href);
    await page.waitForFunction(()=>document.body.dataset.view==='perfil');
    await page.locator('#perfil [data-open-cart]').click();
    await page.waitForFunction(()=>document.body.dataset.view==='carrito');
    await page.locator('#continuar-pago').click();
    await page.locator('.payment-option').filter({has:page.locator('input[value="paypal"]')}).click();
    await page.evaluate(()=>window.__fallarCompra=true);
    await page.locator('#pagar').click();
    await page.waitForFunction(()=>!document.querySelector('#error-formulario').hidden);
    assert.equal(await page.locator('body').getAttribute('data-view'),'checkout');
    const pendiente = await page.evaluate(()=>JSON.parse(sessionStorage.getItem('gamevault:compra-pendiente')).p_id);
    await page.evaluate(()=>window.__fallarCompra=false);
    await page.locator('#pagar').click();
    await page.waitForFunction(()=>document.body.dataset.view==='confirmacion');
    const ultimo = await page.evaluate(()=>JSON.parse(sessionStorage.getItem('gamevault:ultimo-comprobante')));
    assert.equal(ultimo.id,pendiente);
    assert.match(await page.locator('#juegos-entregados').textContent(),/DEMO-QA-1/);
    assert.equal(await page.locator('#contador-carrito').textContent(),'0');
    await page.locator('#abrir-cuenta').click();
    await page.waitForFunction(()=>document.querySelector('#perfil-pedidos').textContent==='1');
    assert.match(await page.locator('#historial-pedidos').textContent(),/GV-QA/);
    assert.equal(await page.locator('#nav-admin').isHidden(),true);
    await page.goto(new URL('#admin',page.url()).href);
    await page.waitForFunction(()=>document.body.dataset.view==='admin');
    assert.equal(await page.locator('#admin-denegado').isVisible(),true);
    await page.goto(new URL('#perfil',page.url()).href);
    await page.waitForFunction(()=>document.body.dataset.view==='perfil');
    await page.locator('#cerrar-sesion').click();
    await page.waitForFunction(()=>document.body.dataset.view==='cuenta');
    assert.equal(await page.locator('#contador-carrito').textContent(),'0');
    await page.locator('#tab-registro').click();
    await page.locator('#registro-nombre').fill('Nueva Cuenta');
    await page.locator('#registro-email').fill('nuevo@example.invalid');
    await page.locator('#registro-clave').fill('Prueba123');
    await page.locator('#registro-confirmar').fill('Prueba123');
    await page.locator('#registro-condiciones').check();
    await page.locator('#formulario-registro [type="submit"]').click();
    await page.waitForFunction(()=>!document.querySelector('#estado-login').hidden);
    assert.match(await page.locator('#estado-login').textContent(),/confirmar/);
    await page.goto(new URL('#cuenta',page.url()).href);
    await page.locator('#login-email').fill('admin@example.invalid');
    await page.locator('#login-clave').fill('Prueba123');
    await page.locator('#formulario-login [type="submit"]').click();
    await page.waitForFunction(()=>document.body.dataset.view==='perfil');
    assert.equal(await page.locator('#perfil-tipo').textContent(),'Administrador');
    await page.goto(new URL('#admin',page.url()).href);
    await page.waitForFunction(()=>document.body.dataset.view==='admin'&&!document.querySelector('#admin-contenido').hidden);
    assert.equal(await page.locator('#admin-productos .admin-record').count(),13);
    await page.locator('#admin-juego-titulo').fill('Juego de prueba');
    await page.locator('#admin-juego-descripcion').fill('Descripción de prueba para administración.');
    await page.locator('#admin-juego-valoracion').fill('4.5');
    await page.locator('#formulario-videojuego [type="submit"]').click();
    await page.waitForFunction(()=>!document.querySelector('#admin-estado').hidden);
    assert.match(await page.locator('#admin-estado').textContent(),/guardado/);
    for (const width of [320,768,1440]) {
      await page.setViewportSize({width,height:900});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    }
    assert.deepEqual(errors,[]);
    console.log('OK: catálogo ampliado, reseñas, soporte/conversación, permisos ADMIN, CRUD, carrito, Auth, checkout y reflujo. API controlada; sin escrituras remotas.');
  } finally { await browser.close(); server.close(); }
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
