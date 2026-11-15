-- Automatic guest sessions retain RLS isolation. A private, high-entropy link
-- grants access to exactly one workspace; it never makes the tables public.
create table public.resell_workspace_members (
  member_id uuid primary key references auth.users(id) on delete cascade,
  workspace_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now()
);
create index resell_workspace_members_workspace on public.resell_workspace_members(workspace_id);
create table public.resell_workspace_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now()
);
create index resell_workspace_links_workspace on public.resell_workspace_links(workspace_id);
alter table public.resell_workspace_members enable row level security;
alter table public.resell_workspace_links enable row level security;
revoke all on public.resell_workspace_members, public.resell_workspace_links from anon, authenticated;

create function public.resell_current_workspace() returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select workspace_id from public.resell_workspace_members where member_id = auth.uid()),auth.uid());
$$;
create function public.resell_can_access(workspace uuid) returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select auth.uid() is not null and (workspace = auth.uid() or exists(select 1 from public.resell_workspace_members where member_id=auth.uid() and workspace_id=workspace));
$$;
create function public.resell_make_link() returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare workspace uuid := public.resell_current_workspace(); token text;
begin
  if auth.uid() is null or not public.resell_can_access(workspace) then raise exception 'Private session required'; end if;
  token := replace(gen_random_uuid()::text || gen_random_uuid()::text,'-','');
  insert into public.resell_workspace_links(workspace_id,token_hash) values (workspace,encode(sha256(convert_to(token,'UTF8')),'hex'));
  return token;
end $$;
create function public.resell_connect_link(token text) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare workspace uuid;
begin
  if auth.uid() is null then raise exception 'Private session required'; end if;
  if token is null or token !~ '^[0-9a-f]{64}$' then raise exception 'Invalid private link'; end if;
  select workspace_id into workspace from public.resell_workspace_links where token_hash=encode(sha256(convert_to(token,'UTF8')),'hex');
  if workspace is null then raise exception 'Invalid private link'; end if;
  insert into public.resell_workspace_members(member_id,workspace_id) values (auth.uid(),workspace)
    on conflict (member_id) do update set workspace_id=excluded.workspace_id,joined_at=now();
  return workspace;
end $$;
revoke all on function public.resell_current_workspace(), public.resell_can_access(uuid), public.resell_make_link(), public.resell_connect_link(text) from public, anon;
grant execute on function public.resell_current_workspace(), public.resell_can_access(uuid), public.resell_make_link(), public.resell_connect_link(text) to authenticated;

drop policy "Read own inventory" on public.resell_records;
drop policy "Insert own inventory" on public.resell_records;
drop policy "Update own inventory" on public.resell_records;
drop policy "Read own recovery history" on public.resell_record_history;
create policy "Read private workspace" on public.resell_records for select to authenticated using (public.resell_can_access(user_id));
create policy "Insert private workspace" on public.resell_records for insert to authenticated with check (public.resell_can_access(user_id));
create policy "Update private workspace" on public.resell_records for update to authenticated using (public.resell_can_access(user_id)) with check (public.resell_can_access(user_id));
create policy "Read private workspace recovery" on public.resell_record_history for select to authenticated using (public.resell_can_access(user_id));
