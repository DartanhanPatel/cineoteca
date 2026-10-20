-- Etapa 1: contas e marcações na nuvem.
-- Cole tudo no Supabase → SQL Editor → New query → Run (uma vez só).

-- ---------------------------------------------------------------
-- Perfis: um por conta, criado sozinho no cadastro.
-- ---------------------------------------------------------------
create table public.perfis (
  id uuid primary key references auth.users on delete cascade,
  nome text not null default '',
  email text,
  aceita_ofertas boolean not null default false,
  -- Quando a pessoa aceitou receber ofertas (prova do aceite, LGPD).
  ofertas_aceitas_em timestamptz,
  criado_em timestamptz not null default now()
);

-- Ao criar uma conta, cria o perfil com o nome e o aceite do cadastro.
create function public.criar_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  aceita boolean := coalesce((new.raw_user_meta_data ->> 'aceita_ofertas')::boolean, false);
begin
  insert into public.perfis (id, nome, email, aceita_ofertas, ofertas_aceitas_em)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', ''),
    new.email,
    aceita,
    case when aceita then now() end
  );
  return new;
end;
$$;

create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil();

-- Ao mudar o perfil: a data do aceite é sempre a do servidor, e o e-mail e
-- a data de criação não podem ser trocados pelo site.
create function public.carimbar_perfil()
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
  return new;
end;
$$;

create trigger ao_mudar_perfil
  before update on public.perfis
  for each row execute function public.carimbar_perfil();

-- Cada um só vê e só muda o próprio perfil.
alter table public.perfis enable row level security;

create policy "ver o próprio perfil" on public.perfis
  for select to authenticated
  using ((select auth.uid()) = id);

create policy "mudar o próprio perfil" on public.perfis
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

grant select, update on public.perfis to authenticated;

-- ---------------------------------------------------------------
-- Marcações: uma linha por filme marcado (✓/✗, Quero assistir,
-- Já assisti). Desmarcar deixa a linha sem avaliação nem status.
-- ---------------------------------------------------------------
create table public.marcacoes (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  filme_id integer not null,
  avaliacao text check (avaliacao in ('gostei', 'nao')),
  status text check (status in ('quero', 'assisti')),
  generos integer[] not null default '{}',
  filme jsonb, -- título, pôster etc., para desenhar o card
  atualizado_em bigint not null, -- hora da última mudança (milissegundos)
  assistido_em timestamptz, -- quando entrou em "Já assisti" (para o ranking)
  primary key (user_id, filme_id)
);

-- Cada um só vê e só muda as próprias marcações.
alter table public.marcacoes enable row level security;

create policy "minhas marcações" on public.marcacoes
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.marcacoes to authenticated;
