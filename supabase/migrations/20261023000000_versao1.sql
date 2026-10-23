-- =====================================================================
-- Meu Conselho de Saúde — Versão 1
-- Perfil, conselhos/UBS, diretoria, trilhas educativas, questões e XP.
-- =====================================================================

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type public.segmento as enum ('usuario', 'trabalhador', 'gestao', 'prestador', 'sem_vinculo');
create type public.cargo_diretoria as enum ('presidente', 'vice_presidente', 'primeiro_secretario', 'segundo_secretario', 'outro');
create type public.status_diretoria as enum ('provisoria', 'confirmada');
create type public.tipo_aula as enum ('texto', 'video', 'pdf');
create type public.uso_questao as enum ('curso', 'desafio');
create type public.status_pedido as enum ('pendente', 'aceito', 'recusado');

-- ---------------------------------------------------------------------
-- Localidades (IBGE) e Unidades Básicas de Saúde (CNES)
-- ---------------------------------------------------------------------
create table public.estados (
  uf   char(2) primary key,
  nome text not null
);

create table public.municipios (
  id   integer primary key,           -- código IBGE de 7 dígitos
  nome text not null,
  uf   char(2) not null references public.estados (uf)
);
create index municipios_uf_idx on public.municipios (uf);

create table public.ubs (
  id           uuid primary key default gen_random_uuid(),
  cnes         text unique,           -- nulo quando cadastrada manualmente
  nome         text not null,
  bairro       text,
  endereco     text,
  municipio_id integer not null references public.municipios (id),
  criada_por   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index ubs_municipio_idx on public.ubs (municipio_id);

-- ---------------------------------------------------------------------
-- Conselhos
-- ---------------------------------------------------------------------
create table public.conselhos (
  id                uuid primary key default gen_random_uuid(),
  nome              text not null check (length(trim(nome)) >= 3),
  nome_normalizado  text not null default '',
  municipio_id      integer not null references public.municipios (id),
  descricao         text,
  local_reunioes    text,
  horario_reunioes  text,
  status_diretoria  public.status_diretoria not null default 'provisoria',
  mandato_inicio    date,
  mandato_fim       date,
  criado_por        uuid references auth.users (id) on delete set null,
  mesclado_em       uuid references public.conselhos (id),  -- preenchido quando o admin junta duplicados
  created_at        timestamptz not null default now()
);
create index conselhos_municipio_idx on public.conselhos (municipio_id);
create index conselhos_nome_trgm_idx on public.conselhos using gin (nome_normalizado extensions.gin_trgm_ops);

create table public.conselho_ubs (
  conselho_id uuid not null references public.conselhos (id) on delete cascade,
  ubs_id      uuid not null references public.ubs (id) on delete cascade,
  primary key (conselho_id, ubs_id)
);
create index conselho_ubs_ubs_idx on public.conselho_ubs (ubs_id);

-- Remove acentos, caixa e palavras genéricas para comparar nomes de conselhos.
create or replace function public.normalizar_nome_conselho(texto text)
returns text
language sql
stable
set search_path = public, extensions
as $$
  select trim(regexp_replace(
    regexp_replace(
      regexp_replace(lower(unaccent(coalesce(texto, ''))), '[^a-z0-9 ]', ' ', 'g'),
      '\m(conselho|local|locais|gestor|gestora|de|da|do|das|dos|saude|cls|clsu|ubs|usf|unidade|basica)\M', ' ', 'g'),
    '\s+', ' ', 'g'));
$$;

create or replace function public.tg_conselho_normalizar()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.nome := trim(regexp_replace(new.nome, '\s+', ' ', 'g'));
  new.nome_normalizado := public.normalizar_nome_conselho(new.nome);
  return new;
end;
$$;

create trigger conselho_normalizar
before insert or update of nome on public.conselhos
for each row execute function public.tg_conselho_normalizar();

-- ---------------------------------------------------------------------
-- Perfis
-- ---------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  nome         text not null default '',
  avatar_url   text,
  municipio_id integer references public.municipios (id),
  segmento     public.segmento,
  conselho_id  uuid references public.conselhos (id) on delete set null,
  ubs_id       uuid references public.ubs (id) on delete set null,
  is_admin     boolean not null default false,
  xp           integer not null default 0,
  created_at   timestamptz not null default now(),
  -- Quem tem segmento precisa de cidade; quem tem vínculo informa o conselho.
  constraint perfil_conselho_obrigatorio check (
    segmento is null or segmento = 'sem_vinculo' or conselho_id is not null
  )
);
create index profiles_conselho_idx on public.profiles (conselho_id);
create index profiles_municipio_idx on public.profiles (municipio_id);

-- Cria o perfil automaticamente no primeiro login com Google.
create or replace function public.tg_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nome, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.tg_novo_usuario();

-- O próprio usuário não pode se dar XP nem virar admin. As funções do sistema
-- (security definer) e o SQL Editor do Supabase rodam com outro papel e passam.
create or replace function public.tg_profiles_protegidos()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.xp := old.xp;
    new.is_admin := old.is_admin;
  end if;
  return new;
end;
$$;

create trigger profiles_protegidos
before update on public.profiles
for each row execute function public.tg_profiles_protegidos();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- ---------------------------------------------------------------------
-- Diretoria, seguidores e pedidos de participação
-- ---------------------------------------------------------------------
create table public.diretoria (
  conselho_id uuid not null references public.conselhos (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  cargo       public.cargo_diretoria not null,
  created_at  timestamptz not null default now(),
  primary key (conselho_id, user_id)
);
create index diretoria_user_idx on public.diretoria (user_id);

create or replace function public.is_diretoria(p_conselho uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.diretoria where conselho_id = p_conselho and user_id = auth.uid());
$$;

create table public.seguidores_conselho (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  conselho_id uuid not null references public.conselhos (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, conselho_id)
);

create table public.pedidos_participacao (
  id          uuid primary key default gen_random_uuid(),
  conselho_id uuid not null references public.conselhos (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  mensagem    text,
  status      public.status_pedido not null default 'pendente',
  resposta    text,
  created_at  timestamptz not null default now(),
  respondido_em timestamptz,
  unique (conselho_id, user_id)
);

-- ---------------------------------------------------------------------
-- Conteúdo educativo
-- ---------------------------------------------------------------------
create table public.trilhas (
  id             uuid primary key default gen_random_uuid(),
  titulo         text not null,
  descricao      text,
  ordem          integer not null default 0,
  medalha_nome   text not null,
  medalha_emoji  text not null default '🏅',
  publicada      boolean not null default false,
  created_at     timestamptz not null default now()
);

create table public.cursos (
  id         uuid primary key default gen_random_uuid(),
  trilha_id  uuid not null references public.trilhas (id) on delete cascade,
  titulo     text not null,
  descricao  text,
  ordem      integer not null default 0,
  created_at timestamptz not null default now()
);
create index cursos_trilha_idx on public.cursos (trilha_id);

create table public.aulas (
  id         uuid primary key default gen_random_uuid(),
  curso_id   uuid not null references public.cursos (id) on delete cascade,
  titulo     text not null,
  tipo       public.tipo_aula not null,
  texto      text,              -- conteúdo da aula de texto (Markdown simples)
  video_url  text,              -- link do YouTube
  pdf_url    text,              -- arquivo no Storage ou link externo
  ordem      integer not null default 0,
  created_at timestamptz not null default now()
);
create index aulas_curso_idx on public.aulas (curso_id);

-- Questões: o gabarito fica numa tabela separada que só o admin lê,
-- para que ninguém descubra a resposta inspecionando o app.
create table public.questoes (
  id           uuid primary key default gen_random_uuid(),
  trilha_id    uuid not null references public.trilhas (id) on delete cascade,
  curso_id     uuid references public.cursos (id) on delete cascade,
  uso          public.uso_questao not null default 'curso',
  enunciado    text not null,
  alternativas jsonb not null check (jsonb_typeof(alternativas) = 'array' and jsonb_array_length(alternativas) between 2 and 6),
  ordem        integer not null default 0,
  constraint questao_curso_obrigatorio check (uso = 'desafio' or curso_id is not null)
);
create index questoes_curso_idx on public.questoes (curso_id);

create table public.gabaritos (
  questao_id uuid primary key references public.questoes (id) on delete cascade,
  correta    smallint not null check (correta >= 0),  -- índice da alternativa correta (0 = primeira)
  explicacao text
);

-- Interação com aulas
create table public.comentarios_aula (
  id         uuid primary key default gen_random_uuid(),
  aula_id    uuid not null references public.aulas (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  texto      text not null check (length(trim(texto)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index comentarios_aula_idx on public.comentarios_aula (aula_id, created_at);

create table public.curtidas_aula (
  aula_id uuid not null references public.aulas (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (aula_id, user_id)
);

create table public.aulas_salvas (
  aula_id    uuid not null references public.aulas (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (aula_id, user_id)
);

-- ---------------------------------------------------------------------
-- Progresso e XP
-- ---------------------------------------------------------------------
create table public.aulas_concluidas (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  aula_id    uuid not null references public.aulas (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, aula_id)
);

create table public.tentativas_quiz (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  curso_id   uuid not null references public.cursos (id) on delete cascade,
  acertos    integer not null,
  total      integer not null,
  aprovado   boolean not null,
  created_at timestamptz not null default now()
);
create index tentativas_user_curso_idx on public.tentativas_quiz (user_id, curso_id);

create table public.cursos_aprovados (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  curso_id   uuid not null references public.cursos (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, curso_id)
);

-- Uma trilha concluída = uma medalha no perfil.
create table public.medalhas (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  trilha_id  uuid not null references public.trilhas (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, trilha_id)
);

-- Histórico de XP (base para o ranking mensal da Versão 3).
create table public.xp_eventos (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  pontos     integer not null,
  motivo     text not null,
  referencia uuid,
  created_at timestamptz not null default now()
);
create index xp_eventos_user_idx on public.xp_eventos (user_id, created_at);

create or replace function public.dar_xp(p_user uuid, p_pontos integer, p_motivo text, p_ref uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.xp_eventos (user_id, pontos, motivo, referencia) values (p_user, p_pontos, p_motivo, p_ref);
  update public.profiles set xp = xp + p_pontos where id = p_user;
end;
$$;
revoke all on function public.dar_xp(uuid, integer, text, uuid) from public, anon, authenticated;

-- Valores de XP (ver docs/MODELAGEM.md)
--   aula concluída            +10
--   questionário aprovado     +50  (+20 se acertar 100% na primeira tentativa)
--   trilha concluída          +200 e medalha

create or replace function public.verificar_trilha(p_user uuid, p_trilha uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  faltam integer;
begin
  if exists (select 1 from public.medalhas where user_id = p_user and trilha_id = p_trilha) then
    return false;
  end if;
  select count(*) into faltam
  from public.cursos c
  where c.trilha_id = p_trilha
    and not exists (select 1 from public.cursos_aprovados ca where ca.user_id = p_user and ca.curso_id = c.id);
  if faltam > 0 or not exists (select 1 from public.cursos where trilha_id = p_trilha) then
    return false;
  end if;
  insert into public.medalhas (user_id, trilha_id) values (p_user, p_trilha);
  perform public.dar_xp(p_user, 200, 'trilha_concluida', p_trilha);
  return true;
end;
$$;
revoke all on function public.verificar_trilha(uuid, uuid) from public, anon, authenticated;

create or replace function public.concluir_aula(p_aula uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Não autenticado'; end if;
  insert into public.aulas_concluidas (user_id, aula_id) values (uid, p_aula) on conflict do nothing;
  if not found then
    return 0;
  end if;
  perform public.dar_xp(uid, 10, 'aula_concluida', p_aula);
  return 10;
end;
$$;

-- Corrige o questionário no servidor. p_respostas: [{"questao_id": "...", "resposta": 0}, ...]
create or replace function public.enviar_questionario(p_curso uuid, p_respostas jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid           uuid := auth.uid();
  v_trilha      uuid;
  v_total       integer;
  v_acertos     integer;
  v_aprovado    boolean;
  v_primeira    boolean;
  v_ja_aprovado boolean;
  v_xp          integer := 0;
  v_medalha     boolean := false;
  v_correcao    jsonb;
begin
  if uid is null then raise exception 'Não autenticado'; end if;

  select trilha_id into v_trilha from public.cursos where id = p_curso;
  if v_trilha is null then raise exception 'Curso não encontrado'; end if;

  select count(*) into v_total from public.questoes where curso_id = p_curso and uso = 'curso';
  if v_total = 0 then raise exception 'Este curso ainda não tem questões'; end if;

  with respostas as (
    select distinct on (questao_id) questao_id, resposta
    from (
      select (r ->> 'questao_id')::uuid as questao_id, (r ->> 'resposta')::int as resposta
      from jsonb_array_elements(p_respostas) r
    ) x
  )
  select
    count(*) filter (where r.resposta = g.correta),
    jsonb_agg(jsonb_build_object(
      'questao_id', q.id,
      'resposta', r.resposta,
      'correta', g.correta,
      'acertou', r.resposta is not distinct from g.correta,
      'explicacao', g.explicacao
    ) order by q.ordem)
  into v_acertos, v_correcao
  from public.questoes q
  join public.gabaritos g on g.questao_id = q.id
  left join respostas r on r.questao_id = q.id
  where q.curso_id = p_curso and q.uso = 'curso';

  v_aprovado := v_acertos * 100 >= v_total * 70;
  v_primeira := not exists (select 1 from public.tentativas_quiz where user_id = uid and curso_id = p_curso);
  v_ja_aprovado := exists (select 1 from public.cursos_aprovados where user_id = uid and curso_id = p_curso);

  insert into public.tentativas_quiz (user_id, curso_id, acertos, total, aprovado)
  values (uid, p_curso, v_acertos, v_total, v_aprovado);

  -- Refazer um questionário já aprovado não rende XP de novo.
  if v_aprovado and not v_ja_aprovado then
    insert into public.cursos_aprovados (user_id, curso_id) values (uid, p_curso);
    perform public.dar_xp(uid, 50, 'questionario_aprovado', p_curso);
    v_xp := 50;
    if v_primeira and v_acertos = v_total then
      perform public.dar_xp(uid, 20, 'bonus_100_primeira', p_curso);
      v_xp := v_xp + 20;
    end if;
    v_medalha := public.verificar_trilha(uid, v_trilha);
    if v_medalha then
      v_xp := v_xp + 200;
    end if;
  end if;

  return jsonb_build_object(
    'acertos', v_acertos,
    'total', v_total,
    'aprovado', v_aprovado,
    'xp_ganho', v_xp,
    'medalha', v_medalha,
    'correcao', v_correcao
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Funções de conselho
-- ---------------------------------------------------------------------

-- Sugere conselhos parecidos na cidade enquanto a pessoa digita.
create or replace function public.buscar_conselhos(p_municipio integer, p_termo text)
returns table (id uuid, nome text, similaridade real, membros bigint, ubs text[])
language sql
stable
security definer
set search_path = public, extensions
as $$
  with termo as (select public.normalizar_nome_conselho(p_termo) as t)
  select c.id, c.nome,
         greatest(similarity(c.nome_normalizado, termo.t), word_similarity(termo.t, c.nome_normalizado)) as similaridade,
         (select count(*) from public.profiles p where p.conselho_id = c.id) as membros,
         array(select u.nome from public.conselho_ubs cu join public.ubs u on u.id = cu.ubs_id where cu.conselho_id = c.id order by u.nome) as ubs
  from public.conselhos c, termo
  where c.municipio_id = p_municipio
    and c.mesclado_em is null
    and (
      termo.t = ''
      or c.nome_normalizado like '%' || termo.t || '%'
      or similarity(c.nome_normalizado, termo.t) > 0.25
      or word_similarity(termo.t, c.nome_normalizado) > 0.4
    )
  order by similaridade desc, c.nome
  limit 10;
$$;

-- Conselhos que atendem uma UBS (cartão "A sua UBS tem um Conselho Local de Saúde!").
create or replace function public.conselhos_da_ubs(p_ubs uuid)
returns table (id uuid, nome text, membros bigint)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.nome, (select count(*) from public.profiles p where p.conselho_id = c.id)
  from public.conselho_ubs cu
  join public.conselhos c on c.id = cu.conselho_id
  where cu.ubs_id = p_ubs and c.mesclado_em is null
  order by c.nome;
$$;

-- Cadastra um conselho novo. Quem cadastra vira diretoria provisória.
create or replace function public.criar_conselho(
  p_nome text,
  p_municipio integer,
  p_ubs uuid[],
  p_cargo public.cargo_diretoria default 'presidente'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_id uuid;
begin
  if uid is null then raise exception 'Não autenticado'; end if;
  if coalesce(array_length(p_ubs, 1), 0) = 0 then
    raise exception 'Informe ao menos uma UBS atendida pelo conselho';
  end if;
  if exists (select 1 from public.ubs where id = any (p_ubs) and municipio_id <> p_municipio) then
    raise exception 'As UBS precisam ser da mesma cidade do conselho';
  end if;

  insert into public.conselhos (nome, municipio_id, criado_por)
  values (p_nome, p_municipio, uid)
  returning id into v_id;

  insert into public.conselho_ubs (conselho_id, ubs_id)
  select v_id, unnest(p_ubs) on conflict do nothing;

  insert into public.diretoria (conselho_id, user_id, cargo) values (v_id, uid, p_cargo);
  insert into public.seguidores_conselho (user_id, conselho_id) values (uid, v_id) on conflict do nothing;
  update public.profiles set conselho_id = v_id, municipio_id = p_municipio where id = uid;

  return v_id;
end;
$$;

-- Adiciona alguém à diretoria (só a diretoria do conselho ou o admin).
create or replace function public.definir_diretoria(p_conselho uuid, p_user uuid, p_cargo public.cargo_diretoria)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_diretoria(p_conselho) or public.is_admin()) then
    raise exception 'Apenas a diretoria do conselho pode fazer isso';
  end if;
  if not exists (select 1 from public.profiles where id = p_user and conselho_id = p_conselho) then
    raise exception 'A pessoa precisa ser membro do conselho';
  end if;
  insert into public.diretoria (conselho_id, user_id, cargo) values (p_conselho, p_user, p_cargo)
  on conflict (conselho_id, user_id) do update set cargo = excluded.cargo;
end;
$$;

create or replace function public.remover_diretoria(p_conselho uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_diretoria(p_conselho) or public.is_admin()) then
    raise exception 'Apenas a diretoria do conselho pode fazer isso';
  end if;
  if (select count(*) from public.diretoria where conselho_id = p_conselho) <= 1 and not public.is_admin() then
    raise exception 'O conselho precisa ter ao menos uma pessoa na diretoria';
  end if;
  delete from public.diretoria where conselho_id = p_conselho and user_id = p_user;
end;
$$;

-- Remove um membro que se cadastrou no conselho errado.
create or replace function public.remover_membro(p_conselho uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_diretoria(p_conselho) or public.is_admin()) then
    raise exception 'Apenas a diretoria do conselho pode fazer isso';
  end if;
  if p_user = auth.uid() then
    raise exception 'Use "sair do conselho" no seu perfil';
  end if;
  delete from public.diretoria where conselho_id = p_conselho and user_id = p_user;
  update public.profiles
     set conselho_id = null, segmento = 'sem_vinculo'
   where id = p_user and conselho_id = p_conselho;
end;
$$;

-- "Quero participar": segue o conselho e avisa a diretoria.
create or replace function public.quero_participar(p_conselho uuid, p_mensagem text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Não autenticado'; end if;
  insert into public.seguidores_conselho (user_id, conselho_id) values (uid, p_conselho) on conflict do nothing;
  insert into public.pedidos_participacao (conselho_id, user_id, mensagem)
  values (p_conselho, uid, nullif(trim(p_mensagem), ''))
  on conflict (conselho_id, user_id) do update
    set mensagem = excluded.mensagem, status = 'pendente', created_at = now(), resposta = null, respondido_em = null
    where pedidos_participacao.status <> 'pendente';
end;
$$;

create or replace function public.responder_pedido(p_pedido uuid, p_status public.status_pedido, p_resposta text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conselho uuid;
begin
  select conselho_id into v_conselho from public.pedidos_participacao where id = p_pedido;
  if v_conselho is null or not public.is_diretoria(v_conselho) then
    raise exception 'Apenas a diretoria do conselho pode responder';
  end if;
  update public.pedidos_participacao
     set status = p_status, resposta = nullif(trim(p_resposta), ''), respondido_em = now()
   where id = p_pedido;
end;
$$;

-- Admin: junta um conselho duplicado em outro e move membros, diretoria e UBS.
create or replace function public.mesclar_conselhos(p_origem uuid, p_destino uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Apenas administradores'; end if;
  if p_origem = p_destino then raise exception 'Escolha conselhos diferentes'; end if;

  update public.profiles set conselho_id = p_destino where conselho_id = p_origem;
  insert into public.conselho_ubs (conselho_id, ubs_id)
    select p_destino, ubs_id from public.conselho_ubs where conselho_id = p_origem on conflict do nothing;
  insert into public.diretoria (conselho_id, user_id, cargo)
    select p_destino, user_id, cargo from public.diretoria where conselho_id = p_origem on conflict do nothing;
  insert into public.seguidores_conselho (user_id, conselho_id)
    select user_id, p_destino from public.seguidores_conselho where conselho_id = p_origem on conflict do nothing;
  insert into public.pedidos_participacao (conselho_id, user_id, mensagem, status, resposta, created_at, respondido_em)
    select p_destino, user_id, mensagem, status, resposta, created_at, respondido_em
    from public.pedidos_participacao where conselho_id = p_origem on conflict do nothing;

  delete from public.conselho_ubs where conselho_id = p_origem;
  delete from public.diretoria where conselho_id = p_origem;
  delete from public.seguidores_conselho where conselho_id = p_origem;
  delete from public.pedidos_participacao where conselho_id = p_origem;
  update public.conselhos set mesclado_em = p_destino where id = p_origem;
end;
$$;

-- ---------------------------------------------------------------------
-- Segurança (Row Level Security)
-- ---------------------------------------------------------------------
alter table public.estados              enable row level security;
alter table public.municipios           enable row level security;
alter table public.ubs                  enable row level security;
alter table public.conselhos            enable row level security;
alter table public.conselho_ubs         enable row level security;
alter table public.profiles             enable row level security;
alter table public.diretoria            enable row level security;
alter table public.seguidores_conselho  enable row level security;
alter table public.pedidos_participacao enable row level security;
alter table public.trilhas              enable row level security;
alter table public.cursos               enable row level security;
alter table public.aulas                enable row level security;
alter table public.questoes             enable row level security;
alter table public.gabaritos            enable row level security;
alter table public.comentarios_aula     enable row level security;
alter table public.curtidas_aula        enable row level security;
alter table public.aulas_salvas         enable row level security;
alter table public.aulas_concluidas     enable row level security;
alter table public.tentativas_quiz      enable row level security;
alter table public.cursos_aprovados     enable row level security;
alter table public.medalhas             enable row level security;
alter table public.xp_eventos           enable row level security;

-- Localidades: leitura pública
create policy "leitura publica" on public.estados    for select using (true);
create policy "leitura publica" on public.municipios for select using (true);

-- UBS: leitura pública; usuário logado pode cadastrar uma UBS que não esteja na lista
create policy "leitura publica" on public.ubs for select using (true);
create policy "cadastrar ubs" on public.ubs for insert to authenticated
  with check (cnes is null and criada_por = auth.uid());
create policy "admin edita ubs" on public.ubs for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Conselhos: leitura pública; criação via criar_conselho(); diretoria edita
create policy "leitura publica" on public.conselhos for select using (true);
create policy "diretoria edita" on public.conselhos for update to authenticated
  using (public.is_diretoria(id) or public.is_admin())
  with check (public.is_diretoria(id) or public.is_admin());
create policy "admin apaga" on public.conselhos for delete to authenticated using (public.is_admin());

create policy "leitura publica" on public.conselho_ubs for select using (true);
create policy "diretoria gerencia ubs" on public.conselho_ubs for all to authenticated
  using (public.is_diretoria(conselho_id) or public.is_admin())
  with check (public.is_diretoria(conselho_id) or public.is_admin());

-- Perfis: todos os logados veem; cada um edita o seu
create policy "perfis visiveis" on public.profiles for select to authenticated using (true);
create policy "edita o proprio" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy "admin edita" on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Diretoria: leitura pública; alterações via funções
create policy "leitura publica" on public.diretoria for select using (true);

-- Seguidores
create policy "leitura" on public.seguidores_conselho for select to authenticated using (true);
create policy "seguir" on public.seguidores_conselho for insert to authenticated with check (user_id = auth.uid());
create policy "deixar de seguir" on public.seguidores_conselho for delete to authenticated using (user_id = auth.uid());

-- Pedidos: quem pediu e a diretoria do conselho
create policy "ver pedidos" on public.pedidos_participacao for select to authenticated
  using (user_id = auth.uid() or public.is_diretoria(conselho_id) or public.is_admin());

-- Conteúdo educativo: publicado é público; admin vê e edita tudo
create policy "trilhas publicadas" on public.trilhas for select
  using (publicada or public.is_admin());
create policy "admin" on public.trilhas for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "cursos publicados" on public.cursos for select
  using (exists (select 1 from public.trilhas t where t.id = trilha_id and (t.publicada or public.is_admin())));
create policy "admin" on public.cursos for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "aulas publicadas" on public.aulas for select
  using (exists (select 1 from public.cursos c join public.trilhas t on t.id = c.trilha_id
                 where c.id = curso_id and (t.publicada or public.is_admin())));
create policy "admin" on public.aulas for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "questoes de curso publicadas" on public.questoes for select to authenticated
  using ((uso = 'curso' and exists (select 1 from public.trilhas t where t.id = trilha_id and t.publicada))
         or public.is_admin());
create policy "admin" on public.questoes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "so admin" on public.gabaritos for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Comentários, curtidas e salvos
create policy "ler comentarios" on public.comentarios_aula for select to authenticated using (true);
create policy "comentar" on public.comentarios_aula for insert to authenticated with check (user_id = auth.uid());
create policy "apagar o proprio" on public.comentarios_aula for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "ler curtidas" on public.curtidas_aula for select to authenticated using (true);
create policy "curtir" on public.curtidas_aula for insert to authenticated with check (user_id = auth.uid());
create policy "descurtir" on public.curtidas_aula for delete to authenticated using (user_id = auth.uid());

create policy "meus salvos" on public.aulas_salvas for select to authenticated using (user_id = auth.uid());
create policy "salvar" on public.aulas_salvas for insert to authenticated with check (user_id = auth.uid());
create policy "remover salvo" on public.aulas_salvas for delete to authenticated using (user_id = auth.uid());

-- Progresso: cada um vê o seu; medalhas são públicas; gravação só via funções
create policy "meu progresso" on public.aulas_concluidas for select to authenticated using (user_id = auth.uid());
create policy "minhas tentativas" on public.tentativas_quiz for select to authenticated using (user_id = auth.uid());
create policy "meus cursos" on public.cursos_aprovados for select to authenticated using (user_id = auth.uid());
create policy "medalhas publicas" on public.medalhas for select to authenticated using (true);
create policy "meu xp" on public.xp_eventos for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Armazenamento de PDFs das aulas
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('materiais', 'materiais', true)
on conflict (id) do nothing;

create policy "materiais leitura publica" on storage.objects for select
  using (bucket_id = 'materiais');
create policy "materiais admin envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'materiais' and public.is_admin());
create policy "materiais admin apaga" on storage.objects for delete to authenticated
  using (bucket_id = 'materiais' and public.is_admin());
