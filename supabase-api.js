"use strict";
// SDK oficial local, versión fijada en vendor/supabase-2.99.1.js.
window.GameVaultAPI = (() => {
  const config = window.GAMEVAULT_CONFIG;
  const db = window.supabase.createClient(config.url, config.publishableKey);
  const unwrap = ({ data, error }) => { if (error) throw error; return data; };
  return Object.freeze({
    catalogo: async () => unwrap(await db.rpc('obtener_catalogo')),
    sesion: async () => unwrap(await db.auth.getSession()).session,
    login: async (email, password) => unwrap(await db.auth.signInWithPassword({ email, password })),
    registro: async (nombre, email, password) => unwrap(await db.auth.signUp({
      email, password, options: { data: { nombre }, emailRedirectTo: location.origin + location.pathname }
    })),
    salir: async () => unwrap(await db.auth.signOut()),
    perfil: async (id) => unwrap(await db.from('usuario').select('nombre,activo,creado_en,rol(nombre)').eq('id_usuario', id).single()),
    pedidos: async () => unwrap(await db.from('pedido').select('id_pedido,numero,total_centavos,creado_en,estado').order('creado_en', { ascending: false })),
    pedido: async (id, comprobante = null) => unwrap(await db.rpc('obtener_pedido', { p_id: id, p_comprobante: comprobante })),
    carrito: async () => {
      const rows = unwrap(await db.from('carrito').select('detalle_carrito(id_producto)').eq('estado', 'ACTIVO').limit(1));
      return rows?.[0]?.detalle_carrito.map(x => Number(x.id_producto)) || [];
    },
    guardarCarrito: async (ids) => unwrap(await db.rpc('guardar_carrito', { p_ids: ids })),
    comprar: async (solicitud) => unwrap(await db.rpc('comprar_demo', solicitud)),
    idVideojuego: async (idProducto) => unwrap(await db.from('producto').select('id_videojuego').eq('id_producto', idProducto).single()),
    resenas: async (idJuego, limite = 20, offset = 0) => unwrap(await db.rpc('listar_resenas', { p_id_videojuego: idJuego, p_limite: limite, p_offset: offset })),
    resumenResenas: async (idJuego) => (unwrap(await db.rpc('resumen_resenas', { p_id_videojuego: idJuego })) || [])[0] || { total: 0, promedio: null },
    resenaPropia: async (idJuego, idUsuario) => unwrap(await db.from('resena').select('*').eq('id_videojuego', idJuego).eq('id_usuario', idUsuario).maybeSingle()),
    crearResena: async (datos) => unwrap(await db.from('resena').insert(datos).select().single()),
    editarResena: async (id, datos) => unwrap(await db.from('resena').update(datos).eq('id_resena', id).select().single()),
    eliminarResena: async (id) => unwrap(await db.from('resena').delete().eq('id_resena', id).select('id_resena').single()),
    tickets: async () => unwrap(await db.from('ticket_soporte').select('*').order('actualizado_en', { ascending: false }).range(0, 49)),
    ticket: async (id) => unwrap(await db.from('ticket_soporte').select('*').eq('id_ticket', id).single()),
    crearTicket: async (datos) => unwrap(await db.from('ticket_soporte').insert(datos).select().single()),
    mensajesTicket: async (id, desde = 0) => unwrap(await db.from('mensaje_ticket').select('*').eq('id_ticket', id).order('creado_en').order('id_mensaje').range(desde, desde + 49)),
    responderTicket: async (id, mensaje) => unwrap(await db.from('mensaje_ticket').insert({ id_ticket: id, mensaje }).select().single()),
    cambiarEstadoTicket: async (id, estado) => unwrap(await db.from('ticket_soporte').update({ estado }).eq('id_ticket', id).select().single()),
    adminCatalogo: async () => {
      const [videojuegos, productos, categorias, claves] = await Promise.all([
        db.from('videojuego').select('*').order('titulo'),
        db.from('producto').select('*').order('id_producto'),
        db.from('categoria').select('*').order('id_categoria'),
        db.from('clave_digital').select('id_clave,id_producto,codigo,estado,ingresada_en').order('id_clave')
      ]);
      return { videojuegos: unwrap(videojuegos), productos: unwrap(productos), categorias: unwrap(categorias), claves: unwrap(claves) };
    },
    guardarVideojuego: async (id, datos) => id
      ? unwrap(await db.from('videojuego').update(datos).eq('id_videojuego', id).select().single())
      : unwrap(await db.from('videojuego').insert(datos).select().single()),
    eliminarVideojuego: async (id) => unwrap(await db.from('videojuego').delete().eq('id_videojuego', id).select('id_videojuego').single()),
    guardarProducto: async (id, datos) => id
      ? unwrap(await db.from('producto').update(datos).eq('id_producto', id).select().single())
      : unwrap(await db.from('producto').insert(datos).select().single()),
    eliminarProducto: async (id) => unwrap(await db.from('producto').delete().eq('id_producto', id).select('id_producto').single()),
    guardarCategoria: async (id, datos) => unwrap(await db.from('categoria').update(datos).eq('id_categoria', id).select().single()),
    agregarClaves: async (idProducto, codigos) => unwrap(await db.from('clave_digital').insert(codigos.map(codigo => ({ id_producto: idProducto, codigo }))).select('id_clave')),
    eliminarClave: async (id) => unwrap(await db.from('clave_digital').delete().eq('id_clave', id).eq('estado', 'DISPONIBLE').select('id_clave').single()),
    onAuth: (callback) => db.auth.onAuthStateChange(callback)
  });
})();
