-- =====================================================================
-- Meu Conselho de Saúde — Versão 2
-- Feed (Nacional / Minha cidade / Seguindo), seguir pessoas, mural do
-- conselho, eventos com lembrete, denúncias e inatividade da diretoria.
-- =====================================================================

create type public.escopo_post as enum ('publico', 'mural');
create type public.tipo_post as enum ('normal', 'ata', 'aviso');
create type public.tipo_evento as enum ('reuniao', 'conferencia', 'outro');
create type public.status_denuncia as enum ('pendente', 'removido', 'ignorado');
create type public.alvo_denuncia as enum ('post', 'comentario_post', 'comentario_aula');

-- ---------------------------------------------------------------------
-- Funções auxiliares
-- ---------------------------------------------------------------------
create or replace function public.is_membro(p_conselho uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and conselho_id = p_conselho)
      or public.is_diretoria(p_conselho);
$$;

-- ---------------------------------------------------------------------
-- Seguir pessoas
-- ---------------------------------------------------------------------
create table public.seguidores_pessoa (
  seguidor_id uuid not null references public.profiles (id) on delete cascade,
  seguido_id  uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (seguidor_id, seguido_id),
  check (seguidor_id <> seguido_id)
);
create index seguidores_pessoa_seguido_idx on public.seguidores_pessoa (seguido_id);

-- ---------------------------------------------------------------------
-- Publicações
--   escopo 'publico': aparece no feed (Nacional, Minha cidade, Seguindo)
--   escopo 'mural'  : só membros do conselho veem
--   conselho_id em post público = publicado pela diretoria em nome do conselho
-- ---------------------------------------------------------------------
create table public.posts (
  id           uuid primary key default gen_random_uuid(),
  autor_id     uuid not null references public.profiles (id) on delete cascade,
  conselho_id  uuid references public.conselhos (id) on delete cascade,
  municipio_id integer references public.municipios (id),
  escopo       public.escopo_post not null default 'publico',
  tipo         public.tipo_post not null default 'normal',
  texto        text not null default '' check (length(texto) <= 5000),
  link_url     text check (link_url is null or link_url ~* '^https?://'),
  video_url    text check (video_url is null or video_url ~* '^https?://'),
  fotos        text[] not null default '{}' check (cardinality(fotos) <= 4),
  fixado       boolean not null default false,
  removido     boolean not null default false,
  created_at   timestamptz not null default now(),
  constraint post_com_conteudo check (length(trim(texto)) > 0 or cardinality(fotos) > 0 or link_url is not null or video_url is not null),
  constraint mural_tem_conselho check (escopo = 'publico' or conselho_id is not null)
);
create index posts_feed_idx on public.posts (created_at desc) where removido = false and escopo = 'publico';
create index posts_municipio_idx on public.posts (municipio_id, created_at desc);
create index posts_autor_idx on public.posts (autor_id, created_at desc);
create index posts_conselho_idx on public.posts (conselho_id, escopo, created_at desc);

-- Valida quem pode publicar o quê e preenche a cidade do autor.
-- Sem security definer: o trigger precisa saber se quem edita é o usuário (papel authenticated).
create or replace function public.tg_posts_validar()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.autor_id := auth.uid();
    new.fixado := false;
    new.removido := false;
    new.created_at := now();
    if new.conselho_id is not null then
      select municipio_id into new.municipio_id from public.conselhos where id = new.conselho_id;
    else
      select municipio_id into new.municipio_id from public.profiles where id = new.autor_id;
    end if;
  end if;

  if new.escopo = 'mural' and not public.is_membro(new.conselho_id) then
    raise exception 'Só membros do conselho podem publicar no mural';
  end if;
  if new.escopo = 'publico' and new.conselho_id is not null and not public.is_diretoria(new.conselho_id) then
    raise exception 'Só a diretoria pode publicar em nome do conselho';
  end if;
  if new.tipo <> 'normal' and not public.is_diretoria(new.conselho_id) then
    raise exception 'Só a diretoria pode publicar atas e avisos';
  end if;

  if tg_op = 'UPDATE' and current_user in ('authenticated', 'anon') then
    -- Autor edita o conteúdo; diretoria fixa no mural; admin remove.
    new.autor_id := old.autor_id;
    new.conselho_id := old.conselho_id;
    new.municipio_id := old.municipio_id;
    new.escopo := old.escopo;
    new.created_at := old.created_at;
    if not public.is_admin() then new.removido := old.removido; end if;
    if not (old.conselho_id is not null and public.is_diretoria(old.conselho_id)) then new.fixado := old.fixado; end if;
    if old.autor_id <> auth.uid() and not public.is_admin() then
      new.texto := old.texto; new.link_url := old.link_url; new.video_url := old.video_url;
      new.fotos := old.fotos; new.tipo := old.tipo;
    end if;
  end if;
  return new;
end;
$$;

create trigger posts_validar
before insert or update on public.posts
for each row execute function public.tg_posts_validar();

create table public.curtidas_post (
  post_id    uuid not null references public.posts (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.comentarios_post (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts (id) on delete cascade,
  autor_id   uuid not null references public.profiles (id) on delete cascade,
  texto      text not null check (length(trim(texto)) between 1 and 2000),
  removido   boolean not null default false,
  created_at timestamptz not null default now()
);
create index comentarios_post_idx on public.comentarios_post (post_id, created_at);

alter table public.comentarios_aula add column removido boolean not null default false;

-- Feed: uma consulta só, já com autor, conselho, curtidas e comentários.
-- Roda com as permissões de quem chama (RLS vale normalmente).
create or replace function public.feed(
  p_aba text,                       -- 'nacional' | 'cidade' | 'seguindo' | 'conselho' | 'mural' | 'pessoa' | 'post'
  p_antes timestamptz default null,
  p_limite integer default 20,
  p_ref uuid default null           -- conselho (conselho/mural), pessoa (pessoa) ou o próprio post (post)
)
returns setof jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'id', p.id, 'texto', p.texto, 'link_url', p.link_url, 'video_url', p.video_url, 'fotos', p.fotos,
    'tipo', p.tipo, 'escopo', p.escopo, 'fixado', p.fixado, 'created_at', p.created_at,
    'autor', jsonb_build_object('id', a.id, 'nome', a.nome, 'avatar_url', a.avatar_url, 'xp', a.xp),
    'conselho', case when c.id is null then null else jsonb_build_object('id', c.id, 'nome', c.nome) end,
    'cidade', case when m.id is null then null else m.nome || ' – ' || m.uf end,
    'curtidas', (select count(*) from public.curtidas_post cp where cp.post_id = p.id),
    'curti', exists (select 1 from public.curtidas_post cp where cp.post_id = p.id and cp.user_id = auth.uid()),
    'comentarios', (select count(*) from public.comentarios_post co where co.post_id = p.id and not co.removido)
  )
  from public.posts p
  join public.profiles a on a.id = p.autor_id
  left join public.conselhos c on c.id = p.conselho_id
  left join public.municipios m on m.id = p.municipio_id
  where not p.removido
    and (p_antes is null or p.created_at < p_antes)
    and case p_aba
      when 'nacional' then p.escopo = 'publico'
      when 'cidade' then p.escopo = 'publico'
        and p.municipio_id = (select municipio_id from public.profiles where id = auth.uid())
      when 'seguindo' then p.escopo = 'publico' and (
        p.autor_id = auth.uid()
        or p.autor_id in (select seguido_id from public.seguidores_pessoa where seguidor_id = auth.uid())
        or p.conselho_id in (select conselho_id from public.seguidores_conselho where user_id = auth.uid())
        or p.conselho_id = (select conselho_id from public.profiles where id = auth.uid()))
      when 'conselho' then p.escopo = 'publico' and p.conselho_id = p_ref
      when 'mural' then p.escopo = 'mural' and p.conselho_id = p_ref
      when 'pessoa' then p.escopo = 'publico' and p.autor_id = p_ref
      when 'post' then p.id = p_ref
      else false
    end
  order by case when p_aba = 'mural' then p.fixado else false end desc, p.created_at desc
  limit least(coalesce(p_limite, 20), 50);
$$;

-- ---------------------------------------------------------------------
-- Eventos e lembretes
-- ---------------------------------------------------------------------
create table public.eventos (
  id           uuid primary key default gen_random_uuid(),
  conselho_id  uuid references public.conselhos (id) on delete cascade,  -- nulo = evento geral (admin)
  municipio_id integer references public.municipios (id),                -- nulo = nacional
  criado_por   uuid references public.profiles (id) on delete set null,
  tipo         public.tipo_evento not null default 'reuniao',
  titulo       text not null check (length(trim(titulo)) >= 3),
  descricao    text,
  local        text,
  link_url     text check (link_url is null or link_url ~* '^https?://'),
  inicio       timestamptz not null,
  fim          timestamptz,
  created_at   timestamptz not null default now(),
  check (fim is null or fim >= inicio)
);
create index eventos_inicio_idx on public.eventos (inicio);
create index eventos_conselho_idx on public.eventos (conselho_id, inicio);

create or replace function public.tg_eventos_validar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.criado_por := auth.uid();
  end if;
  if new.conselho_id is not null then
    if not (public.is_diretoria(new.conselho_id) or public.is_admin()) then
      raise exception 'Só a diretoria pode criar eventos do conselho';
    end if;
    select municipio_id into new.municipio_id from public.conselhos where id = new.conselho_id;
  elsif not public.is_admin() then
    raise exception 'Só administradores podem criar eventos gerais';
  end if;
  return new;
end;
$$;

create trigger eventos_validar
before insert or update on public.eventos
for each row execute function public.tg_eventos_validar();

create table public.lembretes_evento (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  evento_id  uuid not null references public.eventos (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, evento_id)
);

-- Próximos eventos que interessam à pessoa: do conselho dela, dos que segue,
-- da cidade dela e os nacionais.
create or replace function public.proximos_eventos(p_limite integer default 30)
returns setof jsonb
language sql
stable
set search_path = public
as $$
  with eu as (select municipio_id, conselho_id from public.profiles where id = auth.uid())
  select jsonb_build_object(
    'id', e.id, 'tipo', e.tipo, 'titulo', e.titulo, 'descricao', e.descricao, 'local', e.local,
    'link_url', e.link_url, 'inicio', e.inicio, 'fim', e.fim,
    'conselho', case when c.id is null then null else jsonb_build_object('id', c.id, 'nome', c.nome) end,
    'cidade', case when m.id is null then 'Nacional' else m.nome || ' – ' || m.uf end,
    'lembrete', exists (select 1 from public.lembretes_evento l where l.evento_id = e.id and l.user_id = auth.uid())
  )
  from public.eventos e
  left join public.conselhos c on c.id = e.conselho_id
  left join public.municipios m on m.id = e.municipio_id, eu
  where coalesce(e.fim, e.inicio) >= now() - interval '3 hours'
    and (
      e.municipio_id is null
      or e.municipio_id = eu.municipio_id
      or e.conselho_id = eu.conselho_id
      or e.conselho_id in (select conselho_id from public.seguidores_conselho where user_id = auth.uid())
      or e.id in (select evento_id from public.lembretes_evento where user_id = auth.uid())
    )
  order by e.inicio
  limit least(coalesce(p_limite, 30), 100);
$$;

-- ---------------------------------------------------------------------
-- Denúncias
-- ---------------------------------------------------------------------
create table public.denuncias (
  id             uuid primary key default gen_random_uuid(),
  denunciante_id uuid not null references public.profiles (id) on delete cascade,
  alvo_tipo      public.alvo_denuncia not null,
  alvo_id        uuid not null,
  motivo         text not null check (length(trim(motivo)) between 3 and 1000),
  status         public.status_denuncia not null default 'pendente',
  resolvido_por  uuid references public.profiles (id) on delete set null,
  resolvido_em   timestamptz,
  created_at     timestamptz not null default now(),
  unique (denunciante_id, alvo_tipo, alvo_id)
);
create index denuncias_status_idx on public.denuncias (status, created_at);

-- Lista de denúncias com o conteúdo denunciado (só admin).
create or replace function public.denuncias_pendentes()
returns setof jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Apenas administradores'; end if;
  return query
  select jsonb_build_object(
    'alvo_tipo', d.alvo_tipo, 'alvo_id', d.alvo_id,
    'denuncias', jsonb_agg(jsonb_build_object('id', d.id, 'motivo', d.motivo, 'created_at', d.created_at,
                                              'denunciante', (select nome from public.profiles where id = d.denunciante_id)) order by d.created_at),
    'conteudo', case d.alvo_tipo
      when 'post' then (select jsonb_build_object('texto', p.texto, 'fotos', p.fotos, 'link_url', p.link_url, 'autor_id', p.autor_id,
                                                  'autor', (select nome from public.profiles where id = p.autor_id), 'post_id', p.id)
                        from public.posts p where p.id = d.alvo_id)
      when 'comentario_post' then (select jsonb_build_object('texto', c.texto, 'autor_id', c.autor_id,
                                                             'autor', (select nome from public.profiles where id = c.autor_id), 'post_id', c.post_id)
                                   from public.comentarios_post c where c.id = d.alvo_id)
      when 'comentario_aula' then (select jsonb_build_object('texto', c.texto, 'autor_id', c.user_id,
                                                             'autor', (select nome from public.profiles where id = c.user_id), 'aula_id', c.aula_id)
                                   from public.comentarios_aula c where c.id = d.alvo_id)
    end
  )
  from public.denuncias d
  where d.status = 'pendente'
  group by d.alvo_tipo, d.alvo_id;
end;
$$;

-- Admin decide: remover o conteúdo ou ignorar a denúncia.
create or replace function public.resolver_denuncia(p_alvo_tipo public.alvo_denuncia, p_alvo_id uuid, p_remover boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Apenas administradores'; end if;
  if p_remover then
    case p_alvo_tipo
      when 'post' then update public.posts set removido = true where id = p_alvo_id;
      when 'comentario_post' then update public.comentarios_post set removido = true where id = p_alvo_id;
      when 'comentario_aula' then update public.comentarios_aula set removido = true where id = p_alvo_id;
    end case;
  end if;
  update public.denuncias
     set status = case when p_remover then 'removido' else 'ignorado' end::public.status_denuncia,
         resolvido_por = auth.uid(), resolvido_em = now()
   where alvo_tipo = p_alvo_tipo and alvo_id = p_alvo_id and status = 'pendente';
end;
$$;

-- ---------------------------------------------------------------------
-- Inatividade da diretoria (60 dias)
-- ---------------------------------------------------------------------
alter table public.conselhos add column ultima_atividade_diretoria timestamptz not null default now();

create or replace function public.registrar_atividade_diretoria(p_conselho uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.conselhos set ultima_atividade_diretoria = now()
  where id = p_conselho and public.is_diretoria(p_conselho);
$$;
revoke all on function public.registrar_atividade_diretoria(uuid) from public, anon, authenticated;

create or replace function public.tg_atividade_diretoria()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.registrar_atividade_diretoria(new.conselho_id);
  return new;
end;
$$;

create trigger atividade_post after insert on public.posts
for each row when (new.conselho_id is not null) execute function public.tg_atividade_diretoria();
create trigger atividade_evento after insert on public.eventos
for each row when (new.conselho_id is not null) execute function public.tg_atividade_diretoria();
create trigger atividade_pedido after update of status on public.pedidos_participacao
for each row execute function public.tg_atividade_diretoria();

create or replace function public.tg_conselho_atividade()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_diretoria(new.id) then
    new.ultima_atividade_diretoria := now();
  end if;
  return new;
end;
$$;

create trigger conselho_atividade before update on public.conselhos
for each row execute function public.tg_conselho_atividade();

create table public.solicitacoes_diretoria (
  id          uuid primary key default gen_random_uuid(),
  conselho_id uuid not null references public.conselhos (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  cargo       public.cargo_diretoria not null default 'presidente',
  mensagem    text,
  status      public.status_pedido not null default 'pendente',
  created_at  timestamptz not null default now(),
  resolvido_em timestamptz
);
create unique index solicitacoes_diretoria_pendente_idx on public.solicitacoes_diretoria (conselho_id, user_id) where status = 'pendente';

-- Membro pede ao admin para assumir a diretoria de um conselho inativo.
create or replace function public.solicitar_diretoria(p_conselho uuid, p_cargo public.cargo_diretoria, p_mensagem text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ultima timestamptz;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and conselho_id = p_conselho) then
    raise exception 'Só membros do conselho podem pedir para assumir a diretoria';
  end if;
  select ultima_atividade_diretoria into v_ultima from public.conselhos where id = p_conselho;
  if v_ultima > now() - interval '60 days' and exists (select 1 from public.diretoria where conselho_id = p_conselho) then
    raise exception 'A diretoria teve atividade nos últimos 60 dias';
  end if;
  insert into public.solicitacoes_diretoria (conselho_id, user_id, cargo, mensagem)
  values (p_conselho, auth.uid(), p_cargo, nullif(trim(p_mensagem), ''))
  on conflict do nothing;
end;
$$;

create or replace function public.resolver_solicitacao_diretoria(p_id uuid, p_aprovar boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.solicitacoes_diretoria;
begin
  if not public.is_admin() then raise exception 'Apenas administradores'; end if;
  select * into s from public.solicitacoes_diretoria where id = p_id and status = 'pendente';
  if s.id is null then raise exception 'Solicitação não encontrada'; end if;
  if p_aprovar then
    insert into public.diretoria (conselho_id, user_id, cargo) values (s.conselho_id, s.user_id, s.cargo)
    on conflict (conselho_id, user_id) do update set cargo = excluded.cargo;
    update public.conselhos set ultima_atividade_diretoria = now() where id = s.conselho_id;
  end if;
  update public.solicitacoes_diretoria
     set status = case when p_aprovar then 'aceito' else 'recusado' end::public.status_pedido, resolvido_em = now()
   where id = p_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Segurança
-- ---------------------------------------------------------------------
alter table public.seguidores_pessoa       enable row level security;
alter table public.posts                   enable row level security;
alter table public.curtidas_post           enable row level security;
alter table public.comentarios_post        enable row level security;
alter table public.eventos                 enable row level security;
alter table public.lembretes_evento        enable row level security;
alter table public.denuncias               enable row level security;
alter table public.solicitacoes_diretoria  enable row level security;

create policy "leitura" on public.seguidores_pessoa for select to authenticated using (true);
create policy "seguir" on public.seguidores_pessoa for insert to authenticated with check (seguidor_id = auth.uid());
create policy "deixar de seguir" on public.seguidores_pessoa for delete to authenticated using (seguidor_id = auth.uid());

create policy "ver posts" on public.posts for select to authenticated
  using (
    (not removido or public.is_admin())
    and (escopo = 'publico' or public.is_membro(conselho_id) or public.is_admin())
  );
create policy "publicar" on public.posts for insert to authenticated with check (true);  -- validado no trigger
create policy "editar" on public.posts for update to authenticated
  using (autor_id = auth.uid() or public.is_admin() or (conselho_id is not null and public.is_diretoria(conselho_id)));
create policy "apagar" on public.posts for delete to authenticated
  using (autor_id = auth.uid() or public.is_admin() or (escopo = 'mural' and public.is_diretoria(conselho_id)));

create policy "ver curtidas" on public.curtidas_post for select to authenticated using (true);
create policy "curtir" on public.curtidas_post for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.posts p where p.id = post_id));
create policy "descurtir" on public.curtidas_post for delete to authenticated using (user_id = auth.uid());

create policy "ver comentarios" on public.comentarios_post for select to authenticated
  using ((not removido or public.is_admin()) and exists (select 1 from public.posts p where p.id = post_id));
create policy "comentar" on public.comentarios_post for insert to authenticated
  with check (autor_id = auth.uid() and not removido and exists (select 1 from public.posts p where p.id = post_id));
create policy "apagar comentario" on public.comentarios_post for delete to authenticated
  using (autor_id = auth.uid() or public.is_admin());

-- Comentários de aulas removidos pela moderação somem para quem não é admin.
drop policy "ler comentarios" on public.comentarios_aula;
create policy "ler comentarios" on public.comentarios_aula for select to authenticated using (not removido or public.is_admin());

create policy "ver eventos" on public.eventos for select to authenticated using (true);
create policy "criar eventos" on public.eventos for insert to authenticated with check (true);  -- validado no trigger
create policy "editar eventos" on public.eventos for update to authenticated
  using ((conselho_id is not null and public.is_diretoria(conselho_id)) or public.is_admin());
create policy "apagar eventos" on public.eventos for delete to authenticated
  using ((conselho_id is not null and public.is_diretoria(conselho_id)) or public.is_admin());

create policy "meus lembretes" on public.lembretes_evento for select to authenticated using (user_id = auth.uid());
create policy "criar lembrete" on public.lembretes_evento for insert to authenticated with check (user_id = auth.uid());
create policy "remover lembrete" on public.lembretes_evento for delete to authenticated using (user_id = auth.uid());

create policy "denunciar" on public.denuncias for insert to authenticated
  with check (denunciante_id = auth.uid() and status = 'pendente');
create policy "minhas denuncias" on public.denuncias for select to authenticated
  using (denunciante_id = auth.uid() or public.is_admin());

create policy "ver solicitacoes" on public.solicitacoes_diretoria for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Fotos das publicações: cada pessoa envia na própria pasta.
insert into storage.buckets (id, name, public)
values ('posts', 'posts', true)
on conflict (id) do nothing;

create policy "fotos leitura publica" on storage.objects for select
  using (bucket_id = 'posts');
create policy "fotos envio na propria pasta" on storage.objects for insert to authenticated
  with check (bucket_id = 'posts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "fotos apagar as proprias" on storage.objects for delete to authenticated
  using (bucket_id = 'posts' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
