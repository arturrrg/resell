-- Only permanent accounts may create sharing codes. Existing guest inventory
-- records are retained for later account conversion, without exposing them.
create or replace function public.resell_share_inventory() returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare workspace uuid := auth.uid(); result text;
begin
 if not exists(select 1 from auth.users where id=workspace and is_anonymous=false and email_confirmed_at is not null) then raise exception 'Sign in to a verified account to share an inventory';end if;
 select code into result from public.resell_view_links where workspace_id=workspace;
 if result is null then
  insert into public.resell_view_links(workspace_id,code) values(workspace,replace(gen_random_uuid()::text,'-',''))
   on conflict(workspace_id) do update set code=resell_view_links.code returning code into result;
 end if;
 return result;
end $$;
create or replace function public.resell_view_inventory(view_code text) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare workspace uuid; result jsonb;
begin
 if view_code is null or view_code !~ '^[a-f0-9]{32}$' then raise exception 'Invalid viewing code';end if;
 select v.workspace_id into workspace from public.resell_view_links v join auth.users u on u.id=v.workspace_id
  where v.code=view_code and u.is_anonymous=false and u.email_confirmed_at is not null;
 if workspace is null then raise exception 'This viewing code is unavailable or has been revoked';end if;
 select coalesce(jsonb_agg(card order by updated_at desc),'[]'::jsonb) into result from (
  select updated_at,jsonb_strip_nulls(jsonb_build_object(
   'id',payload->'id','brand',payload->'brand','model',payload->'model','title',payload->'title',
   'storage',payload->'storage','color',payload->'color','condition',payload->'condition','batteryHealth',payload->'batteryHealth',
   'sourcePrice',payload->'sourcePrice','currency',payload->'currency','listingUrl',payload->'listingUrl',
   'listingDescription',payload->'listingDescription','characteristics',payload->'characteristics',
   'photos',payload->'photos','videos',payload->'videos','sellerName',payload->'sellerName','sellerUrl',payload->'sellerUrl'
  )) as card from public.resell_records where user_id=workspace and not deleted and coalesce(payload->>'saleStatus','in_progress')<>'sold'
 ) visible;
 return result;
end $$;
