-- Pruebas no destructivas: todo se revierte, incluso usuarios y pedidos de QA.
begin;
create temporary table qa_results(nombre text,ok boolean);
grant all on qa_results to anon,authenticated;
set local role anon;
do $$declare p jsonb; begin
 insert into qa_results values('catalogo publico sin claves',jsonb_array_length(public.obtener_catalogo())>0 and not (public.obtener_catalogo()->0 ? 'codigo'));
 p:=public.comprar_demo('10000000-0000-4000-8000-000000000002',array[1]::bigint[],'qa@example.invalid','paypal',5999,repeat('a',64));
 insert into qa_results values('compra invitada',p->>'estado'='ENTREGADO');
 begin perform public.obtener_pedido('10000000-0000-4000-8000-000000000002',null); raise exception 'FALLO lectura sin comprobante'; exception when insufficient_privilege then insert into qa_results values('comprobante obligatorio',true); end;
 begin perform public.obtener_pedido('10000000-0000-4000-8000-000000000002',repeat('b',64)); raise exception 'FALLO token incorrecto'; exception when insufficient_privilege then insert into qa_results values('comprobante incorrecto rechazado',true); end;
 begin perform public.comprar_demo('10000000-0000-4000-8000-000000000003',array[1]::bigint[],'qa@example.invalid','paypal',1,repeat('a',64)); raise exception 'FALLO total'; exception when raise_exception then if SQLERRM like 'FALLO%' then raise; end if; insert into qa_results values('total manipulado rechazado',true); end;
 begin perform codigo from public.clave_digital limit 1; raise exception 'FALLO inventario'; exception when insufficient_privilege then insert into qa_results values('inventario privado',true); end;
end $$;
set local role postgres;
insert into auth.users(id,email,raw_user_meta_data) values
('20000000-0000-4000-8000-000000000001','qa-one@example.invalid','{"nombre":"QA Uno","role":"ADMIN"}'),
('20000000-0000-4000-8000-000000000002','qa-two@example.invalid','{"nombre":"QA Dos"}');
select set_config('request.jwt.claims','{"sub":"20000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$declare p jsonb; begin
 insert into qa_results values('metadata no eleva rol',not private.es_admin());
 perform public.guardar_carrito(array[1,2]::bigint[]);
 p:=public.comprar_demo('10000000-0000-4000-8000-000000000004',array[1,2]::bigint[],'qa-one@example.invalid','tarjeta',11948,repeat('c',64));
 insert into qa_results values('compra registrada',p->>'estado'='ENTREGADO');
 insert into qa_results values('solo claves propias',(select count(*) from public.clave_digital)=2);
 insert into qa_results values('reintento idempotente',public.comprar_demo('10000000-0000-4000-8000-000000000004',array[1,2]::bigint[],'qa-one@example.invalid','tarjeta',11948,repeat('c',64))->>'id'=p->>'id');
 begin update public.usuario set id_rol=1; raise exception 'FALLO elevar rol'; exception when insufficient_privilege then insert into qa_results values('rol protegido',true); end;
end $$;
select set_config('request.jwt.claims','{"sub":"20000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$begin
 insert into qa_results values('sin pedidos ajenos',(select count(*) from public.pedido)=0);
 insert into qa_results values('sin claves ajenas',(select count(*) from public.clave_digital)=0);
 insert into qa_results values('sin carritos ajenos',(select count(*) from public.carrito)=0);
 begin perform public.obtener_pedido('10000000-0000-4000-8000-000000000004',repeat('c',64)); raise exception 'FALLO pedido ajeno'; exception when insufficient_privilege then insert into qa_results values('rpc privada por propietario',true); end;
end $$;
set local role postgres;
-- Fuerza agotamiento dentro de la prueba: toda la compra debe revertirse.
delete from public.clave_digital where id_producto=13 and estado='DISPONIBLE';
set local role anon;
do $$begin
 begin
  perform public.comprar_demo('10000000-0000-4000-8000-000000000005',array[1,13]::bigint[],'qa-stock@example.invalid','paypal',12998,repeat('d',64));
  raise exception 'FALLO sin stock';
 exception when raise_exception then
  if SQLERRM like 'FALLO%' then raise; end if;
  insert into qa_results values('sin stock rechaza compra',true);
 end;
end $$;
set local role postgres;
insert into qa_results values('agotamiento revierte todo',not exists(select 1 from public.pedido where id_pedido='10000000-0000-4000-8000-000000000005'));
set constraints all immediate;
do $$begin if exists(select 1 from qa_results where ok is not true) then raise exception 'Falló una verificación'; end if; end $$;
select * from qa_results;
rollback;
