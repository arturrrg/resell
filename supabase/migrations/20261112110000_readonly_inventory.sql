create table public.resell_view_links (
 workspace_id uuid primary key references auth.users(id) on delete cascade,
 code text not null unique check(code ~ '^[a-f0-9]{32}$'),
 created_at timestamptz not null default now()
);
alter table public.resell_view_links enable row level security;
revoke all on public.resell_view_links from public, anon, authenticated;
create function public.resell_share_inventory() returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare workspace uuid := public.resell_current_workspace(); result text;
begin
 if not public.resell_can_access(workspace) then raise exception 'Private session required';end if;
 select code into result from public.resell_view_links where workspace_id=workspace;
 if result is null then
  insert into public.resell_view_links(workspace_id,code) values(workspace,replace(gen_random_uuid()::text,'-',''))
  on conflict(workspace_id) do update set code=resell_view_links.code returning code into result;
 end if;
 return result;
end $$;
create function public.resell_revoke_view() returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 delete from public.resell_view_links where workspace_id=public.resell_current_workspace() and public.resell_can_access(workspace_id);
end $$;
create function public.resell_view_inventory(view_code text) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare workspace uuid; result jsonb;
begin
 if view_code is null or view_code !~ '^[a-f0-9]{32}$' then raise exception 'Invalid viewing code';end if;
 select workspace_id into workspace from public.resell_view_links where code=view_code;
 if workspace is null then raise exception 'This viewing code is unavailable or has been revoked';end if;
 -- Explicit whitelist: profit, overrides, notes, sale history and identity of the
 -- inventory owner must never be part of the public viewing projection.
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
revoke all on function public.resell_share_inventory(),public.resell_revoke_view(),public.resell_view_inventory(text) from public,anon,authenticated;
grant execute on function public.resell_share_inventory(),public.resell_revoke_view() to authenticated;
grant execute on function public.resell_view_inventory(text) to anon,authenticated;
