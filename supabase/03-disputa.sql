-- Etapas 3 e 4: ranking do mês e desafios da semana.
-- Cole tudo no Supabase → SQL Editor → New query → Run (uma vez só).
--
-- Regras (horário de Brasília):
-- - +1 por filme em "Já assisti" no mês (só os vistos depois de entrar no grupo).
-- - +2 de bônus (3 no total) por filme do desafio visto na semana dele.
-- - Filme escolhido pelo campeão que alguém não viu até domingo: −1 para
--   essa pessoa e +2 para o campeão (só para quem já estava no grupo quando
--   a semana começou; quem já tinha visto antes não perde nada).
-- - Semanas de segunda a domingo; cada uma pertence ao mês da sua segunda.
-- - O campeão do mês anterior escolhe os filmes da 1ª semana do mês (a da
--   1ª segunda-feira) até a terça. Depois disso, qualquer um sorteia.
-- - Empate no ranking: vence quem chegou primeiro àquela pontuação.

-- ---------------------------------------------------------------
-- Desafios: os 3 filmes de cada semana, em cada grupo.
-- ---------------------------------------------------------------
create table public.desafios (
  grupo_id uuid not null references public.grupos on delete cascade,
  semana date not null, -- a segunda-feira da semana
  escolhido_por uuid references auth.users on delete set null, -- o campeão (null = sorteio)
  filmes jsonb not null check (jsonb_typeof(filmes) = 'array' and jsonb_array_length(filmes) = 3),
  criado_em timestamptz not null default now(),
  primary key (grupo_id, semana)
);

-- Sem políticas: só pelas funções abaixo.
alter table public.desafios enable row level security;

-- ---------------------------------------------------------------
-- Funções de dentro (o site não chama estas direto).
-- ---------------------------------------------------------------

-- Hoje, em Brasília.
create function public.hoje_br()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Sao_Paulo')::date;
$$;

-- A meia-noite (em Brasília) de um dia.
create function public.meia_noite_br(dia date)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select dia::timestamp at time zone 'America/Sao_Paulo';
$$;

-- A primeira segunda-feira do mês.
create function public.primeira_segunda(mes date)
returns date
language sql
immutable
set search_path = ''
as $$
  select mes + ((8 - extract(isodow from mes)::int) % 7);
$$;

-- O ranking do mês, do 1º ao último:
-- [{ id, nome, pontos, assistidos, desafios, faltas, bonus_campeao }]
create function public.pontos_do_mes(id_grupo uuid, mes date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with
  participantes as (
    select m.user_id, m.entrou_em, p.nome
    from public.membros m
    join public.perfis p on p.id = m.user_id
    where m.grupo_id = id_grupo
  ),
  vistos as (
    select mc.user_id, mc.filme_id, mc.assistido_em,
           (mc.assistido_em at time zone 'America/Sao_Paulo')::date as dia
    from public.marcacoes mc
    join participantes pa on pa.user_id = mc.user_id
    where mc.status = 'assisti' and mc.assistido_em is not null
  ),
  filmes_desafio as (
    select d.semana, d.escolhido_por, (f ->> 'id')::int as filme_id
    from public.desafios d
    cross join jsonb_array_elements(d.filmes) as f
    where d.grupo_id = id_grupo
      and d.semana >= mes
      and d.semana < (mes + interval '1 month')::date
  ),
  -- Filmes do campeão que alguém não viu até o fim da semana (já acabada).
  faltas as (
    select pa.user_id, fd.escolhido_por, public.meia_noite_br(fd.semana + 7) as quando
    from filmes_desafio fd
    join participantes pa on pa.user_id <> fd.escolhido_por
    where fd.escolhido_por is not null
      and now() >= public.meia_noite_br(fd.semana + 7)
      and pa.entrou_em < public.meia_noite_br(fd.semana)
      and not exists (
        select 1 from vistos v
        where v.user_id = pa.user_id and v.filme_id = fd.filme_id and v.dia < fd.semana + 7
      )
  ),
  -- Tudo que dá ou tira pontos, com o momento em que aconteceu.
  eventos as (
    select v.user_id, 1 as pontos, 'assistido' as tipo, v.assistido_em as quando
    from vistos v
    join participantes pa on pa.user_id = v.user_id
    where v.dia >= mes
      and v.dia < (mes + interval '1 month')::date
      and v.assistido_em >= pa.entrou_em
    union all
    select v.user_id, 2, 'desafio', v.assistido_em
    from filmes_desafio fd
    join vistos v on v.filme_id = fd.filme_id
    join participantes pa on pa.user_id = v.user_id
    where v.dia >= fd.semana
      and v.dia < fd.semana + 7
      and v.assistido_em >= pa.entrou_em
    union all
    select user_id, -1, 'falta', quando from faltas
    union all
    select escolhido_por, 2, 'campeao', quando from faltas
  ),
  totais as (
    select user_id,
           sum(pontos)::int as pontos,
           max(quando) as ultimo,
           count(*) filter (where tipo = 'assistido')::int as assistidos,
           count(*) filter (where tipo = 'desafio')::int as desafios,
           count(*) filter (where tipo = 'falta')::int as faltas,
           count(*) filter (where tipo = 'campeao')::int as bonus_campeao
    from eventos
    group by user_id
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', pa.user_id,
        'nome', pa.nome,
        'pontos', coalesce(t.pontos, 0),
        'assistidos', coalesce(t.assistidos, 0),
        'desafios', coalesce(t.desafios, 0),
        'faltas', coalesce(t.faltas, 0),
        'bonus_campeao', coalesce(t.bonus_campeao, 0)
      )
      -- Empate: quem chegou primeiro àquela pontuação (e, se ainda empatar,
      -- quem entrou no grupo primeiro).
      order by coalesce(t.pontos, 0) desc, t.ultimo asc nulls last, pa.entrou_em
    ),
    '[]'::jsonb
  )
  from participantes pa
  left join totais t on t.user_id = pa.user_id;
$$;

-- O campeão do mês: o 1º do ranking, se fez algum ponto.
create function public.campeao_do_mes(id_grupo uuid, mes date)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select (r ->> 'id')::uuid
  from jsonb_array_elements(public.pontos_do_mes(id_grupo, mes)) with ordinality as e(r, posicao)
  where (r ->> 'pontos')::int > 0
  order by posicao
  limit 1;
$$;

-- Quem escolhe os filmes da semana: o campeão do mês anterior, só na 1ª
-- semana do mês. null = a semana é de sorteio.
create function public.campeao_da_semana(id_grupo uuid, segunda date)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when segunda = public.primeira_segunda(date_trunc('month', segunda)::date)
    then public.campeao_do_mes(id_grupo, (date_trunc('month', segunda) - interval '1 month')::date)
  end;
$$;

create function public.participa(id_grupo uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.membros where grupo_id = id_grupo and user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------
-- Funções que o site chama.
-- ---------------------------------------------------------------

-- Tudo que a tela do grupo precisa: ranking do mês, campeão do mês
-- passado, desafio da semana (e quem já viu cada filme) e os filmes que
-- alguém do grupo já viu (para o sorteio não repetir).
create function public.disputa_do_grupo(id_grupo uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  dia_hoje date := public.hoje_br();
  segunda date := date_trunc('week', dia_hoje)::date;
  mes_atual date := date_trunc('month', dia_hoje)::date;
  mes_passado date := (date_trunc('month', dia_hoje) - interval '1 month')::date;
  campeao_mes uuid;
  escolhe uuid := public.campeao_da_semana(id_grupo, segunda);
  desafio record;
begin
  if not public.participa(id_grupo) then
    raise exception 'você não participa deste grupo';
  end if;

  -- O campeão do mês passado só está decidido depois que a última semana
  -- dele acabou (na 1ª segunda-feira deste mês).
  if dia_hoje >= public.primeira_segunda(mes_atual) then
    campeao_mes := public.campeao_do_mes(id_grupo, mes_passado);
  end if;

  select * into desafio from public.desafios d where d.grupo_id = id_grupo and d.semana = segunda;

  return jsonb_build_object(
    'eu', auth.uid(),
    'hoje', dia_hoje,
    'mes', mes_atual,
    'ranking', public.pontos_do_mes(id_grupo, mes_atual),
    'mes_passado', mes_passado,
    'campeao', (
      select jsonb_build_object('id', p.id, 'nome', p.nome) from public.perfis p where p.id = campeao_mes
    ),
    'semana', segunda,
    'escolhe', escolhe, -- o campeão que escolhe esta semana (ou null)
    'prazo_campeao', case when escolhe is not null then segunda + 1 end, -- até terça
    'desafio', case when desafio.grupo_id is not null then jsonb_build_object(
      'filmes', desafio.filmes,
      'escolhido_por', desafio.escolhido_por,
      -- Para cada filme do desafio: quem já viu (até o fim da semana).
      'quem_viu', (
        select coalesce(jsonb_object_agg(f ->> 'id', coalesce((
          select jsonb_agg(mc.user_id)
          from public.marcacoes mc
          join public.membros m on m.user_id = mc.user_id and m.grupo_id = id_grupo
          where mc.filme_id = (f ->> 'id')::int
            and mc.status = 'assisti'
            and (mc.assistido_em at time zone 'America/Sao_Paulo')::date < segunda + 7
        ), '[]'::jsonb)), '{}'::jsonb)
        from jsonb_array_elements(desafio.filmes) as f
      )
    ) end,
    'vistos', (
      select coalesce(jsonb_agg(distinct mc.filme_id), '[]'::jsonb)
      from public.marcacoes mc
      join public.membros m on m.user_id = mc.user_id and m.grupo_id = id_grupo
      where mc.status = 'assisti'
    )
  );
end;
$$;

-- Grava os 3 filmes do desafio desta semana. Na 1ª semana do mês, até a
-- terça, só o campeão pode escolher; fora isso, quem chegar primeiro
-- sorteia. Se a semana já tem desafio, nada muda. Devolve o desafio.
create function public.definir_desafio(id_grupo uuid, lista_filmes jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  dia_hoje date := public.hoje_br();
  segunda date := date_trunc('week', dia_hoje)::date;
  escolhe uuid := public.campeao_da_semana(id_grupo, segunda);
  escolhido uuid;
  limpos jsonb;
begin
  if not public.participa(id_grupo) then
    raise exception 'você não participa deste grupo';
  end if;

  -- Só o que a tela precisa de cada filme (e 3 filmes diferentes).
  select jsonb_agg(jsonb_build_object(
           'id', (f ->> 'id')::int,
           'title', left(f ->> 'title', 200),
           'poster_path', left(f ->> 'poster_path', 200),
           'release_date', left(f ->> 'release_date', 20),
           'vote_average', (f ->> 'vote_average')::numeric
         ))
  into limpos
  from jsonb_array_elements(lista_filmes) as f;

  if jsonb_array_length(coalesce(limpos, '[]'::jsonb)) <> 3
     or (select count(distinct f ->> 'id') from jsonb_array_elements(limpos) as f) <> 3 then
    raise exception 'escolha 3 filmes diferentes';
  end if;

  if escolhe is not null and dia_hoje <= segunda + 1 then
    if auth.uid() is distinct from escolhe then
      raise exception 'aguardando o campeão escolher';
    end if;
    escolhido := escolhe;
  end if;

  insert into public.desafios (grupo_id, semana, escolhido_por, filmes)
  values (id_grupo, segunda, escolhido, limpos)
  on conflict do nothing;

  return (
    select jsonb_build_object('filmes', d.filmes, 'escolhido_por', d.escolhido_por)
    from public.desafios d
    where d.grupo_id = id_grupo and d.semana = segunda
  );
end;
$$;

-- ---------------------------------------------------------------
-- Permissões: o site só chama disputa_do_grupo e definir_desafio.
-- ---------------------------------------------------------------
revoke execute on function
  public.hoje_br(),
  public.meia_noite_br(date),
  public.primeira_segunda(date),
  public.pontos_do_mes(uuid, date),
  public.campeao_do_mes(uuid, date),
  public.campeao_da_semana(uuid, date),
  public.participa(uuid),
  public.disputa_do_grupo(uuid),
  public.definir_desafio(uuid, jsonb)
from public, anon, authenticated;

grant execute on function
  public.disputa_do_grupo(uuid),
  public.definir_desafio(uuid, jsonb)
to authenticated;
