-- Conteúdo inicial: Trilha 1 completa (publicada) e Trilhas 2 a 5 como rascunho.
-- Tudo pode ser editado depois pelo painel Admin do app.

create or replace function pg_temp.questao(p_trilha uuid, p_curso uuid, p_ordem int, p_enunciado text, p_alternativas text[], p_correta int, p_explicacao text)
returns void language plpgsql as $$
declare v uuid;
begin
  insert into public.questoes (trilha_id, curso_id, uso, enunciado, alternativas, ordem)
  values (p_trilha, p_curso, 'curso', p_enunciado, to_jsonb(p_alternativas), p_ordem)
  returning id into v;
  insert into public.gabaritos (questao_id, correta, explicacao) values (v, p_correta, p_explicacao);
end $$;

do $$
declare
  t1 uuid; t uuid; c uuid;
begin
  -- =================================================================
  -- Trilha 1 — Primeiros passos no controle social
  -- =================================================================
  insert into public.trilhas (titulo, descricao, ordem, medalha_nome, medalha_emoji, publicada)
  values ('Primeiros passos no controle social',
          'Entenda o que é o SUS, o que é controle social e como funcionam os conselhos de saúde.',
          1, 'Primeiros Passos', '🌱', true)
  returning id into t1;

  -- Curso 1 ----------------------------------------------------------
  insert into public.cursos (trilha_id, titulo, descricao, ordem)
  values (t1, 'O que é o SUS', 'A origem e os princípios do Sistema Único de Saúde.', 1) returning id into c;

  insert into public.aulas (curso_id, titulo, tipo, ordem, texto) values (c, 'O SUS e seus princípios', 'texto', 1, $md$
O **Sistema Único de Saúde (SUS)** foi criado pela **Constituição Federal de 1988**, que diz que *"a saúde é direito de todos e dever do Estado"* (art. 196). Ele foi regulamentado em 1990 pela **Lei 8.080** (que organiza o funcionamento do sistema) e pela **Lei 8.142** (que trata da participação da comunidade).

O SUS é resultado de muita luta: o **Movimento da Reforma Sanitária** e a **8ª Conferência Nacional de Saúde (1986)** reuniram trabalhadores, estudantes e população para defender a saúde como direito.

## Princípios do SUS

- **Universalidade** — todas as pessoas têm direito ao atendimento, sem precisar pagar ou ter carteira assinada.
- **Integralidade** — a pessoa deve ser cuidada por inteiro: prevenção, tratamento e reabilitação.
- **Equidade** — tratar de forma diferente quem está em situação diferente, dando mais a quem mais precisa.

## Como ele se organiza

- **Descentralização** — municípios, estados e União dividem responsabilidades.
- **Regionalização e hierarquização** — os serviços se organizam por território e por níveis de complexidade (da UBS ao hospital).
- **Participação da comunidade** — a população participa das decisões. É isso que chamamos de **controle social**, e é o tema deste app!
$md$);

  perform pg_temp.questao(t1, c, 1, 'Qual documento criou o SUS?',
    array['A Constituição Federal de 1988', 'A Lei 8.142 de 1990', 'Um decreto do Ministério da Saúde de 1995', 'A Consolidação das Leis do Trabalho (CLT)'], 0,
    'O SUS foi criado pela Constituição de 1988 e regulamentado depois pelas Leis 8.080 e 8.142, de 1990.');
  perform pg_temp.questao(t1, c, 2, 'O princípio que garante atendimento a todas as pessoas, sem exigir pagamento ou carteira assinada, é a:',
    array['Equidade', 'Universalidade', 'Hierarquização', 'Descentralização'], 1,
    'Universalidade significa que a saúde é direito de todos.');
  perform pg_temp.questao(t1, c, 3, '"Dar mais a quem mais precisa" é a ideia de qual princípio?',
    array['Integralidade', 'Regionalização', 'Equidade', 'Universalidade'], 2,
    'Equidade é tratar de forma diferente quem está em situação diferente, para reduzir desigualdades.');

  -- Curso 2 ----------------------------------------------------------
  insert into public.cursos (trilha_id, titulo, descricao, ordem)
  values (t1, 'O que é controle social', 'Por que a participação da população é parte do SUS.', 2) returning id into c;

  insert into public.aulas (curso_id, titulo, tipo, ordem, texto) values (c, 'Participar também é cuidar da saúde', 'texto', 1, $md$
**Controle social** é a participação da população na **formulação, no acompanhamento e na fiscalização** das políticas de saúde. É a sociedade "de olho" e ajudando a decidir como o SUS funciona.

A participação da comunidade é uma **diretriz da Constituição** (art. 198) — ou seja, não é um favor do governo: é parte da estrutura do SUS.

## O que o controle social faz

- Ajuda a **definir prioridades** (por exemplo: o que a UBS do bairro mais precisa).
- **Acompanha** se o que foi planejado está sendo feito.
- **Fiscaliza** como o dinheiro da saúde é usado.
- Leva as **demandas da comunidade** para quem toma as decisões.

## Onde ele acontece

As duas instâncias oficiais são os **Conselhos de Saúde** e as **Conferências de Saúde**. Além delas, a população também participa por meio da **Ouvidoria do SUS (Disque 136)**, de audiências públicas, movimentos sociais e associações de bairro.
$md$);

  perform pg_temp.questao(t1, c, 1, 'O que é controle social no SUS?',
    array['A fiscalização da população feita pela polícia', 'A participação da população na formulação, acompanhamento e fiscalização das políticas de saúde', 'O controle de entrada de pacientes nas UBS', 'A auditoria feita apenas pelo Tribunal de Contas'], 1, null);
  perform pg_temp.questao(t1, c, 2, 'Quais são as duas instâncias oficiais de controle social criadas por lei?',
    array['Ouvidoria e Câmara de Vereadores', 'Conselhos de Saúde e Conferências de Saúde', 'Ministério Público e Defensoria', 'Sindicatos e associações'], 1,
    'A Lei 8.142/1990 define os Conselhos e as Conferências de Saúde como instâncias colegiadas do SUS.');
  perform pg_temp.questao(t1, c, 3, 'A participação da comunidade no SUS é:',
    array['Um favor que cada prefeito pode permitir ou não', 'Uma diretriz prevista na Constituição', 'Obrigatória apenas em cidades grandes', 'Uma regra criada por este aplicativo'], 1, null);

  -- Curso 3 ----------------------------------------------------------
  insert into public.cursos (trilha_id, titulo, descricao, ordem)
  values (t1, 'Lei 8.142/1990: conselhos e conferências', 'A lei que garante a participação da comunidade.', 3) returning id into c;

  insert into public.aulas (curso_id, titulo, tipo, ordem, texto) values (c, 'O que diz a Lei 8.142', 'texto', 1, $md$
A **Lei 8.142, de 28 de dezembro de 1990**, trata de dois assuntos: a **participação da comunidade** na gestão do SUS e as **transferências de recursos** entre os governos.

## Conferência de Saúde

- Acontece **a cada quatro anos**.
- Reúne vários segmentos da sociedade para **avaliar a situação de saúde** e **propor diretrizes** para a política de saúde.
- Existe nos três níveis: **municipal, estadual e nacional**.

## Conselho de Saúde

- Tem **caráter permanente e deliberativo** — ou seja, existe o tempo todo e **toma decisões**.
- É formado por representantes do **governo, prestadores de serviço, profissionais de saúde e usuários**.
- **Atua na formulação de estratégias e no controle da execução da política de saúde**, inclusive nos aspectos econômicos e financeiros.
- A representação dos **usuários é paritária** em relação ao conjunto dos demais segmentos.

## Dinheiro e conselho andam juntos

Para receber recursos do Fundo Nacional de Saúde, municípios e estados precisam ter, entre outras coisas, **Conselho de Saúde funcionando** e **Fundo de Saúde**. Por isso o conselho é peça-chave na gestão.
$md$);

  perform pg_temp.questao(t1, c, 1, 'De quanto em quanto tempo acontecem as Conferências de Saúde, segundo a Lei 8.142?',
    array['Todo ano', 'A cada dois anos', 'A cada quatro anos', 'A cada dez anos'], 2, null);
  perform pg_temp.questao(t1, c, 2, 'O Conselho de Saúde tem caráter:',
    array['Temporário e consultivo', 'Permanente e deliberativo', 'Eventual e opinativo', 'Apenas festivo'], 1,
    'Deliberativo quer dizer que o conselho decide, e não apenas dá opinião.');
  perform pg_temp.questao(t1, c, 3, 'Quais segmentos compõem o Conselho de Saúde?',
    array['Só médicos e enfermeiros', 'Só representantes da prefeitura', 'Governo, prestadores de serviço, profissionais de saúde e usuários', 'Apenas vereadores'], 2, null);

  -- Curso 4 ----------------------------------------------------------
  insert into public.cursos (trilha_id, titulo, descricao, ordem)
  values (t1, 'O que é um Conselho Local de Saúde', 'O conselho mais perto de você: o da sua UBS.', 4) returning id into c;

  insert into public.aulas (curso_id, titulo, tipo, ordem, texto) values (c, 'O conselho do seu bairro', 'texto', 1, $md$
Além dos conselhos **nacional, estaduais e municipais**, muitas cidades têm **Conselhos Locais de Saúde** (também chamados de conselhos gestores de unidade). Eles ficam ligados a uma ou mais **unidades de saúde**, como a UBS do bairro.

> A criação e as regras dos conselhos locais são definidas por **normas de cada município** (lei municipal, resolução do Conselho Municipal ou regimento). Por isso, o nome e o funcionamento podem variar de uma cidade para outra.

## Para que serve

- **Acompanhar o dia a dia** da unidade de saúde: atendimento, filas, falta de remédios, estrutura.
- **Ouvir a comunidade** e levar suas necessidades à gestão.
- **Ajudar a planejar** as ações da unidade de acordo com a realidade do território.
- **Levar demandas** ao Conselho Municipal de Saúde.

## Quem participa

Moradores usuários da unidade, trabalhadores da UBS e representantes da gestão — seguindo a mesma lógica de paridade dos demais conselhos.

## Como participar

Procure a sua UBS e pergunte quando acontecem as reuniões. Em geral, **as reuniões são abertas** à população! Aqui no app você também pode usar o botão **"Quero participar"** na página do conselho.
$md$);

  perform pg_temp.questao(t1, c, 1, 'Um Conselho Local de Saúde geralmente está ligado a:',
    array['Uma ou mais unidades de saúde do território', 'Um hospital privado', 'O Ministério da Saúde diretamente', 'Uma escola estadual'], 0, null);
  perform pg_temp.questao(t1, c, 2, 'Quem define as regras de funcionamento dos conselhos locais?',
    array['Uma lei federal única para todo o Brasil', 'As normas de cada município', 'O diretor de cada UBS sozinho', 'Ninguém, não há regras'], 1,
    'Os conselhos locais são criados e regulamentados por normas municipais, por isso variam entre cidades.');
  perform pg_temp.questao(t1, c, 3, 'Qual destas é uma função do Conselho Local de Saúde?',
    array['Contratar e demitir funcionários', 'Acompanhar o funcionamento da unidade e levar as demandas da comunidade', 'Receitar medicamentos', 'Aprovar as leis do município'], 1, null);

  -- Curso 5 ----------------------------------------------------------
  insert into public.cursos (trilha_id, titulo, descricao, ordem)
  values (t1, 'Segmentos e paridade', 'Quem tem cadeira no conselho e por quê.', 5) returning id into c;

  insert into public.aulas (curso_id, titulo, tipo, ordem, texto) values (c, 'Como as vagas são divididas', 'texto', 1, $md$
A **Resolução nº 453/2012 do Conselho Nacional de Saúde** traz as diretrizes para criar e organizar os conselhos de saúde. Ela define como as vagas devem ser distribuídas:

| Segmento | Vagas |
|---|---|
| **Usuários** | 50% |
| **Trabalhadores de saúde** | 25% |
| **Gestores e prestadores de serviço** | 25% |

Isso é a **paridade**: os usuários têm o mesmo número de vagas que todos os outros segmentos somados. A ideia é garantir que **a voz da população** tenha peso nas decisões.

## Outros pontos da Resolução 453

- Os representantes de cada segmento são **escolhidos pelas próprias entidades e movimentos** do segmento, e não indicados pelo governo.
- O conselho deve ter **regimento interno** e **reuniões abertas ao público**.
- O presidente do conselho é **eleito entre os conselheiros**, em reunião plenária.
- O mandato dos conselheiros é definido no regimento, **sem coincidir** com o mandato do governo.

## E no app?

Ao criar seu perfil você escolhe seu segmento: **usuário, trabalhador, gestão ou prestador de serviço** — ou **sem vínculo ainda**, se você está chegando agora. 😉
$md$);

  perform pg_temp.questao(t1, c, 1, 'Segundo a Resolução CNS 453/2012, qual percentual das vagas do conselho é dos usuários?',
    array['25%', '33%', '50%', '75%'], 2, null);
  perform pg_temp.questao(t1, c, 2, 'O que significa paridade no conselho de saúde?',
    array['Todos os conselheiros devem ser da mesma cidade', 'Os usuários têm o mesmo número de vagas que todos os outros segmentos somados', 'O governo tem metade das vagas', 'Cada conselheiro tem dois votos'], 1, null);
  perform pg_temp.questao(t1, c, 3, 'Como é escolhido o presidente do conselho, segundo a Resolução 453?',
    array['É sempre o secretário de saúde', 'É indicado pelo prefeito', 'É eleito entre os conselheiros, em reunião plenária', 'É o conselheiro mais velho'], 2, null);

  -- =================================================================
  -- Trilhas 2 a 5 — rascunhos (cursos criados, aulas e questões a preencher)
  -- =================================================================
  insert into public.trilhas (titulo, descricao, ordem, medalha_nome, medalha_emoji)
  values ('Como funciona um conselho', 'Regimento, reuniões, atas e eleições.', 2, 'Conselheiro Organizado', '📋') returning id into t;
  insert into public.cursos (trilha_id, titulo, ordem) values
    (t, 'Regimento interno', 1), (t, 'Reuniões ordinárias e extraordinárias, pauta e quórum', 2),
    (t, 'Como fazer uma ata', 3), (t, 'Deliberações, resoluções e recomendações', 4), (t, 'Eleição da diretoria e mandato', 5);

  insert into public.trilhas (titulo, descricao, ordem, medalha_nome, medalha_emoji)
  values ('Planejamento e fiscalização', 'Plano de Saúde, relatórios, orçamento e como fiscalizar a sua UBS.', 3, 'Fiscal do SUS', '🔍') returning id into t;
  insert into public.cursos (trilha_id, titulo, ordem) values
    (t, 'Plano Municipal de Saúde e Programação Anual de Saúde', 1), (t, 'Relatório Anual de Gestão (RAG)', 2),
    (t, 'Orçamento e Fundo Municipal de Saúde (LC 141/2012)', 3), (t, 'Como acompanhar e fiscalizar a sua UBS', 4);

  insert into public.trilhas (titulo, descricao, ordem, medalha_nome, medalha_emoji)
  values ('Atenção Primária e território', 'A porta de entrada do SUS e o cuidado no território.', 4, 'Guardião do Território', '🏘️') returning id into t;
  insert into public.cursos (trilha_id, titulo, ordem) values
    (t, 'O que é a Atenção Primária à Saúde', 1), (t, 'Estratégia Saúde da Família e o Agente Comunitário de Saúde', 2),
    (t, 'Território e diagnóstico das necessidades da comunidade', 3);

  insert into public.trilhas (titulo, descricao, ordem, medalha_nome, medalha_emoji)
  values ('Direitos e participação', 'Seus direitos no SUS e como fazer sua voz ser ouvida.', 5, 'Voz da Comunidade', '📣') returning id into t;
  insert into public.cursos (trilha_id, titulo, ordem) values
    (t, 'Carta dos Direitos dos Usuários da Saúde', 1), (t, 'Ouvidoria do SUS (Disque 136)', 2),
    (t, 'Conferências de Saúde: municipal, estadual e nacional', 3), (t, 'Mobilizando a comunidade para participar', 4);
end $$;
