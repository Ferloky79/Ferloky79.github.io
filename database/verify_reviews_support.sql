-- Run as postgres in Supabase SQL Editor. All fixtures are rolled back.
begin;
select set_config('test.user_a',gen_random_uuid()::text,true);
select set_config('test.user_b',gen_random_uuid()::text,true);
select set_config('test.admin',(select u.id_usuario::text from public.usuario u join public.rol r using(id_rol) where r.nombre='ADMIN' and u.activo limit 1),true);
do $$ declare a uuid; begin
 if nullif(current_setting('test.admin',true),'') is null then
 a=gen_random_uuid();
 insert into auth.users(id,raw_user_meta_data) values(a,'{"nombre":"Admin temporal"}');
 update public.usuario set id_rol=(select id_rol from public.rol where nombre='ADMIN') where id_usuario=a;
 perform set_config('test.admin',a::text,true);
 end if;
end $$;
select set_config('test.foreign_order',(select id_pedido::text from public.pedido limit 1),true);
select set_config('test.game',(select p.id_videojuego::text from public.producto p join public.categoria c using(id_categoria) where p.publicado and c.activo limit 1),true);
insert into auth.users(id,raw_user_meta_data) values
 (current_setting('test.user_a')::uuid,'{"nombre":"Prueba A"}'),
 (current_setting('test.user_b')::uuid,'{"nombre":"Prueba B"}');
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.user_a'),'role','authenticated')::text,true);
set local role authenticated;
insert into public.resena(id_videojuego,puntuacion,comentario) values(current_setting('test.game')::bigint,4,'Resena temporal de prueba');
do $$ begin
 begin
 insert into public.resena(id_videojuego,puntuacion,comentario) values(current_setting('test.game')::bigint,5,'Duplicada no permitida');
 raise exception 'FAIL: duplicate review accepted';
 exception when unique_violation then null; end;
 begin
 update public.resena set puntuacion=6;
 raise exception 'FAIL: invalid rating accepted';
 exception when check_violation then null; end;
 begin
 insert into public.resena(id_usuario,id_videojuego,puntuacion,comentario)
 values(current_setting('test.user_b')::uuid,current_setting('test.game')::bigint,4,'Intento de suplantacion');
 raise exception 'FAIL: spoofed ownership accepted';
 exception when insufficient_privilege then null; end;
end $$;
update public.resena set puntuacion=5,comentario='Comentario propio actualizado';
insert into public.ticket_soporte(asunto,descripcion,categoria) values('Consulta de prueba','Descripcion temporal para probar soporte','CUENTA');
select set_config('test.ticket',(select id_ticket::text from public.ticket_soporte where id_usuario=auth.uid()),true);
insert into public.mensaje_ticket(id_ticket,mensaje) values(current_setting('test.ticket')::uuid,'Mensaje del propietario');
do $$ begin
 update public.ticket_soporte set estado='RESUELTO';
 if found then raise exception 'FAIL: customer changed status'; end if;
 if (select promedio from public.resumen_resenas(current_setting('test.game')::bigint)) is null then raise exception 'FAIL: missing average'; end if;
end $$;

reset role;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.user_b'),'role','authenticated')::text,true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.ticket_soporte) or exists(select 1 from public.mensaje_ticket) then
 raise exception 'FAIL: another customer read private support'; end if;
 if exists(select 1 from public.resena where id_usuario=current_setting('test.user_a')::uuid) then
 raise exception 'FAIL: raw author UUID visible'; end if;
 update public.resena set puntuacion=1 where id_usuario=current_setting('test.user_a')::uuid;
 if found then raise exception 'FAIL: edited another review'; end if;
 delete from public.resena where id_usuario=current_setting('test.user_a')::uuid;
 if found then raise exception 'FAIL: deleted another review'; end if;
 begin
 insert into public.mensaje_ticket(id_ticket,mensaje) values(current_setting('test.ticket')::uuid,'Acceso ajeno');
 raise exception 'FAIL: replied to another ticket';
 exception when insufficient_privilege then null; end;
 begin
 if nullif(current_setting('test.foreign_order',true),'') is not null then
 insert into public.ticket_soporte(asunto,descripcion,id_pedido) values
 ('Pedido ajeno','Intento de vincular pedido ajeno',current_setting('test.foreign_order')::uuid);
 raise exception 'FAIL: ticket linked to foreign order';
 end if;
 exception when insufficient_privilege then null; end;
end $$;

reset role;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.admin'),'role','authenticated')::text,true);
set local role authenticated;
do $$ begin
 if not exists(select 1 from public.ticket_soporte where id_ticket=current_setting('test.ticket')::uuid) then raise exception 'FAIL: admin cannot read'; end if;
end $$;
insert into public.mensaje_ticket(id_ticket,mensaje) values(current_setting('test.ticket')::uuid,'Respuesta administrativa de prueba');
update public.ticket_soporte set estado='RESUELTO' where id_ticket=current_setting('test.ticket')::uuid;
do $$ begin
 if not found and not exists(select 1 from public.ticket_soporte where id_ticket=current_setting('test.ticket')::uuid and estado='RESUELTO') then raise exception 'FAIL: admin status'; end if;
 begin
 insert into public.mensaje_ticket(id_ticket,mensaje) values(current_setting('test.ticket')::uuid,'No debe admitir mensajes cerrado');
 raise exception 'FAIL: resolved ticket accepted a message';
 exception when check_violation then null; end;
end $$;

reset role;
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
do $$ begin
 if not exists(select 1 from public.listar_resenas(current_setting('test.game')::bigint) where comentario='Comentario propio actualizado' and autor='Prueba A' and not es_propia) then
 raise exception 'FAIL: public review missing'; end if;
 begin perform 1 from public.ticket_soporte; raise exception 'FAIL: anonymous ticket read'; exception when insufficient_privilege then null; end;
 begin perform 1 from public.mensaje_ticket; raise exception 'FAIL: anonymous messages read'; exception when insufficient_privilege then null; end;
 begin
 insert into public.resena(id_videojuego,puntuacion,comentario) values(current_setting('test.game')::bigint,4,'Anonimo no permitido');
 raise exception 'FAIL: anonymous review write'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.user_a'),'role','authenticated')::text,true);
set local role authenticated;
do $$ begin
 delete from public.resena where id_videojuego=current_setting('test.game')::bigint;
 if not found then raise exception 'FAIL: owner cannot delete review'; end if;
end $$;
reset role;
rollback;
select 'PASS: review CRUD, rating/uniqueness/ownership, private tickets, admin reply/status, closed ticket and anonymous permissions; fixtures rolled back' as result;
