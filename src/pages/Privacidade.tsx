import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const CONTATO = 'luisursini@gmail.com'
const ATUALIZADA_EM = '23 de outubro de 2026'

/** Política de privacidade (pública: abre mesmo sem login). */
export function Privacidade() {
  const { sessao } = useAuth()
  return (
    <div className="pagina-publica">
      <article className="pagina texto-legal">
        <Link to="/" className="voltar">
          ← {sessao ? 'Voltar ao app' : 'Página inicial'}
        </Link>
        <h1>Política de Privacidade</h1>
        <p className="texto-suave">Última atualização: {ATUALIZADA_EM}</p>

        <p>
          O <strong>Meu Conselho de Saúde</strong> é um projeto independente de educação sobre o controle social no SUS.
          Esta política explica, em linguagem simples, quais dados coletamos, para que usamos e quais são os seus
          direitos, de acordo com a Lei Geral de Proteção de Dados (LGPD, Lei nº 13.709/2018).
        </p>

        <h2>1. Quem é o responsável pelos dados</h2>
        <p>
          O responsável (controlador) é o mantenedor do projeto Meu Conselho de Saúde. Para qualquer dúvida ou
          pedido sobre seus dados, escreva para <a href={`mailto:${CONTATO}`}>{CONTATO}</a>.
        </p>

        <h2>2. Quais dados coletamos</h2>
        <ul>
          <li>
            <strong>Da sua conta Google</strong>, quando você entra: nome, e-mail e foto. Não temos acesso à sua senha.
          </li>
          <li>
            <strong>Do seu perfil</strong>, informados por você: cidade, segmento (usuário, trabalhador, gestão,
            prestador ou sem vínculo), conselho de saúde e UBS.
          </li>
          <li>
            <strong>Do uso do app</strong>: aulas concluídas, respostas dos questionários, pontos de experiência (XP),
            medalhas, aulas salvas, curtidas, pessoas e conselhos que você segue e lembretes de eventos.
          </li>
          <li>
            <strong>O que você publica</strong>: textos, fotos, links, comentários, pedidos de participação e denúncias.
          </li>
        </ul>
        <p>
          Não pedimos dados de saúde. <strong>Não publique informações de saúde suas ou de outras pessoas</strong>{' '}
          (diagnósticos, exames, nomes de pacientes).
        </p>

        <h2>3. Para que usamos</h2>
        <ul>
          <li>Permitir que você entre no app e manter seu perfil.</li>
          <li>Registrar seu progresso nas trilhas, calcular XP, níveis e medalhas.</li>
          <li>Ligar você ao conselho de saúde e à UBS do seu bairro e mostrar eventos e publicações relevantes.</li>
          <li>Moderar o conteúdo e manter a comunidade segura.</li>
        </ul>
        <p>
          Usamos os dados com base no seu consentimento, ao criar a conta, e para executar o serviço que você
          solicitou. <strong>Não vendemos seus dados</strong> nem os usamos para publicidade.
        </p>

        <h2>4. Quem pode ver o quê</h2>
        <ul>
          <li>
            <strong>Outras pessoas cadastradas no app</strong> podem ver seu nome, foto, cidade, segmento, conselho,
            nível, medalhas e as publicações que você faz no feed.
          </li>
          <li>
            <strong>O mural do conselho</strong> só é visto pelos membros daquele conselho.
          </li>
          <li>
            <strong>Seu e-mail não aparece</strong> para outros usuários.
          </li>
          <li>
            <strong>A diretoria do conselho</strong> vê os pedidos de participação enviados a ela.
          </li>
          <li>
            <strong>A administração do app</strong> pode ver conteúdos denunciados para fazer a moderação.
          </li>
        </ul>

        <h2>5. Serviços que usamos</h2>
        <p>Para funcionar, o app usa serviços de terceiros, que tratam os dados apenas para prestar o serviço:</p>
        <ul>
          <li>
            <strong>Supabase</strong>: banco de dados, login e armazenamento de arquivos.
          </li>
          <li>
            <strong>Vercel</strong>: hospedagem do site.
          </li>
          <li>
            <strong>Google</strong>: login com a conta Google.
          </li>
          <li>
            <strong>YouTube</strong>: exibição de vídeos incorporados nas aulas e publicações.
          </li>
        </ul>
        <p>Alguns desses serviços podem armazenar dados em servidores fora do Brasil.</p>

        <h2>6. Por quanto tempo guardamos</h2>
        <p>
          Guardamos seus dados enquanto sua conta existir. Se você pedir a exclusão, apagamos sua conta e seus dados em
          até 30 dias, exceto o que a lei obrigar a manter.
        </p>

        <h2>7. Seus direitos</h2>
        <p>Pela LGPD, você pode, a qualquer momento:</p>
        <ul>
          <li>saber quais dados temos sobre você e receber uma cópia;</li>
          <li>corrigir dados incompletos ou errados (a maioria você mesmo altera em “Editar perfil”);</li>
          <li>pedir a exclusão da sua conta e dos seus dados;</li>
          <li>retirar seu consentimento.</li>
        </ul>
        <p>
          Para isso, escreva para <a href={`mailto:${CONTATO}`}>{CONTATO}</a>. Você também pode apagar suas publicações
          e comentários diretamente no app.
        </p>

        <h2>8. Segurança</h2>
        <p>
          Os dados trafegam com criptografia (HTTPS) e o banco tem regras de acesso que impedem, por exemplo, que uma
          pessoa veja o mural de um conselho do qual não faz parte ou altere os pontos de outra. Nenhum sistema é 100%
          seguro; se acontecer algum incidente relevante, avisaremos as pessoas afetadas.
        </p>

        <h2>9. Crianças e adolescentes</h2>
        <p>
          O app é voltado a adultos interessados no controle social do SUS. Menores de 18 anos devem usá-lo com
          autorização e acompanhamento do responsável.
        </p>

        <h2>10. Mudanças nesta política</h2>
        <p>
          Podemos atualizar esta política. Quando a mudança for importante, avisaremos no app. A data da última
          atualização fica no topo desta página.
        </p>
      </article>
    </div>
  )
}
