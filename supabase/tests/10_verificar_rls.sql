-- Verificação manual das políticas RLS (rodar como superusuário em um banco de teste,
-- depois das migrations e da primeira inicialização do backend com dados de dois usuários).
insert into auth.users (id, email, raw_user_meta_data) values ('11111111-1111-1111-1111-111111111111','a@x.com','{"full_name":"Ana A"}'),('22222222-2222-2222-2222-222222222222','b@x.com','{"full_name":"Beto B"}');
\echo perfis criados pelo gatilho:
select full_name from public.profiles order by 1;
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);
\echo A ve projetos:
select title from agentslab.projects;
\echo A ve organizacoes:
select count(*) from agentslab.organizations;
\echo A ve agentes:
select count(*) from agentslab.agents;
\echo A ve perfis:
select full_name from public.profiles;
\echo A tenta atualizar perfil de B (0 linhas):
update public.profiles set full_name='hack' where id='22222222-2222-2222-2222-222222222222';
update public.profiles set full_name='Ana Atualizada' where id='11111111-1111-1111-1111-111111111111';
\echo A le secrets (deve falhar):
\set ON_ERROR_STOP 0
select * from agentslab.secrets;
reset role;
set role anon;
\echo anon le perfis (deve falhar):
select * from public.profiles;
\echo anon le projetos (deve falhar):
select * from agentslab.projects;
reset role;
select full_name from public.profiles order by 1;
