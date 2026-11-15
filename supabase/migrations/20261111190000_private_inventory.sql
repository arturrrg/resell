-- Additive: legacy tables and local inventory are never removed.
create table public.resell_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  record_key text not null check (length(record_key) between 1 and 300),
  payload jsonb,
  deleted boolean not null default false,
  content_hash text not null,
  version bigint not null default 1,
  updated_at timestamptz not null default now(),
  primary key (user_id, record_key),
  check ((deleted and payload is null) or (not deleted and jsonb_typeof(payload) = 'object' and length(payload->>'id') > 0))
);
create table public.resell_record_history (
  user_id uuid not null references auth.users(id) on delete cascade,
  record_key text not null,
  version bigint not null,
  payload jsonb,
  deleted boolean not null,
  archived_at timestamptz not null default now(),
  primary key (user_id, record_key, version)
);
alter table public.resell_records enable row level security;
alter table public.resell_record_history enable row level security;
revoke all on public.resell_records, public.resell_record_history from anon, authenticated;
grant select, insert, update on public.resell_records to authenticated;
grant select on public.resell_record_history to authenticated;
create policy "Read own inventory" on public.resell_records for select to authenticated using ((select auth.uid()) = user_id);
create policy "Insert own inventory" on public.resell_records for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own inventory" on public.resell_records for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Read own recovery history" on public.resell_record_history for select to authenticated using ((select auth.uid()) = user_id);

create function public.resell_record_version() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if TG_OP = 'UPDATE' then
    if NEW.user_id <> OLD.user_id or NEW.record_key <> OLD.record_key then
      raise exception 'Record ownership and identity are immutable';
    end if;
    if NEW.payload is not distinct from OLD.payload and NEW.deleted = OLD.deleted and NEW.content_hash = OLD.content_hash then
      return null;
    end if;
    insert into public.resell_record_history(user_id, record_key, version, payload, deleted)
      values (OLD.user_id, OLD.record_key, OLD.version, OLD.payload, OLD.deleted);
    delete from public.resell_record_history h where h.user_id=OLD.user_id and h.record_key=OLD.record_key and h.version < OLD.version-9;
    NEW.version := OLD.version + 1;
  else NEW.version := 1;
  end if;
  NEW.updated_at := clock_timestamp();
  return NEW;
end $$;
revoke all on function public.resell_record_version() from public, anon, authenticated;
create trigger resell_record_version before insert or update on public.resell_records for each row execute function public.resell_record_version();
create index resell_records_updated on public.resell_records(user_id, updated_at);
