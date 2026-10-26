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
    onAuth: (callback) => db.auth.onAuthStateChange(callback)
  });
})();
