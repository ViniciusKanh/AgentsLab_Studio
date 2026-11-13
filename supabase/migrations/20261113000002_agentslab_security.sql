-- =============================================================================
-- AgentsLab_Studio — segurança das tabelas do backend (schema "agentslab")
--
-- As tabelas são criadas pelo backend FastAPI (SQLAlchemy) no schema "agentslab", que NÃO é
-- exposto pela Data API/PostgREST do Supabase. O backend conecta como dono das tabelas e aplica
-- o isolamento por usuário (owner_id = id do Supabase Auth) em toda consulta.
--
-- Esta migration acrescenta defesa em profundidade: RLS em todas as tabelas e políticas de
-- LEITURA apenas dos próprios dados para o papel "authenticated" (caso o schema venha a ser
-- exposto). Segredos (secrets) e preferências internas (kv) não têm política: acesso negado.
--
-- EXECUTE DEPOIS da primeira inicialização do backend (que cria as tabelas). É idempotente:
-- pode ser executada de novo após atualizações do backend.
-- =============================================================================

create schema if not exists agentslab;
revoke all on schema agentslab from public, anon, authenticated;
grant usage on schema agentslab to authenticated;

do $$
declare
  t text;
begin
  for t in select tablename from pg_tables where schemaname = 'agentslab' loop
    execute format('alter table agentslab.%I enable row level security', t);
    execute format('revoke all on agentslab.%I from public, anon, authenticated', t);
  end loop;
end $$;

-- Tabelas com dono direto -------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['organizations', 'agents', 'projects', 'agent_messages', 'executions', 'credentials', 'events'] loop
    if to_regclass(format('agentslab.%I', t)) is not null then
      execute format('grant select on agentslab.%I to authenticated', t);
      execute format('drop policy if exists "dono: leitura" on agentslab.%I', t);
      execute format('create policy "dono: leitura" on agentslab.%I for select to authenticated using (owner_id = (select auth.uid())::text)', t);
    end if;
  end loop;
end $$;

-- Tabelas filhas: acesso herdado do pai -------------------------------------------
do $$
begin
  if to_regclass('agentslab.departments') is not null then
    grant select on agentslab.departments to authenticated;
    drop policy if exists "dono: leitura" on agentslab.departments;
    create policy "dono: leitura" on agentslab.departments for select to authenticated
      using (exists (select 1 from agentslab.organizations o where o.id = organization_id and o.owner_id = (select auth.uid())::text));
  end if;
  if to_regclass('agentslab.tasks') is not null then
    grant select on agentslab.tasks, agentslab.artifacts, agentslab.evidence, agentslab.approvals, agentslab.artifact_versions to authenticated;
    drop policy if exists "dono: leitura" on agentslab.tasks;
    create policy "dono: leitura" on agentslab.tasks for select to authenticated
      using (exists (select 1 from agentslab.projects p where p.id = project_id and p.owner_id = (select auth.uid())::text));
    drop policy if exists "dono: leitura" on agentslab.artifacts;
    create policy "dono: leitura" on agentslab.artifacts for select to authenticated
      using (exists (select 1 from agentslab.projects p where p.id = project_id and p.owner_id = (select auth.uid())::text));
    drop policy if exists "dono: leitura" on agentslab.evidence;
    create policy "dono: leitura" on agentslab.evidence for select to authenticated
      using (exists (select 1 from agentslab.projects p where p.id = project_id and p.owner_id = (select auth.uid())::text));
    drop policy if exists "dono: leitura" on agentslab.approvals;
    create policy "dono: leitura" on agentslab.approvals for select to authenticated
      using (exists (select 1 from agentslab.projects p where p.id = project_id and p.owner_id = (select auth.uid())::text));
    drop policy if exists "dono: leitura" on agentslab.artifact_versions;
    create policy "dono: leitura" on agentslab.artifact_versions for select to authenticated
      using (exists (select 1 from agentslab.artifacts a join agentslab.projects p on p.id = a.project_id
                     where a.id = artifact_id and p.owner_id = (select auth.uid())::text));
  end if;
end $$;

-- secrets e kv: sem políticas → nenhum acesso para anon/authenticated (somente o backend).
