create index on public.clave_digital(id_detalle_pedido,id_producto);
drop policy admin_claves on public.clave_digital;
drop policy claves_entregadas on public.clave_digital;
create policy claves_entregadas on public.clave_digital for select to authenticated using((select private.es_admin()) or exists(select 1 from public.detalle_pedido d join public.pedido p using(id_pedido) where d.id_detalle_pedido=clave_digital.id_detalle_pedido and p.id_usuario=(select auth.uid()) and p.estado='ENTREGADO' and (select private.es_cliente_activo())));
create or replace function private.leer_pedido(p_id uuid,p_comprobante text default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
 declare p public.pedido; result jsonb; begin
 select * into p from public.pedido where id_pedido=p_id;
 if not found or ((p.id_usuario=auth.uid() and private.es_cliente_activo()) or
 (p.id_usuario is null and length(p_comprobante)>=64 and p.comprobante_hash=encode(sha256(convert_to(p_comprobante,'UTF8')),'hex'))) is not true then
 raise exception 'Pedido no disponible' using errcode='42501'; end if;
 select jsonb_build_object('id',p.id_pedido,'numero',p.numero,'email',p.correo_entrega,'total',p.total_centavos,'fecha',p.creado_en,'estado',p.estado,
 'metodo',(select m.nombre from public.pago pa join public.metodo_pago m using(id_metodo_pago) where pa.id_pedido=p.id_pedido and pa.estado='APROBADO'),
 'juegos',coalesce((select jsonb_agg(jsonb_build_object('id',d.id_producto,'titulo',d.titulo_compra,'edicion',d.edicion_compra,
 'plataforma',c.codigo,'region',d.region_compra,'precioCentavos',d.precio_unitario_centavos,'precioAnteriorCentavos',d.precio_anterior_centavos,
 'imagen',pr.imagen_url,'codigo',k.codigo) order by d.id_detalle_pedido)
 from public.detalle_pedido d join public.producto pr using(id_producto) join public.categoria c using(id_categoria)
 join public.clave_digital k using(id_detalle_pedido) where d.id_pedido=p.id_pedido),'[]'::jsonb)) into result;
 return result;
 end;
$$;
create or replace function private.validar_pedido() returns trigger language plpgsql security definer set search_path='' as $$
 declare v_id uuid; p public.pedido; begin
 if TG_TABLE_NAME='pedido' then v_id:=coalesce(new.id_pedido,old.id_pedido); else v_id:=coalesce(new.id_pedido,old.id_pedido); end if;
 select * into p from public.pedido where id_pedido=v_id;
 if not found then return null; end if;
 if p.total_centavos<>coalesce((select sum(precio_unitario_centavos) from public.detalle_pedido where id_pedido=v_id),0) then raise exception 'Total inconsistente'; end if;
 if p.estado in ('PAGADO','ENTREGADO') and (not exists(select 1 from public.detalle_pedido where id_pedido=v_id) or not exists(select 1 from public.pago where id_pedido=v_id and estado='APROBADO' and importe_centavos=p.total_centavos)) then raise exception 'Pedido sin líneas o pago aprobado'; end if;
 if p.estado='ENTREGADO' and exists(select 1 from public.detalle_pedido d where d.id_pedido=v_id and not exists(select 1 from public.clave_digital k where k.id_detalle_pedido=d.id_detalle_pedido and k.estado='ENTREGADA')) then raise exception 'Entrega incompleta'; end if;
 return null;
 end;
$$;