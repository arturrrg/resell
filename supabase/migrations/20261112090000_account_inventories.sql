-- Permanent users always own their inventory. Guest records remain recoverable.
create or replace function public.resell_current_workspace() returns uuid
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare owner uuid := auth.uid(); previous uuid; guest boolean;
begin
  if owner is null then raise exception 'Sign in required'; end if;
  select is_anonymous into guest from auth.users where id=owner;
  select workspace_id into previous from public.resell_workspace_members where member_id=owner;
  if coalesce(guest,false) then return coalesce(previous,owner); end if;
  -- An upgraded guest may have used a legacy private link. Copy its accessible
  -- workspace once, keeping the source and any existing account rows intact.
  if previous is not null and previous <> owner then
    insert into public.resell_records(user_id,record_key,payload,deleted,content_hash)
      select owner,record_key,payload,deleted,content_hash from public.resell_records where user_id=previous
      on conflict (user_id,record_key) do nothing;
    delete from public.resell_workspace_members where member_id=owner;
  end if;
  return owner;
end $$;

create or replace function public.resell_can_access(workspace uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select auth.uid() is not null and (workspace=auth.uid() or (
    exists(select 1 from auth.users where id=auth.uid() and is_anonymous=true)
    and exists(select 1 from auth.users where id=workspace and is_anonymous=true)
    and exists(select 1 from public.resell_workspace_members where member_id=auth.uid() and workspace_id=workspace)
  ));
$$;

-- Old link functions remain for guest recovery only, never account sharing.
create or replace function public.resell_connect_link(token text) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare workspace uuid;
begin
  if not exists(select 1 from auth.users where id=auth.uid() and is_anonymous=true) then raise exception 'Sign in to your own account to access your inventory'; end if;
  if token is null or token !~ '^[0-9a-f]{64}$' then raise exception 'Invalid private link'; end if;
  select workspace_id into workspace from public.resell_workspace_links where token_hash=encode(sha256(convert_to(token,'UTF8')),'hex');
  if workspace is null then raise exception 'Invalid private link'; end if;
  if not exists(select 1 from auth.users where id=workspace and is_anonymous=true) then raise exception 'This inventory now uses account sign-in'; end if;
  insert into public.resell_workspace_members(member_id,workspace_id) values(auth.uid(),workspace)
    on conflict(member_id) do update set workspace_id=excluded.workspace_id,joined_at=now();
  return workspace;
end $$;

create or replace function public.resell_make_link() returns text
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  raise exception 'Use account sign-in to connect another device';
end $$;
