create or replace function public.resell_make_link() returns text language plpgsql security definer set search_path=public,pg_temp as $$
begin
 raise exception 'Sign in and use a read-only inventory viewing code';
end $$;
