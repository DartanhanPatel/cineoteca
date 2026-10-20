-- Etapa 5: tabela de leads (só quem aceitou receber ofertas).
-- Cole tudo no Supabase → SQL Editor → New query → Run (uma vez só).
--
-- Fica no esquema "privado", que o site NÃO enxerga: só você, pelo painel.
-- Para ver ou baixar: SQL Editor → select * from privado.leads; → Export → CSV.
--
-- LGPD: o e-mail só aparece de quem aceitou ofertas por e-mail, e o WhatsApp
-- só de quem aceitou ofertas pelo WhatsApp (com a data de cada aceite).

create schema if not exists privado;
revoke all on schema privado from public, anon, authenticated;

create view privado.leads as
with
-- Nomes dos gêneros da TMDB.
generos (id, nome) as (
  values
    (28, 'Ação'), (12, 'Aventura'), (16, 'Animação'), (35, 'Comédia'),
    (80, 'Crime'), (99, 'Documentário'), (18, 'Drama'), (10751, 'Família'),
    (14, 'Fantasia'), (36, 'História'), (27, 'Terror'), (10402, 'Música'),
    (9648, 'Mistério'), (10749, 'Romance'), (878, 'Ficção científica'),
    (10770, 'Cinema TV'), (53, 'Thriller'), (10752, 'Guerra'), (37, 'Faroeste')
),
-- Os mesmos pontos das recomendações do site: ✓ +2, só "Já assisti" +1, ✗ −2.
pontos_por_genero as (
  select mc.user_id, g.nome,
         sum(case
               when mc.avaliacao = 'gostei' then 2
               when mc.avaliacao = 'nao' then -2
               when mc.status = 'assisti' then 1
               else 0
             end) as pontos
  from public.marcacoes mc
  cross join unnest(mc.generos) as genero_id
  join generos g on g.id = genero_id
  group by mc.user_id, g.nome
),
favoritos as (
  select user_id, string_agg(nome, ', ' order by posicao) as generos
  from (
    select user_id, nome, row_number() over (partition by user_id order by pontos desc, nome) as posicao
    from pontos_por_genero
    where pontos > 0
  ) as ordenados
  where posicao <= 3
  group by user_id
)
select
  p.nome,
  case when p.aceita_ofertas then p.email end as email,
  p.ofertas_aceitas_em as email_aceito_em,
  case when p.ofertas_whatsapp then p.whatsapp end as whatsapp,
  p.ofertas_whatsapp_em as whatsapp_aceito_em,
  f.generos as generos_favoritos,
  (select count(*) from public.marcacoes mc where mc.user_id = p.id and mc.status = 'assisti') as filmes_assistidos,
  (select count(*) from public.marcacoes mc where mc.user_id = p.id and mc.status = 'quero') as quero_assistir,
  (select count(*) from public.membros m where m.user_id = p.id) as grupos,
  p.criado_em as cadastro_em,
  u.last_sign_in_at as ultimo_acesso
from public.perfis p
join auth.users u on u.id = p.id
left join favoritos f on f.user_id = p.id
where p.aceita_ofertas or p.ofertas_whatsapp
order by p.criado_em desc;

revoke all on privado.leads from public, anon, authenticated;
