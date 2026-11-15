-- Keep guest recovery usable while accounts are being rolled out.
create or replace function public.resell_make_link() returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare workspace uuid := public.resell_current_workspace(); token text;
begin
 if not exists(select 1 from auth.users where id=auth.uid() and is_anonymous=true) then raise exception 'Sign in on the other device to open this account';end if;
 if not public.resell_can_access(workspace) then raise exception 'Private inventory unavailable';end if;
 token:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
 insert into public.resell_workspace_links(workspace_id,token_hash) values(workspace,encode(sha256(convert_to(token,'UTF8')),'hex'));
 return token;
end $$;
