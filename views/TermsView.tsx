import React from 'react';
import { Shield, ArrowLeft } from 'lucide-react';

interface TermsViewProps {
  onClose?: () => void;
}

export const TermsView: React.FC<TermsViewProps> = ({ onClose }) => {
  return (
    <div className="min-h-screen bg-[#F8F9FC] flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-4xl bg-white shadow-xl rounded-[2.5rem] p-8 md:p-14 animate-in slide-in-from-bottom duration-500">
        <div className="flex items-center gap-4 mb-10 border-b border-gray-100 pb-8">
          {onClose && (
            <button 
              onClick={onClose}
              className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div className="w-14 h-14 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center flex-shrink-0">
            <Shield size={28} />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">Termos de Uso e Serviço</h1>
            <p className="text-sm font-bold text-gray-400">DeliveryCity</p>
          </div>
        </div>

        <div className="prose prose-orange max-w-none text-gray-600 space-y-8">
          <p className="text-base font-medium leading-relaxed">
            Bem-vindo ao DeliveryCity. Ao acessar e utilizar nossa plataforma (aplicativo e site), você concorda com os presentes Termos de Uso e Condições de Serviço ("Termos"). Leia-os atentamente antes de prosseguir com seu cadastro.
          </p>

          <section>
            <h2 className="text-xl font-black text-gray-900 mb-4">1. Visão Geral e Aceitação dos Termos</h2>
            <p>O DeliveryCity é uma plataforma tecnológica de marketplace que conecta três partes principais:</p>
            <ul className="list-disc pl-5 space-y-1 mb-4">
              <li><strong>Clientes/Usuários finais:</strong> pessoas físicas ou jurídicas que desejam adquirir produtos;</li>
              <li><strong>Lojistas/Restaurantes Parceiros:</strong> estabelecimentos que utilizam a plataforma para comercializar seus produtos;</li>
              <li><strong>Entregadores Parceiros:</strong> profissionais independentes que utilizam a plataforma para receber oportunidades de prestação de serviços de entrega.</li>
            </ul>
            <p>O DeliveryCity atua exclusivamente como intermediador tecnológico, disponibilizando ferramentas digitais para aproximar Clientes, Lojistas e Entregadores parceiros.</p>
            <p>O DeliveryCity não fabrica, prepara, armazena, vende ou entrega diretamente os produtos anunciados na plataforma, tampouco mantém frota própria de transporte ou serviço logístico próprio. As relações comerciais de compra e venda são firmadas diretamente entre Cliente e Lojista, enquanto os serviços de entrega são executados diretamente pelos Entregadores parceiros independentes.</p>
            <p>Ao criar uma conta ou utilizar os serviços da plataforma, o usuário declara ter lido, compreendido e aceitado integralmente estes Termos.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-gray-900 mb-4">2. Cadastro e Acesso à Plataforma</h2>
            <h3 className="text-lg font-bold text-gray-800 mt-4 mb-2">2.1. Veracidade das Informações</h3>
            <p>Para utilizar o DeliveryCity, o usuário deverá criar uma conta fornecendo informações verdadeiras, completas, precisas e atualizadas. O usuário é integralmente responsável pelos dados fornecidos e pelas consequências decorrentes de informações falsas, incorretas ou desatualizadas.</p>
            
            <h3 className="text-lg font-bold text-gray-800 mt-4 mb-2">2.2. Idade Mínima</h3>
            <p>A plataforma é destinada a usuários maiores de 18 (dezoito) anos. Menores de idade somente poderão utilizar a plataforma mediante supervisão e autorização expressa de seus pais ou responsáveis legais.</p>
            <p className="mt-2">O cadastro de Entregadores parceiros exige obrigatoriamente:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Idade mínima de 18 anos;</li>
              <li>Documentação pessoal válida;</li>
              <li>CNH regular, quando aplicável;</li>
              <li>Documentação do veículo em conformidade com a legislação vigente.</li>
            </ul>

            <h3 className="text-lg font-bold text-gray-800 mt-4 mb-2">2.3. Segurança da Conta</h3>
            <p>O usuário é o único responsável pela guarda, confidencialidade e utilização de sua senha e credenciais de acesso. Qualquer atividade realizada na conta será considerada de responsabilidade do titular cadastrado. O DeliveryCity poderá bloquear temporariamente contas com indícios de fraude, invasão, uso indevido ou movimentação suspeita.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-gray-900 mb-4">3. Direitos e Deveres do Cliente</h2>
            <h3 className="text-lg font-bold text-gray-800 mt-4 mb-2">3.1. Pagamento</h3>
            <p>O Cliente compromete-se a efetuar o pagamento integral dos pedidos aprovados, incluindo:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Valor dos produtos;</li>
              <li>Taxas de entrega;</li>
              <li>Taxas de serviço aplicáveis;</li>
              <li>Adicionais eventualmente informados no momento da compra.</li>
            </ul>

            <h3 className="text-lg font-bold text-gray-800 mt-4 mb-2">3.2. Informações de Entrega</h3>
            <p>O Cliente deverá fornecer endereço correto, completo e seguro para realização da entrega, responsabilizando-se por eventuais prejuízos decorrentes de informações incorretas ou insuficientes.</p>

            <h3 className="text-lg font-bold text-gray-800 mt-4 mb-2">3.3. Cancelamentos e Reembolsos</h3>
            <p>O Cliente poderá solicitar o cancelamento do pedido sem custos apenas antes do início do preparo pelo estabelecimento parceiro.</p>
            <p className="mt-2">Após o início do preparo, o cancelamento poderá:</p>
            <ul className="list-disc pl-5 space-y-1 mb-2">
              <li>Gerar cobrança parcial ou integral do pedido;</li>
              <li>Não garantir reembolso total;</li>
              <li>Estar sujeito à análise da plataforma.</li>
            </ul>
            <p>Pedidos já entregues não serão reembolsados, salvo nos casos previstos na legislação aplicável ou mediante comprovação de falha relevante. Reembolsos realizados via cartão de crédito, PIX ou outros meios eletrônicos poderão seguir os prazos das instituições financeiras responsáveis pela transação. Cupons promocionais, créditos bônus ou descontos concedidos pela plataforma poderão não ser reembolsáveis ou reutilizáveis após cancelamento.</p>

            <h3 className="text-lg font-bold text-gray-800 mt-4 mb-2">3.4. Avaliações</h3>
            <p>O Cliente poderá avaliar Lojistas e Entregadores parceiros. As avaliações devem ser feitas de maneira ética, objetiva e respeitosa, sendo proibido:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Conteúdo ofensivo;</li>
              <li>Linguagem discriminatória;</li>
              <li>Ameaças ou difamação;</li>
              <li>Informações falsas.</li>
            </ul>
            <p className="mt-2">O DeliveryCity poderá remover avaliações que violem estes Termos.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-gray-900 mb-4">4. Direitos e Deveres do Lojista/Restaurante Parceiro</h2>
            <h3 className="text-lg font-bold text-gray-800 mt-4 mb-2">4.1. Responsabilidade pelos Produtos</h3>
            <p>O Lojista é integralmente responsável pela qualidade dos produtos, preparo, conservação, higiene, validade, embalagem e cumprimento das normas sanitárias aplicáveis.</p>
            
            <h3 className="text-lg font-bold text-gray-800 mt-4 mb-2">4.2. Cardápio, Estoque e Preços</h3>
            <p>O Lojista deverá manter permanentemente atualizados os preços, a disponibilidade de estoque, o cardápio, os horários de funcionamento e taxas eventualmente aplicáveis.</p>
            
            <h3 className="text-lg font-bold text-gray-800 mt-4 mb-2">4.3. Obrigações Tributárias</h3>
            <p>O Lojista é exclusivamente responsável por emissão de cupom fiscal ou nota fiscal, recolhimento de tributos e regularidade fiscal de suas operações.</p>
            
            <h3 className="text-lg font-bold text-gray-800 mt-4 mb-2">4.4. Atendimento ao Cliente</h3>
            <p>O Lojista compromete-se a manter padrão adequado de atendimento, preparo e tempo de resposta aos pedidos recebidos pela plataforma.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-gray-900 mb-4">5. Direitos e Deveres do Entregador Parceiro</h2>
            <h3 className="text-lg font-bold text-gray-800 mt-4 mb-2">5.1. Natureza da Relação</h3>
            <p>O Entregador parceiro atua de forma autônoma e independente, utilizando recursos próprios para execução das entregas. Não existe vínculo empregatício, societário, associativo ou relação de subordinação entre o DeliveryCity e o Entregador parceiro.</p>
            
            <h3 className="text-lg font-bold text-gray-800 mt-4 mb-2">5.2. Custos e Responsabilidades Operacionais</h3>
            <p>O Entregador é integralmente responsável pelos custos relacionados à atividade, incluindo combustível, manutenção do veículo, internet, seguro, equipamentos, impostos, multas, licenças e demais despesas operacionais.</p>

            <h3 className="text-lg font-bold text-gray-800 mt-4 mb-2">5.3. Documentação e Regularidade</h3>
            <p>O Entregador deverá manter toda documentação pessoal e do veículo devidamente regularizada e válida perante a legislação aplicável.</p>

            <h3 className="text-lg font-bold text-gray-800 mt-4 mb-2">5.4. Integridade da Entrega</h3>
            <p>O Entregador compromete-se a zelar pela integridade do pedido, agir com cordialidade, respeitar normas de trânsito, cumprir a rota de entrega adequadamente e preservar os produtos transportados.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-gray-900 mb-4">6. Modelo Financeiro, Taxas e Split de Pagamentos</h2>
            <h3 className="text-lg font-bold text-gray-800 mt-4 mb-2">6.1. Intermediação Financeira</h3>
            <p>O DeliveryCity poderá utilizar sistemas de split de pagamento para distribuição automática dos valores transacionados na plataforma entre Lojistas, Entregadores parceiros, DeliveryCity e instituições financeiras envolvidas.</p>

            <h3 className="text-lg font-bold text-gray-800 mt-4 mb-2">6.2. Taxas da Plataforma</h3>
            <p>O DeliveryCity poderá cobrar comissão sobre pedidos, taxas administrativas, taxas de serviço, tarifas financeiras e custos operacionais aplicáveis. As taxas vigentes serão disponibilizadas no painel do parceiro, contrato específico ou ambiente administrativo da plataforma.</p>

            <h3 className="text-lg font-bold text-gray-800 mt-4 mb-2">6.3. Repasses</h3>
            <p>Os valores devidos aos parceiros poderão sofrer descontos referentes a taxas financeiras, promoções, cupons, subsídios, cancelamentos, estornos, chargebacks e impostos incidentes. Os repasses ocorrerão conforme periodicidade previamente informada pela plataforma.</p>

            <h3 className="text-lg font-bold text-gray-800 mt-4 mb-2">6.4. Retenções e Ajustes</h3>
            <p>O DeliveryCity poderá realizar retenções temporárias, compensações ou ajustes financeiros em casos de suspeita de fraude, contestação bancária, chargeback, uso indevido da plataforma, cancelamentos indevidos ou violação destes Termos.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-gray-900 mb-4">7. Propriedade Intelectual</h2>
            <p>Todo o conteúdo da plataforma, incluindo marcas, logotipos, identidade visual, textos, imagens, software, código-fonte, layout e funcionalidades, é protegido pela legislação de propriedade intelectual e pertence exclusivamente ao DeliveryCity ou aos seus licenciantes.</p>
            <p>É proibida a reprodução, cópia, modificação, distribuição ou exploração comercial sem autorização prévia e expressa.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-gray-900 mb-4">8. Política de Privacidade e Proteção de Dados</h2>
            <h3 className="text-lg font-bold text-gray-800 mt-4 mb-2">8.1. Tratamento de Dados</h3>
            <p>O DeliveryCity realiza tratamento de dados pessoais em conformidade com a Lei Geral de Proteção de Dados Pessoais (LGPD – Lei nº 13.709/2018).</p>

            <h3 className="text-lg font-bold text-gray-800 mt-4 mb-2">8.2. Finalidade de Uso</h3>
            <p>Os dados poderão ser utilizados para processamento de pedidos, autenticação de usuários, prevenção a fraudes, localização de entregas, comunicação operacional e cumprimento de obrigações legais e regulatórias.</p>

            <h3 className="text-lg font-bold text-gray-800 mt-4 mb-2">8.3. Direitos do Titular</h3>
            <p>O titular dos dados poderá solicitar, nos termos da LGPD: acesso, correção, atualização, anonimização, portabilidade e exclusão de dados, quando aplicável.</p>

            <h3 className="text-lg font-bold text-gray-800 mt-4 mb-2">8.4. Compartilhamento de Dados</h3>
            <p>Os dados poderão ser compartilhados com instituições financeiras, gateways de pagamento, parceiros operacionais e autoridades públicas, quando exigido por lei.</p>

            <h3 className="text-lg font-bold text-gray-800 mt-4 mb-2">8.5. Retenção de Dados</h3>
            <p>Os dados poderão ser armazenados pelo período necessário para cumprimento de obrigações legais, prevenção contra fraudes, exercício regular de direitos e execução contratual.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-gray-900 mb-4">9. Limitação de Responsabilidade</h2>
            <p>O DeliveryCity atua exclusivamente como plataforma tecnológica de intermediação.</p>
            <p className="mt-2">O DeliveryCity não se responsabiliza por:</p>
            <ul className="list-disc pl-5 space-y-1 mb-2">
              <li>Qualidade, quantidade, validade ou segurança dos produtos fornecidos pelos Lojistas;</li>
              <li>Atrasos decorrentes de trânsito, clima, acidentes ou força maior;</li>
              <li>Acidentes envolvendo Entregadores parceiros;</li>
              <li>Falhas de internet ou indisponibilidade temporária do sistema;</li>
              <li>Danos causados por terceiros;</li>
              <li>Negociações realizadas fora da plataforma;</li>
              <li>Perdas decorrentes de informações incorretas fornecidas pelos usuários.</li>
            </ul>
            <p>O DeliveryCity não garante funcionamento ininterrupto, livre de erros ou totalmente seguro da plataforma.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-gray-900 mb-4">10. Condutas Proibidas</h2>
            <p>É proibido aos usuários:</p>
            <ul className="list-disc pl-5 space-y-1 mb-2">
              <li>Utilizar dados falsos, criar contas fraudulentas ou utilizar documentos de terceiros sem autorização;</li>
              <li>Manipular avaliações;</li>
              <li>Praticar golpes ou fraudes;</li>
              <li>Usar bots ou sistemas automatizados;</li>
              <li>Enviar spam, praticar assédio, ameaças ou discriminação;</li>
              <li>Realizar engenharia social ou utilizar a plataforma para atividades ilícitas;</li>
              <li>Tentar burlar taxas ou pagamentos da plataforma.</li>
            </ul>
            <p>O descumprimento poderá resultar em suspensão da conta, bloqueio temporário, exclusão definitiva, retenção de valores e medidas judiciais cabíveis.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-gray-900 mb-4">11. Suspensão, Bloqueio e Encerramento de Conta</h2>
            <p>O DeliveryCity poderá suspender, limitar ou encerrar contas que violem estes Termos, apresentem comportamento suspeito, pratiquem fraudes, causem danos à plataforma ou terceiros, ou descumpram a legislação aplicável.</p>
            <p>O usuário poderá solicitar encerramento da conta, respeitadas obrigações financeiras e legais pendentes.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-gray-900 mb-4">12. Alterações dos Termos</h2>
            <p>O DeliveryCity poderá modificar estes Termos a qualquer momento. Alterações relevantes poderão ser comunicadas por aplicativo, e-mail ou notificações na plataforma.</p>
            <p>A continuidade de uso da plataforma após a atualização implicará aceitação automática das novas condições.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-gray-900 mb-4">13. Foro e Legislação Aplicável</h2>
            <p>Estes Termos serão regidos pelas leis da República Federativa do Brasil.</p>
            <p>Para usuários consumidores, fica assegurado o foro de seu domicílio, nos termos da legislação consumerista aplicável. Para parceiros comerciais e entregadores, fica eleito o foro da comarca sede do DeliveryCity para resolução de conflitos relacionados a estes Termos.</p>
          </section>

          <div className="pt-8 border-t border-gray-100 mt-12 flex flex-col md:flex-row justify-between items-start md:items-center text-sm text-gray-400 font-bold tracking-wide">
            <span>Última atualização: Maio de 2026</span>
            <span className="mt-2 md:mt-0 px-4 py-2 bg-gray-50 rounded-lg">Equipe DeliveryCity</span>
          </div>
        </div>
      </div>
    </div>
  );
};
