-- Rename only the former UUID-based automatic nickname.
-- Explicit nicknames and Google account names are retained.
update public.profiles
set display_name = '모아 ' || left(id::text, 8), updated_at = now()
where display_name = '멤버 ' || left(id::text, 8);
