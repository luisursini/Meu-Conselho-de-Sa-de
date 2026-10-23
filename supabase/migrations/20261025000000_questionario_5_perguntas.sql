-- =====================================================================
-- Questionários com 5 perguntas: aprovação com pelo menos 3 acertos.
-- Também completa a Trilha 1 com a 4ª e a 5ª questão de cada curso.
-- =====================================================================

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
  if v_total < 5 then raise exception 'Este questionário ainda está sendo preparado'; end if;

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

  v_aprovado := v_acertos >= 3;
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

-- Cada curso tem no máximo 5 questões no questionário.
create or replace function public.tg_questoes_limite()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.uso = 'curso' and (select count(*) from public.questoes
                            where curso_id = new.curso_id and uso = 'curso' and id <> new.id) >= 5 then
    raise exception 'Cada questionário tem no máximo 5 questões';
  end if;
  return new;
end;
$$;

drop trigger if exists questoes_limite on public.questoes;
create trigger questoes_limite
before insert or update of curso_id, uso on public.questoes
for each row execute function public.tg_questoes_limite();

-- Completa a Trilha 1 (só insere se a questão daquela ordem ainda não existir).
create or replace function pg_temp.questao_extra(p_curso text, p_ordem int, p_enunciado text, p_alternativas text[], p_correta int, p_explicacao text)
returns void language plpgsql as $$
declare
  c record;
  v uuid;
begin
  select cu.id, cu.trilha_id into c
  from public.cursos cu join public.trilhas t on t.id = cu.trilha_id
  where cu.titulo = p_curso and t.titulo = 'Primeiros passos no controle social';
  if c.id is null or exists (select 1 from public.questoes where curso_id = c.id and uso = 'curso' and ordem = p_ordem) then
    return;
  end if;
  insert into public.questoes (trilha_id, curso_id, uso, enunciado, alternativas, ordem)
  values (c.trilha_id, c.id, 'curso', p_enunciado, to_jsonb(p_alternativas), p_ordem)
  returning id into v;
  insert into public.gabaritos (questao_id, correta, explicacao) values (v, p_correta, p_explicacao);
end $$;

do $$
begin
  perform pg_temp.questao_extra('O que é o SUS', 4, 'Qual lei organiza o funcionamento dos serviços do SUS?', array['Lei 8.142/1990', 'Lei 8.080/1990', 'Lei 11.340/2006', 'Lei 9.394/1996'], 1, 'A Lei 8.080/1990 organiza o funcionamento do SUS; a 8.142/1990 trata da participação da comunidade e dos repasses.');
  perform pg_temp.questao_extra('O que é o SUS', 5, 'O princípio da integralidade significa:', array['Atender apenas casos de emergência', 'Atender só quem tem carteira assinada', 'Cuidar da pessoa por inteiro: prevenção, tratamento e reabilitação', 'Tratar todo mundo exatamente igual'], 2, null);
  perform pg_temp.questao_extra('O que é controle social', 4, 'Qual é o número da Ouvidoria do SUS (Disque Saúde)?', array['190', '192', '100', '136'], 3, 'O 136 recebe denúncias, reclamações, sugestões e elogios sobre o SUS. O 192 é o SAMU.');
  perform pg_temp.questao_extra('O que é controle social', 5, 'Qual destas atitudes é um exemplo de controle social?', array['Participar da reunião do conselho de saúde e cobrar melhorias na UBS', 'Reclamar da UBS só nas redes sociais, sem procurar nenhum canal', 'Deixar de usar o SUS', 'Esperar que o governo resolva tudo sozinho'], 0, null);
  perform pg_temp.questao_extra('Lei 8.142/1990: conselhos e conferências', 4, 'Para receber recursos do Fundo Nacional de Saúde, o município precisa ter, entre outras exigências:', array['Um hospital particular', 'Conselho de Saúde e Fundo de Saúde funcionando', 'Uma faculdade de medicina', 'Pelo menos 100 mil habitantes'], 1, 'A Lei 8.142 exige, entre outros, Fundo de Saúde, Conselho de Saúde, plano de saúde e relatórios de gestão.');
  perform pg_temp.questao_extra('Lei 8.142/1990: conselhos e conferências', 5, 'Em que ano a Lei 8.142 foi publicada?', array['1988', '1986', '1990', '2012'], 2, null);
  perform pg_temp.questao_extra('O que é um Conselho Local de Saúde', 4, 'Em geral, as reuniões do Conselho Local de Saúde são:', array['Abertas à população', 'Secretas', 'Só para médicos', 'Pagas'], 0, null);
  perform pg_temp.questao_extra('O que é um Conselho Local de Saúde', 5, 'Quando o problema não pode ser resolvido no território, o Conselho Local costuma levá-lo ao:', array['Supremo Tribunal Federal', 'Conselho Municipal de Saúde', 'Ministério da Educação', 'Síndico do prédio'], 1, null);
  perform pg_temp.questao_extra('Segmentos e paridade', 4, 'Segundo a Resolução CNS 453/2012, qual percentual das vagas é dos trabalhadores de saúde?', array['10%', '50%', '75%', '25%'], 3, null);
  perform pg_temp.questao_extra('Segmentos e paridade', 5, 'Segundo a Resolução 453/2012, o mandato dos conselheiros:', array['Não deve coincidir com o mandato do governo', 'Deve ser igual ao mandato do prefeito', 'É vitalício', 'Dura dez anos'], 0, 'O mandato é definido no regimento interno e não deve coincidir com o do governo; a resolução sugere dois anos.');
end $$;
