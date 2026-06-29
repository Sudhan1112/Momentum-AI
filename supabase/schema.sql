-- Momentum AI core identity schema.
-- Feature schemas are applied from supabase/patches in migration order.

drop table if exists public.profiles cascade;
drop type if exists app_role cascade;
drop function if exists public.handle_new_user() cascade;

create type app_role as enum ('viewer', 'commenter', 'editor', 'admin', 'owner');

create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text not null,
  full_name text,
  avatar_url text,
  color text default '#0F6CBD'
);

alter table public.profiles enable row level security;
create policy "Profiles viewable by all." on profiles for select using (true);
create policy "Users update own profile." on profiles for update using (auth.uid() = id);
create policy "Service can insert profiles." on profiles for insert with check (true);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

insert into public.profiles (id, email, full_name, avatar_url)
select id, email, raw_user_meta_data->>'full_name', raw_user_meta_data->>'avatar_url'
from auth.users
on conflict (id) do nothing;
