# Meu Conselho de Saúde

App (PWA) para estimular o conhecimento sobre o **controle social do SUS**. Tem trilhas de aprendizado com questões, XP, níveis e medalhas, e ajuda a pessoa a encontrar e participar do **Conselho Local de Saúde** da sua UBS.

- Modelagem completa e plano de versões: [`docs/MODELAGEM.md`](docs/MODELAGEM.md)
- Tecnologias: React + Vite + TypeScript (PWA instalável) · Supabase (banco, login Google, arquivos) · Vercel (hospedagem). Tudo nos **planos gratuitos**.

## O que já funciona

### Versão 2: parte social
- **Feed** com as abas Nacional, Minha cidade e Seguindo; publicações com texto, fotos, link e vídeo; curtidas e comentários
- **Seguir pessoas** e conselhos
- **Mural do conselho**, só para membros: a diretoria publica atas e avisos e pode fixá-los
- A diretoria publica no feed **em nome do conselho**
- **Eventos**: reuniões do conselho e conferências, com **Lembrar-me** (Google Agenda ou arquivo .ics com alarme)
- **Denúncias**, com fila de moderação no Admin
- **Diretoria inativa** (60 dias): membros pedem para assumir e o admin aprova

### Versão 1

- Login com Google e cadastro de perfil: cidade (IBGE), segmento, conselho e UBS
- Busca de conselhos parecidos enquanto a pessoa digita, para evitar duplicados
- Cadastro de conselho: quem cadastra vira **diretoria provisória**
- Página do conselho: UBS atendidas, reuniões, diretoria, membros, **Seguir** e **Quero participar**
- Painel da diretoria: responder pedidos, editar dados, indicar diretoria e remover membros
- Cartão *"A sua UBS tem um Conselho Local de Saúde!"* para quem ainda não tem vínculo
- Trilhas → cursos → aulas (texto, vídeo do YouTube, PDF), com comentários, curtidas e aulas salvas
- Questionários com correção no servidor (5 questões por curso, aprovação com 3 acertos, tentativas ilimitadas)
- XP, 5 níveis e medalhas por trilha
- Painel admin: trilhas, cursos, aulas, questões (dos cursos e do Modo Desafio) e união de conselhos duplicados
- Conteúdo inicial: a **Trilha 1 completa** (5 cursos com aula e questões) e as Trilhas 2 a 5 como rascunho

---

## Como colocar no ar (passo a passo)

### 1. Criar o projeto no Supabase

1. Crie uma conta em <https://supabase.com> e clique em **New project** (plano Free). Escolha a região **São Paulo**.
2. No menu **SQL Editor**, rode os arquivos da pasta `supabase/migrations/`, **nesta ordem**. Copie o conteúdo de cada um, cole e clique em **Run**:
   1. `20261023000000_versao1.sql` — tabelas, regras de segurança e funções
   2. `20261023000100_localidades.sql` — estados e municípios do IBGE
   3. `20261023000200_conteudo_inicial.sql` — trilhas iniciais
   4. `20261024000000_versao2.sql` — feed, mural, eventos e moderação

   > **Já rodou os 3 primeiros antes?** Rode só o 4º.
3. Em **Project Settings → API**, copie a **Project URL** e a chave **anon public**.

### 2. Ativar o login com Google

1. Acesse <https://console.cloud.google.com>, crie um projeto e vá em **APIs e serviços → Tela de consentimento OAuth**. Preencha o nome do app e o seu e-mail e publique.
2. Em **Credenciais → Criar credenciais → ID do cliente OAuth**, escolha **Aplicativo da Web**.
3. Em **URIs de redirecionamento autorizados**, coloque `https://SEU-PROJETO.supabase.co/auth/v1/callback`. O endereço exato aparece no Supabase, em **Authentication → Providers → Google**.
4. Copie o **Client ID** e o **Client Secret** para o Supabase, em **Authentication → Providers → Google**, e ative.
5. Em **Authentication → URL Configuration**:
   - **Site URL**: o endereço do app na Vercel (passo 5), ex. `https://meu-conselho.vercel.app`
   - **Redirect URLs**: adicione também `http://localhost:5173` para testar no seu computador.

### 3. Rodar no seu computador (opcional)

Precisa do [Node.js](https://nodejs.org) 20 ou mais novo.

```bash
cp .env.example .env      # depois edite o .env com a URL e a chave anon do passo 1
npm install
npm run dev               # abre em http://localhost:5173
```

### 4. Virar administrador

Entre no app uma vez com a sua conta Google. Depois, no **SQL Editor** do Supabase, rode:

```sql
update public.profiles set is_admin = true
where id = (select id from auth.users where email = 'SEU-EMAIL@gmail.com');
```

Recarregue o app: a aba **⚙️ Admin** vai aparecer.

### 5. Publicar na Vercel

1. Crie uma conta em <https://vercel.com> usando o GitHub.
2. Clique em **Add New → Project** e importe este repositório.
3. Não é preciso configurar variáveis: o endereço e a chave **pública** do Supabase ficam em `src/config.ts`. Se trocar de projeto no Supabase, atualize esse arquivo.
4. Clique em **Deploy**. Depois, coloque o endereço gerado na **Site URL** do Supabase (passo 2.5).

No celular, abra o endereço e use **"Adicionar à tela inicial"** para instalar o app.

### 6. Importar as UBS (CNES)

As UBS vêm da API de Dados Abertos do Ministério da Saúde. Rode **um estado por vez** no seu computador, com a chave **service_role** (em **Project Settings → API**). Essa chave dá acesso total ao banco: **nunca** coloque-a no `.env` do app nem no GitHub.

```bash
SUPABASE_URL=https://SEU-PROJETO.supabase.co SUPABASE_SERVICE_ROLE_KEY=sua-chave-service-role npm run importar-ubs -- SP
```

Enquanto as UBS de um estado não forem importadas, as pessoas ainda podem cadastrar a sua UBS manualmente pelo botão **"Não encontrei minha UBS"**.

---

## Estrutura

```
src/
  pages/            telas (Início, Aprender, Aula, Questionário, Conselho, Perfil, admin/)
  components/       seletores de cidade, UBS e conselho; layout; elementos visuais
  contexts/         login e perfil
  lib/              cliente Supabase, tipos, níveis de XP
supabase/migrations banco de dados (rodar no SQL Editor)
scripts/            importação de UBS do CNES
docs/MODELAGEM.md   decisões do produto
```
