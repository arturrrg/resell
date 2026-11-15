-- Offer drafts are private account data; public inventory links never expose them.
create table if not exists public.resell_offer_drafts (
  user_id uuid not null references auth.users(id) on delete cascade,
  draft_id uuid not null,
  payload jsonb,
  content_hash text not null,
  deleted boolean not null default false,
  version bigint not null default 1,
  updated_at timestamptz not null default now(),
  primary key(user_id,draft_id),
  constraint offer_payload_size check (payload is null or octet_length(payload::text)<250000)
);
alter table public.resell_offer_drafts enable row level security;
revoke all on public.resell_offer_drafts from anon,authenticated;
grant select on public.resell_offer_drafts to authenticated;
create policy own_offer_drafts on public.resell_offer_drafts for select to authenticated
  using(user_id=auth.uid() and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false);

create or replace function public.resell_save_offer(
  p_id uuid,p_payload jsonb,p_hash text,p_deleted boolean,p_expected_version bigint
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare owner uuid:=auth.uid(); result public.resell_offer_drafts; count_rows integer;
begin
  if not exists(select 1 from auth.users where id=owner and not is_anonymous and email_confirmed_at is not null) then
    raise exception 'Sign in to a verified account to sync offers';
  end if;
  if p_hash is null or length(p_hash)>100 or p_expected_version<0 then raise exception 'Invalid offer revision';end if;
  if not p_deleted and (
    p_payload is null or jsonb_typeof(p_payload)<>'object' or
    p_payload->>'id' is distinct from p_id::text or p_payload->>'version' is distinct from '1' or
    jsonb_typeof(p_payload->'photos') is distinct from 'array' or jsonb_array_length(p_payload->'photos')>10 or
    length(coalesce(p_payload->>'title',''))>100 or length(coalesce(p_payload->>'secondaryTitle',''))>100 or
    length(coalesce(p_payload->>'description',''))>2000
  ) then raise exception 'Invalid offer draft';end if;
  if p_expected_version=0 then
    insert into public.resell_offer_drafts(user_id,draft_id,payload,content_hash,deleted)
      values(owner,p_id,case when p_deleted then null else p_payload end,p_hash,p_deleted)
      on conflict do nothing returning * into result;
    if found then return to_jsonb(result);end if;
  end if;
  update public.resell_offer_drafts set payload=case when p_deleted then null else p_payload end,
    content_hash=p_hash,deleted=p_deleted,version=version+1,updated_at=now()
    where user_id=owner and draft_id=p_id and version=p_expected_version returning * into result;
  if not found then raise exception 'OFFER_CONFLICT';end if;
  return to_jsonb(result);
end $$;
revoke all on function public.resell_save_offer(uuid,jsonb,text,boolean,bigint) from public,anon;
grant execute on function public.resell_save_offer(uuid,jsonb,text,boolean,bigint) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values('resell-offer-photos','resell-offer-photos',false,12582912,array['image/jpeg','image/png','image/webp'])
  on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy own_offer_photo_read on storage.objects for select to authenticated using(
  bucket_id='resell-offer-photos' and (storage.foldername(name))[1]=auth.uid()::text and
  coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false);
create policy own_offer_photo_add on storage.objects for insert to authenticated with check(
  bucket_id='resell-offer-photos' and (storage.foldername(name))[1]=auth.uid()::text and
  coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false);
create policy own_offer_photo_remove on storage.objects for delete to authenticated using(
  bucket_id='resell-offer-photos' and (storage.foldername(name))[1]=auth.uid()::text and
  coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false);
