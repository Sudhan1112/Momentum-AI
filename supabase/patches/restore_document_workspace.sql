-- Document Recovery: restore the original collaborative document workspace.
-- Safe to run on the current Momentum database. This patch is additive and
-- does not drop project, task, AI, recovery, or existing document data.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('viewer', 'commenter', 'editor', 'admin', 'owner');
  end if;
end $$;

alter type public.app_role add value if not exists 'commenter';
alter type public.app_role add value if not exists 'editor';
alter type public.app_role add value if not exists 'admin';
alter type public.app_role add value if not exists 'owner';

create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text not null,
  full_name text,
  avatar_url text,
  color text default '#3B82F6'
);

alter table public.profiles enable row level security;

drop policy if exists "Profiles viewable by all." on public.profiles;
drop policy if exists "Users update own profile." on public.profiles;
drop policy if exists "Service can insert profiles." on public.profiles;

create policy "Profiles viewable by all." on public.profiles for select using (true);
create policy "Users update own profile." on public.profiles for update using (auth.uid() = id);
create policy "Service can insert profiles." on public.profiles for insert with check (true);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

insert into public.profiles (id, email, full_name, avatar_url)
select id, email, raw_user_meta_data->>'full_name', raw_user_meta_data->>'avatar_url'
from auth.users
on conflict (id) do nothing;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.documents (
  id uuid default gen_random_uuid() primary key,
  title text not null default 'Untitled Document',
  yjs_state text,
  owner_id uuid references public.profiles(id) not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.documents enable row level security;

create table if not exists public.document_members (
  id uuid default gen_random_uuid() primary key,
  document_id uuid references public.documents(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role public.app_role not null default 'viewer',
  created_at timestamptz default now() not null,
  unique(document_id, user_id)
);

alter table public.document_members enable row level security;

create index if not exists document_members_document_idx
  on public.document_members(document_id);

create index if not exists document_members_user_idx
  on public.document_members(user_id);

create or replace function public.is_document_member(doc_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.document_members
    where document_id = doc_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_document_owner(doc_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.documents d
    where d.id = doc_id
      and d.owner_id = auth.uid()
  );
$$;

drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at
  before update on public.documents
  for each row execute procedure public.set_updated_at();

drop policy if exists "View own or member docs." on public.documents;
drop policy if exists "Create docs." on public.documents;
drop policy if exists "Owner updates." on public.documents;
drop policy if exists "Owner deletes." on public.documents;

create policy "View own or member docs." on public.documents for select
  using (auth.uid() = owner_id or public.is_document_member(id));

create policy "Create docs." on public.documents for insert
  with check (auth.uid() = owner_id);

create policy "Owner updates." on public.documents for update
  using (auth.uid() = owner_id);

create policy "Owner deletes." on public.documents for delete
  using (auth.uid() = owner_id);

drop policy if exists "Members view document roster." on public.document_members;
drop policy if exists "Owner adds document members." on public.document_members;
drop policy if exists "Owner updates member roles." on public.document_members;
drop policy if exists "Leave or owner removes members." on public.document_members;

create policy "Members view document roster." on public.document_members for select
  using (public.is_document_member(document_id));

create policy "Owner adds document members." on public.document_members for insert
  with check (public.is_document_owner(document_id));

create policy "Owner updates member roles." on public.document_members for update
  using (public.is_document_owner(document_id))
  with check (public.is_document_owner(document_id));

create policy "Leave or owner removes members." on public.document_members for delete
  using (user_id = auth.uid() or public.is_document_owner(document_id));

create table if not exists public.document_versions (
  id uuid default gen_random_uuid() primary key,
  document_id uuid references public.documents(id) on delete cascade not null,
  yjs_state text not null,
  created_by uuid references public.profiles(id),
  label text default 'Auto-save',
  created_at timestamptz default now() not null
);

alter table public.document_versions enable row level security;

create index if not exists document_versions_document_created_idx
  on public.document_versions(document_id, created_at desc);

drop policy if exists "Members can view versions." on public.document_versions;
drop policy if exists "Members can insert versions." on public.document_versions;
drop policy if exists "Anyone can view versions." on public.document_versions;
drop policy if exists "Anyone can insert versions." on public.document_versions;

create policy "Members can view versions." on public.document_versions for select
  using (public.is_document_owner(document_id) or public.is_document_member(document_id));

create policy "Members can insert versions." on public.document_versions for insert
  with check (public.is_document_owner(document_id) or public.is_document_member(document_id));

create table if not exists public.document_comments (
  id uuid default gen_random_uuid() primary key,
  document_id uuid references public.documents(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  content text not null check (char_length(trim(content)) > 0 and char_length(content) <= 2000),
  selection_text text,
  status text not null default 'open' check (status in ('open', 'resolved')),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists document_comments_document_created_idx
  on public.document_comments(document_id, created_at desc);

alter table public.document_comments enable row level security;

drop trigger if exists document_comments_set_updated_at on public.document_comments;
create trigger document_comments_set_updated_at
  before update on public.document_comments
  for each row execute procedure public.set_updated_at();

drop policy if exists "Members can view comments." on public.document_comments;
drop policy if exists "Members can create own comments." on public.document_comments;
drop policy if exists "Authors can edit own comments." on public.document_comments;
drop policy if exists "Authors and owners can delete comments." on public.document_comments;

create policy "Members can view comments." on public.document_comments for select
  using (public.is_document_owner(document_id) or public.is_document_member(document_id));

create policy "Members can create own comments." on public.document_comments for insert
  with check (
    auth.uid() = user_id
    and (public.is_document_owner(document_id) or public.is_document_member(document_id))
  );

create policy "Authors can edit own comments." on public.document_comments for update
  using (
    auth.uid() = user_id
    and (public.is_document_owner(document_id) or public.is_document_member(document_id))
  )
  with check (
    auth.uid() = user_id
    and (public.is_document_owner(document_id) or public.is_document_member(document_id))
  );

create policy "Authors and owners can delete comments." on public.document_comments for delete
  using (auth.uid() = user_id or public.is_document_owner(document_id));

create table if not exists public.document_access_requests (
  id uuid default gen_random_uuid() primary key,
  document_id uuid references public.documents(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  requested_role public.app_role not null,
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz default now() not null
);

alter table public.document_access_requests enable row level security;

create index if not exists document_access_requests_document_status_idx
  on public.document_access_requests(document_id, status, created_at desc);

create index if not exists document_access_requests_user_idx
  on public.document_access_requests(user_id, created_at desc);

drop policy if exists "Own access requests." on public.document_access_requests;
drop policy if exists "Users can view own access requests." on public.document_access_requests;
drop policy if exists "Users can create own access requests." on public.document_access_requests;
drop policy if exists "Owners can view document access requests." on public.document_access_requests;
drop policy if exists "Owners can update document access requests." on public.document_access_requests;

create policy "Users can view own access requests." on public.document_access_requests for select
  using (auth.uid() = user_id);

create policy "Users can create own access requests." on public.document_access_requests for insert
  with check (auth.uid() = user_id);

create policy "Owners can view document access requests." on public.document_access_requests for select
  using (public.is_document_owner(document_id));

create policy "Owners can update document access requests." on public.document_access_requests for update
  using (public.is_document_owner(document_id))
  with check (public.is_document_owner(document_id));

select pg_notify('pgrst', 'reload schema');
