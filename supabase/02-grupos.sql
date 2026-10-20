-- Etapa 2: grupos, convites e WhatsApp.
-- Cole tudo no Supabase → SQL Editor → New query → Run (uma vez só).

-- ---------------------------------------------------------------
-- Grupos e quem participa de cada um.
-- ---------------------------------------------------------------
create table public.grupos (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 1 and 40),
  codigo text not null unique, -- o código do link de convite
  criado_por uuid references auth.users on delete set null,
  criado_em timestamptz not null default now()
);

create table public.membros (
  grupo_id uuid not null references public.grupos on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  entrou_em timestamptz not null default now(),
  primary key (grupo_id, user_id)
);

-- Sem políticas: o site não lê nem muda essas tabelas direto, só pelas
-- funções abaixo (assim ninguém entra num grupo sem o convite e ninguém
-- vê o e-mail dos outros participantes).
alter table public.grupos enable row level security;
alter table public.membros enable row level security;

-- Cria o grupo (com um código de convite sorteado) e põe quem criou nele.
create function public.criar_grupo(nome_grupo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  novo public.grupos;
begin
  if auth.uid() is null then
    raise exception 'precisa entrar na conta';
  end if;
  loop
    begin
      insert into public.grupos (nome, codigo, criado_por)
      values (trim(nome_grupo), upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)), auth.uid())
      returning * into novo;
      exit;
    exception when unique_violation then
      null; -- código repetido (raríssimo): sorteia outro
    end;
  end loop;
  insert into public.membros (grupo_id, user_id) values (novo.id, auth.uid());
  return jsonb_build_object('id', novo.id, 'nome', novo.nome, 'codigo', novo.codigo);
end;
$$;

-- Entra no grupo pelo código do convite (entrar de novo não faz nada).
create function public.entrar_no_grupo(codigo_convite text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  grupo public.grupos;
begin
  if auth.uid() is null then
    raise exception 'precisa entrar na conta';
  end if;
  select * into grupo from public.grupos where codigo = upper(trim(codigo_convite));
  if not found then
    raise exception 'convite inválido';
  end if;
  insert into public.membros (grupo_id, user_id) values (grupo.id, auth.uid()) on conflict do nothing;
  return jsonb_build_object('id', grupo.id, 'nome', grupo.nome);
end;
$$;

-- O nome do grupo e quantos participam, para quem abriu o convite (mesmo
-- sem conta). Código que não existe → null.
create function public.ver_convite(codigo_convite text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'nome', g.nome,
    'membros', (select count(*) from public.membros m where m.grupo_id = g.id)
  )
  from public.grupos g
  where g.codigo = upper(trim(codigo_convite));
$$;

-- Os grupos de quem pediu, com os participantes (só id e nome).
create function public.meus_grupos()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', g.id,
        'nome', g.nome,
        'codigo', g.codigo,
        'membros', (
          select jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.nome) order by outro.entrou_em)
          from public.membros outro
          join public.perfis p on p.id = outro.user_id
          where outro.grupo_id = g.id
        )
      )
      order by eu.entrou_em
    ),
    '[]'::jsonb
  )
  from public.membros eu
  join public.grupos g on g.id = eu.grupo_id
  where eu.user_id = auth.uid();
$$;

-- Sai do grupo. O último a sair apaga o grupo.
create function public.sair_do_grupo(id_grupo uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.membros where grupo_id = id_grupo and user_id = auth.uid();
  delete from public.grupos g
  where g.id = id_grupo and not exists (select 1 from public.membros m where m.grupo_id = id_grupo);
$$;

-- Só quem tem conta usa as funções; o convite também pode ser visto sem conta.
revoke execute on function
  public.criar_grupo(text),
  public.entrar_no_grupo(text),
  public.ver_convite(text),
  public.meus_grupos(),
  public.sair_do_grupo(uuid)
from public, anon;

grant execute on function
  public.criar_grupo(text),
  public.entrar_no_grupo(text),
  public.meus_grupos(),
  public.sair_do_grupo(uuid)
to authenticated;

grant execute on function public.ver_convite(text) to anon, authenticated;

-- ---------------------------------------------------------------
-- WhatsApp no perfil (com a data de cada aceite, LGPD).
-- ---------------------------------------------------------------
alter table public.perfis
  add column whatsapp text check (whatsapp ~ '^\+55[0-9]{10,11}$'),
  add column whatsapp_aceito_em timestamptz, -- aceitou os avisos do desafio
  add column ofertas_whatsapp boolean not null default false,
  add column ofertas_whatsapp_em timestamptz; -- aceitou ofertas pelo WhatsApp

-- A mesma função da etapa 1, agora carimbando também os aceites do WhatsApp.
create or replace function public.carimbar_perfil()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.id := old.id;
  new.email := old.email;
  new.criado_em := old.criado_em;

  if new.aceita_ofertas is distinct from old.aceita_ofertas then
    new.ofertas_aceitas_em := case when new.aceita_ofertas then now() end;
  else
    new.ofertas_aceitas_em := old.ofertas_aceitas_em;
  end if;

  if new.whatsapp is distinct from old.whatsapp then
    new.whatsapp_aceito_em := case when new.whatsapp is not null then now() end;
  else
    new.whatsapp_aceito_em := old.whatsapp_aceito_em;
  end if;

  -- Sem WhatsApp, não há ofertas por WhatsApp.
  if new.whatsapp is null then
    new.ofertas_whatsapp := false;
  end if;
  if new.ofertas_whatsapp is distinct from old.ofertas_whatsapp then
    new.ofertas_whatsapp_em := case when new.ofertas_whatsapp then now() end;
  else
    new.ofertas_whatsapp_em := old.ofertas_whatsapp_em;
  end if;

  return new;
end;
$$;
