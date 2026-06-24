-- Sprint 1: SECURITY DEFINER helpers for project RLS and app authorization.
-- These are intentionally defined before policies to avoid recursive RLS checks.

create or replace function public.is_project_member(project_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if to_regclass('public.project_members') is null then
    return false;
  end if;

  return exists (
    select 1
    from public.project_members pm
    where pm.project_id = is_project_member.project_id
      and pm.user_id = auth.uid()
  );
end;
$$;

create or replace function public.is_project_owner(project_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if to_regclass('public.projects') is null then
    return false;
  end if;

  return exists (
    select 1
    from public.projects p
    where p.id = is_project_owner.project_id
      and p.owner_id = auth.uid()
  );
end;
$$;

create or replace function public.has_project_write_role(project_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if to_regclass('public.project_members') is null then
    return false;
  end if;

  return exists (
    select 1
    from public.project_members pm
    where pm.project_id = has_project_write_role.project_id
      and pm.user_id = auth.uid()
      and pm.role in ('owner', 'admin', 'editor')
  );
end;
$$;

create or replace function public.has_project_admin_role(project_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if to_regclass('public.project_members') is null then
    return false;
  end if;

  return exists (
    select 1
    from public.project_members pm
    where pm.project_id = has_project_admin_role.project_id
      and pm.user_id = auth.uid()
      and pm.role in ('owner', 'admin')
  );
end;
$$;

