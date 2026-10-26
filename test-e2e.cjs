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
 let user = null, ids = [], orders = [];
 return {
 catalogo: async () => games,
 sesion: async () => user ? {user} : null,
 login: async (email,password) => { if(password!=='Prueba123') throw Error('Invalid login credentials'); user={id:'qa-user',email}; return {user}; },
 registro: async () => ({user:{id:'qa-new'},session:null}),
 salir: async () => {user=null;},
 perfil: async () => ({nombre:'Usuario QA',activo:true,creado_en:'2026-10-26T10:00:00Z',rol:{nombre:'CLIENTE'}}),
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
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/supabase-api.js',route=>route.fulfill({contentType:'text/javascript',body:mock}));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(()=>document.querySelectorAll('.game-card').length===13);
    assert.equal(await page.locator('.game-card').count(),13);
    await page.locator('[data-platform="switch"]').click();
    assert.equal(await page.locator('.game-card').count(),3);
    await page.locator('#buscar').fill('Mario Kart');
    await page.waitForTimeout(260);
    assert.equal(await page.locator('.game-card').count(),1);
    await page.locator('#restablecer').evaluate(b=>b.click());
    await page.locator('[data-add="1"]').first().click();
    await page.locator('#abrir-carrito').click();
    assert.equal(await page.locator('#lista-carrito .cart-item').count(),1);
    await page.locator('#carrito-dialogo [data-cart-remove="1"]').click();
    await page.locator('#carrito-deshacer').click();
    assert.equal(await page.locator('#lista-carrito .cart-item').count(),1);
    await page.locator('#cerrar-carrito').click();
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
    await page.locator('#perfil [data-open-cart]').click();
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
    for (const width of [320,768,1440]) {
      await page.setViewportSize({width,height:900});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    }
    assert.deepEqual(errors,[]);
    console.log('OK: catálogo, filtros, carrito/deshacer, Auth, fusión, checkout/reintento, historial, salida, confirmación de correo y reflujo. API controlada; sin escrituras remotas.');
  } finally { await browser.close(); server.close(); }
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
