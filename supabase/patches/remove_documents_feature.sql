-- Permanently removes the retired collaborative Documents feature.
-- Back up document data before applying this migration.
drop table if exists public.document_access_requests cascade;
drop table if exists public.document_comments cascade;
drop table if exists public.document_versions cascade;
drop table if exists public.document_members cascade;
drop table if exists public.documents cascade;
drop function if exists public.is_document_member(uuid) cascade;
drop function if exists public.is_document_owner(uuid) cascade;
