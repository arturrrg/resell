-- Read the already-active code to prepare its QR without creating a share.
create function public.resell_existing_view_code() returns text language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not exists(select 1 from auth.users where id=auth.uid() and is_anonymous=false and email_confirmed_at is not null) then raise exception 'Sign in to a verified account to share an inventory';end if;
 return (select code from public.resell_view_links where workspace_id=auth.uid());
end $$;
revoke all on function public.resell_existing_view_code() from public,anon;
grant execute on function public.resell_existing_view_code() to authenticated;
