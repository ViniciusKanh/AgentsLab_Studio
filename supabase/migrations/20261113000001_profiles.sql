-- =============================================================================
-- AgentsLab_Studio — perfis de usuário (Supabase Auth)
-- Executar no SQL Editor do Supabase (ou `supabase db push`).
-- =============================================================================

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '' check (char_length(full_name) <= 120),
  avatar_url  text check (avatar_url is null or char_length(avatar_url) <= 500),
  job_title   text not null default '' check (char_length(job_title) <= 120),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is 'Perfil público mínimo de cada usuário do AgentsLab_Studio (1:1 com auth.users).';

-- RLS: cada usuário só enxerga e altera o PRÓPRIO perfil. Não há política de INSERT/DELETE:
-- o perfil é criado pelo gatilho abaixo e apagado em cascata com o usuário.
alter table public.profiles enable row level security;

drop policy if exists "perfil: ler o proprio" on public.profiles;
create policy "perfil: ler o proprio" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "perfil: atualizar o proprio" on public.profiles;
create policy "perfil: atualizar o proprio" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

revoke all on public.profiles from anon;
grant select, update (full_name, avatar_url, job_title, updated_at) on public.profiles to authenticated;

-- Cria o perfil automaticamente no cadastro (nome vem de options.data.full_name do signUp)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Mantém o nome sincronizado quando o usuário altera o perfil pelo app (auth.updateUser({ data }))
create or replace function public.handle_user_updated()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
     set full_name  = left(coalesce(new.raw_user_meta_data ->> 'full_name', full_name), 120),
         avatar_url = coalesce(new.raw_user_meta_data ->> 'avatar_url', avatar_url),
         updated_at = now()
   where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update of raw_user_meta_data on auth.users
  for each row execute procedure public.handle_user_updated();

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_user_updated() from public, anon, authenticated;
