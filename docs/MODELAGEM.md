# Meu Conselho de Saúde — Modelagem

App para estimular o conhecimento sobre o **controle social do SUS**. Aberto a qualquer cidadão, com alcance nacional. Tem uma **parte educativa** (trilhas, questões e XP) e uma **parte social** (conselhos, diretoria, feed, fórum e mensagens).

Plataforma: **web app instalável (PWA)**, hospedagem gratuita (Supabase + Vercel).

---

## 1. Perfil

| Campo | Regra |
|---|---|
| Nome e foto | Vêm da conta Google (login **só com Google**) |
| Estado e cidade | Lista oficial do IBGE (5.571 municípios) |
| Segmento | Usuário · Trabalhador · Gestão · Prestador de serviço · **Sem vínculo ainda** |
| Conselho Local de Saúde | Obrigatório para quem tem segmento; não existe para "Sem vínculo ainda" |
| UBS | Opcional. Para "Sem vínculo ainda" é a **UBS do bairro** |

O cadastro é **livre**, sem verificação.

## 2. Conselhos e UBS

- **UBS** vêm do **CNES** (script `scripts/importar-ubs.mjs`). Quem não encontrar a sua UBS pode cadastrá-la.
- **Conselhos são cadastrados pelos próprios usuários.** Ao digitar, o app mostra os conselhos **parecidos da mesma cidade**, ignorando acentos, maiúsculas e palavras genéricas como "Conselho Local de Saúde", "CLS" e "do/da". Por exemplo, "cls vila nova" encontra "Conselho Local de Saúde Vila Nova".
- Cada conselho atende **uma ou mais UBS**.
- Quem marcou **sem vínculo** e informou a UBS vê o cartão *"A sua UBS tem um Conselho Local de Saúde!"*. Se a UBS ainda não tem conselho, o app mostra um convite para aprender como um conselho é criado.
- O admin pode **juntar conselhos duplicados**. Membros, diretoria, seguidores, pedidos e UBS passam para o conselho que fica.

### Diretoria

- Cargos: Presidente, Vice-presidente, 1º Secretário(a), 2º Secretário(a), Diretoria (outro).
- **Quem cadastra o conselho vira diretoria provisória**, e a diretoria indica os demais membros da diretoria.
- O selo **"⏳ Diretoria provisória"** fica visível até a diretoria confirmar que foi eleita.
- A diretoria pode: responder pedidos de participação, editar dados do conselho (descrição, horário e local das reuniões, mandato, UBS atendidas), indicar ou remover membros da diretoria e remover membros cadastrados no conselho errado.
- *(Versão 2)* Se a diretoria ficar **inativa por 60 dias**, os membros podem pedir ao admin para assumir.

### "Quero participar"

1. A pessoa passa a **seguir** o conselho.
2. A **diretoria recebe um aviso** e responde (aceitar ou recusar, com mensagem).
3. Se o pedido for aceito, a pessoa escolhe o segmento e entra no conselho.

## 3. Parte educativa

- Organização: **Trilha → Cursos → Aulas** (texto, vídeo do YouTube ou PDF).
- Cada curso termina com **questões de múltipla escolha**. Aprovação com **70%**, **tentativas ilimitadas**. A correção é feita **no servidor**, e o gabarito fica numa tabela que só o admin lê.
- Nas aulas, a pessoa pode **comentar, curtir e salvar**.
- Só o **admin** publica conteúdo.

### XP, níveis e medalhas (no lugar de certificado)

| Ação | XP |
|---|---|
| Concluir uma aula | +10 |
| Ser aprovado no questionário | +50 |
| Acertar 100% na primeira tentativa | +20 de bônus |
| Concluir uma trilha | +200 e **medalha** |

Refazer um questionário já aprovado **não dá XP de novo**.

| Nível | XP | Nome |
|---|---|---|
| 1 | 0 | Cidadão Curioso |
| 2 | 200 | Participante |
| 3 | 600 | Defensor do SUS |
| 4 | 1.200 | Conselheiro Atuante |
| 5 | 2.500 | Guardião do Controle Social |

### Modo Desafio *(Versão 3)*

- Liberado **por trilha**, à medida que a pessoa conclui cada uma.
- Rodadas de 10 perguntas sorteadas, **sem tempo**.
- **Banco de perguntas próprio**: mesmos temas das trilhas, mas perguntas diferentes das dos cursos. O cadastro já está disponível no Admin, em cada trilha.
- +5 XP por acerto, com até 3 rodadas pontuadas por dia.

### Rankings *(Versão 3)*

- **Geral** (XP acumulado) e **mensal** (zera todo mês), por **cidade** e por **estado**.
- A parte social **não dá XP**.
- A tabela `xp_eventos` já registra cada ganho de XP com data, o que permite montar o ranking mensal.

## 4. Parte social *(Versões 2 e 3)*

| Recurso | Decisão |
|---|---|
| Feed | Abas **🇧🇷 Nacional**, **📍 Minha cidade** e **⭐ Seguindo** (conselhos e pessoas) |
| Publicações | Texto, fotos, links e **links** de vídeo |
| Mural do conselho | Só para membros. A diretoria posta atas, resumos e avisos em destaque |
| Fórum | Perguntas e respostas por tema; o autor marca a **✅ melhor resposta** |
| Mensagens diretas | Qualquer pessoa pode mandar para qualquer pessoa, com opção de **bloquear** |
| Eventos | Reuniões e conferências com **lembrete** |
| Moderação | Botão **denunciar**, com revisão do admin |

## 5. Plano de versões

| Versão | Conteúdo | Status |
|---|---|---|
| **1** | Login Google, perfil, conselhos/UBS, diretoria, "Quero participar", trilhas, aulas, questões, XP, níveis, medalhas, comentários/curtidas/salvos, painel admin | ✅ Pronta |
| **2** | Feed (3 abas), seguir pessoas, mural do conselho, eventos com lembrete, denúncia, inatividade da diretoria | A fazer |
| **3** | Fórum, mensagens diretas, Modo Desafio, rankings | A fazer |

## 6. Banco de dados (Versão 1)

```
estados ─< municipios ─< ubs >─< conselho_ubs >─ conselhos
                                                     │
profiles (auth.users) ── conselho_id ────────────────┘
   │  ├─< diretoria (cargo)              >─ conselhos
   │  ├─< seguidores_conselho            >─ conselhos
   │  └─< pedidos_participacao (status)  >─ conselhos
   │
trilhas ─< cursos ─< aulas ─< comentarios_aula / curtidas_aula / aulas_salvas
   │          └─< questoes (uso: curso | desafio) ── gabaritos (só admin)
   │
profiles ─< aulas_concluidas, tentativas_quiz, cursos_aprovados, medalhas, xp_eventos
```

### Funções no servidor (RPC)

| Função | O que faz |
|---|---|
| `concluir_aula(aula)` | Marca a aula como concluída e dá +10 XP uma única vez |
| `enviar_questionario(curso, respostas)` | Corrige, registra a tentativa e dá XP e medalha |
| `buscar_conselhos(municipio, termo)` | Sugere conselhos parecidos da cidade |
| `conselhos_da_ubs(ubs)` | Conselhos que atendem uma UBS |
| `criar_conselho(nome, municipio, ubs[], cargo)` | Cria o conselho; quem cria vira diretoria provisória |
| `definir_diretoria` / `remover_diretoria` / `remover_membro` | Gestão da diretoria |
| `quero_participar(conselho, mensagem)` / `responder_pedido` | Pedidos de participação |
| `mesclar_conselhos(origem, destino)` | Admin junta conselhos duplicados |

### Segurança

- Todas as tabelas usam **Row Level Security**.
- O usuário **não consegue alterar o próprio XP** nem se tornar admin: um trigger bloqueia.
- XP, medalhas e aprovações só são gravados pelas funções do servidor.
- O gabarito das questões é invisível para quem não é admin.
