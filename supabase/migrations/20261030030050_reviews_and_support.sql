-- Additive extension: preserve catalog, orders, users and reference ratings.
create table public.resena (
 id_resena uuid primary key default gen_random_uuid(),
 id_usuario uuid not null default auth.uid() references public.usuario(id_usuario),
 id_videojuego bigint not null references public.videojuego(id_videojuego),
 puntuacion smallint not null check(puntuacion between 1 and 5),
 comentario text not null check(char_length(btrim(comentario)) between 10 and 2000),
 creado_en timestamptz not null default now(),
 actualizado_en timestamptz not null default now(),
 unique(id_usuario,id_videojuego)
);
create index resena_juego_fecha on public.resena(id_videojuego,creado_en desc,id_resena);

create table public.ticket_soporte (
 id_ticket uuid primary key default gen_random_uuid(),
 numero text not null unique default ('TK-' || replace(gen_random_uuid()::text,'-','')),
 id_usuario uuid not null default auth.uid() references public.usuario(id_usuario),
 id_pedido uuid references public.pedido(id_pedido),
 asunto text not null check(char_length(btrim(asunto)) between 5 and 150),
 descripcion text not null check(char_length(btrim(descripcion)) between 10 and 5000),
 categoria text not null default 'OTRO' check(categoria in ('CUENTA','COMPRA','CLAVE','REEMBOLSO','OTRO')),
 estado text not null default 'ABIERTO' check(estado in ('ABIERTO','EN_PROCESO','RESUELTO','CERRADO')),
 creado_en timestamptz not null default now(),
 actualizado_en timestamptz not null default now()
);
create index ticket_usuario_fecha on public.ticket_soporte(id_usuario,creado_en desc);
create index ticket_pedido on public.ticket_soporte(id_pedido);
create index ticket_estado_fecha on public.ticket_soporte(estado,creado_en desc);
create table public.mensaje_ticket (
 id_mensaje uuid primary key default gen_random_uuid(),
 id_ticket uuid not null references public.ticket_soporte(id_ticket),
 id_usuario uuid not null default auth.uid() references public.usuario(id_usuario),
 mensaje text not null check(char_length(btrim(mensaje)) between 1 and 5000),
 creado_en timestamptz not null default now()
);
create index mensaje_ticket_fecha on public.mensaje_ticket(id_ticket,creado_en,id_mensaje);
create index mensaje_ticket_usuario on public.mensaje_ticket(id_usuario);

alter table public.resena enable row level security;
alter table public.ticket_soporte enable row level security;
alter table public.mensaje_ticket enable row level security;
revoke all on public.resena,public.ticket_soporte,public.mensaje_ticket from public,anon,authenticated;
-- Clients cannot supply identity, ownership, timestamps or initial status.
grant select on public.resena,public.ticket_soporte,public.mensaje_ticket to authenticated;
grant insert(id_videojuego,puntuacion,comentario),update(puntuacion,comentario),delete on public.resena to authenticated;
grant insert(id_pedido,asunto,descripcion,categoria),update(estado) on public.ticket_soporte to authenticated;
grant insert(id_ticket,mensaje) on public.mensaje_ticket to authenticated;

create policy resena_propia on public.resena for select to authenticated
 using((id_usuario=(select auth.uid()) and (select private.es_cliente_activo())) or (select private.es_admin()));
create policy resena_crear on public.resena for insert to authenticated
 with check(id_usuario=(select auth.uid()) and (select private.es_cliente_activo()) and exists(
 select 1 from public.producto p join public.categoria c using(id_categoria)
 where p.id_videojuego=resena.id_videojuego and p.publicado and c.activo));
create policy resena_editar on public.resena for update to authenticated
 using(id_usuario=(select auth.uid()) and (select private.es_cliente_activo()))
 with check(id_usuario=(select auth.uid()) and (select private.es_cliente_activo()));
create policy resena_eliminar on public.resena for delete to authenticated
 using((id_usuario=(select auth.uid()) and (select private.es_cliente_activo())) or (select private.es_admin()));

create policy ticket_leer on public.ticket_soporte for select to authenticated
 using((id_usuario=(select auth.uid()) and (select private.es_cliente_activo())) or (select private.es_admin()));
create policy ticket_crear on public.ticket_soporte for insert to authenticated
 with check(id_usuario=(select auth.uid()) and (select private.es_cliente_activo()) and estado='ABIERTO'
 and (id_pedido is null or exists(select 1 from public.pedido p
 where p.id_pedido=ticket_soporte.id_pedido and p.id_usuario=(select auth.uid()))));
create policy ticket_estado_admin on public.ticket_soporte for update to authenticated
 using((select private.es_admin())) with check((select private.es_admin()));
create policy mensaje_leer on public.mensaje_ticket for select to authenticated
 using(exists(select 1 from public.ticket_soporte t where t.id_ticket=mensaje_ticket.id_ticket));
create policy mensaje_crear on public.mensaje_ticket for insert to authenticated
 with check(id_usuario=(select auth.uid()) and (select private.es_cliente_activo()) and exists(
 select 1 from public.ticket_soporte t where t.id_ticket=mensaje_ticket.id_ticket and t.estado in ('ABIERTO','EN_PROCESO')));

create function private.marcar_actualizacion_comunidad() returns trigger
 language plpgsql set search_path='' as $$
 begin new.actualizado_en=now(); return new; end;
$$;
revoke all on function private.marcar_actualizacion_comunidad() from public,anon,authenticated;
create trigger resena_actualizacion before update on public.resena for each row execute function private.marcar_actualizacion_comunidad();
create trigger ticket_actualizacion before update on public.ticket_soporte for each row execute function private.marcar_actualizacion_comunidad();

-- Trigger needs elevated access only to lock/update the parent ticket.
-- It independently validates authentication and ownership before touching it.
create function private.validar_mensaje_ticket() returns trigger language plpgsql
 security definer set search_path='' as $$
 declare t public.ticket_soporte;
 begin
 if auth.uid() is null or new.id_usuario<>auth.uid() or not private.es_cliente_activo() then
 raise exception 'Sesion activa requerida' using errcode='42501'; end if;
 select * into t from public.ticket_soporte where id_ticket=new.id_ticket for update;
 if not found or (t.id_usuario<>auth.uid() and not private.es_admin()) then
 raise exception 'Ticket no disponible' using errcode='42501'; end if;
 if t.estado not in ('ABIERTO','EN_PROCESO') then
 raise exception 'El ticket esta resuelto o cerrado' using errcode='23514'; end if;
 update public.ticket_soporte set actualizado_en=now() where id_ticket=new.id_ticket;
 return new;
 end;
$$;
revoke all on function private.validar_mensaje_ticket() from public,anon,authenticated;
create trigger mensaje_validacion before insert on public.mensaje_ticket for each row execute function private.validar_mensaje_ticket();

-- Public read API exposes a display name, never email or author UUID.
-- Anonymous reads are intentional; only reviews of published games are returned.
create function private.listar_resenas(p_id_videojuego bigint,p_limite integer,p_offset integer)
 returns table(id_resena uuid,puntuacion smallint,comentario text,autor text,creado_en timestamptz,actualizado_en timestamptz,es_propia boolean)
 language sql stable security definer set search_path='' as $$
 select r.id_resena,r.puntuacion,r.comentario,u.nombre::text,r.creado_en,r.actualizado_en,
 coalesce(r.id_usuario=auth.uid(),false)
 from public.resena r join public.usuario u using(id_usuario)
 where r.id_videojuego=p_id_videojuego and u.activo and exists(
 select 1 from public.producto p join public.categoria c using(id_categoria)
 where p.id_videojuego=r.id_videojuego and p.publicado and c.activo)
 order by r.creado_en desc,r.id_resena
 limit greatest(1,least(coalesce(p_limite,20),50)) offset greatest(coalesce(p_offset,0),0);
$$;
create function public.listar_resenas(p_id_videojuego bigint,p_limite integer default 20,p_offset integer default 0)
 returns table(id_resena uuid,puntuacion smallint,comentario text,autor text,creado_en timestamptz,actualizado_en timestamptz,es_propia boolean)
 language sql stable security invoker set search_path='' as $$
 select * from private.listar_resenas(p_id_videojuego,p_limite,p_offset);
$$;
create function private.resumen_resenas(p_id_videojuego bigint)
 returns table(total bigint,promedio numeric) language sql stable security definer set search_path='' as $$
 select count(*),round(avg(r.puntuacion),1) from public.resena r join public.usuario u using(id_usuario)
 where r.id_videojuego=p_id_videojuego and u.activo and exists(
 select 1 from public.producto p join public.categoria c using(id_categoria)
 where p.id_videojuego=r.id_videojuego and p.publicado and c.activo);
$$;
create function public.resumen_resenas(p_id_videojuego bigint)
 returns table(total bigint,promedio numeric) language sql stable security invoker set search_path='' as $$
 select * from private.resumen_resenas(p_id_videojuego);
$$;
revoke all on function private.listar_resenas(bigint,integer,integer),public.listar_resenas(bigint,integer,integer),
 private.resumen_resenas(bigint),public.resumen_resenas(bigint) from public,anon,authenticated;
grant execute on function private.listar_resenas(bigint,integer,integer),public.listar_resenas(bigint,integer,integer),
 private.resumen_resenas(bigint),public.resumen_resenas(bigint) to anon,authenticated;
comment on table public.resena is 'Una opinion por usuario y videojuego; no requiere compra y no sustituye valoracion_referencia.';
comment on table public.ticket_soporte is 'Soporte academico privado. Sin correo automatico, adjuntos ni reembolsos reales.';
