import type { InvestigacaoCompleta } from '../servidor/repositorio';

/**
 * Fixture anonimizado de regressão.
 *
 * Inspirado no TIPO de fluxo descrito no exemplo de referência (tombamento de
 * equipamento móvel), sem nomes, matrículas, identidade corporativa ou
 * conclusões do caso original. Os dados são fictícios.
 *
 * O fixture fornece DADOS, não resultados. Os testes verificam comportamento,
 * rastreabilidade e regras — nunca exigem que a análise reproduza conclusões
 * pré-programadas.
 *
 * Cobre os 14 itens da seção 13 do prompt mestre:
 *  1. cronologia com manutenção e alarmes anteriores;
 *  2. coleta organizada por PEEPO com responsável;
 *  3. fatos, fatores contribuintes, causas sistêmicas e melhorias não causais;
 *  4. conflito entre leitura relatada e registro técnico, preservado;
 *  5. matriz comparando limite, nota de manutenção, parâmetro e observado;
 *  6. relógios de sistemas com datas divergentes;
 *  7. possível bypass de barreira de engenharia sem encerrar no executante;
 *  8. recorrência de alarmes ligada à aprendizagem organizacional, com evidência;
 *  9. distinção entre condição mecânica, ambiente, ação, defesa e organização;
 * 10. ações ligadas a fatores e classificadas na hierarquia de controles;
 * 11. plano com excesso de ações administrativas para ser desafiado;
 * 12. contagens reconciliáveis entre resumo e registros;
 * 13. indicadores de eficácia e risco residual;
 * 14. citações rastreáveis a evidência e localizador.
 */

export const ORGANIZACAO_FIXTURE = 'org-demo';
export const INVESTIGACAO_FIXTURE = 'inv-2026-0001';

export function criarCasoAnonimizado(): InvestigacaoCompleta {
  return {
    investigacaoId: INVESTIGACAO_FIXTURE,
    codigo: 'INV-2026-0001',
    titulo: 'Tombamento de equipamento móvel em rampa de acesso a ponto de basculamento',
    fase: 'analise',

    metadados: {
      organizacaoId: ORGANIZACAO_FIXTURE,
      descricaoInicial:
        'Durante manobra de aproximação ao ponto de basculamento, equipamento móvel de grande porte tombou lateralmente sobre a berma. ' +
        'Não houve lesão. O equipamento sofreu danos estruturais e a via ficou interditada por 14 horas.',
      ocorridoEm: '2026-03-12T14:47:00.000Z',
      precisaoOcorrencia: 'aproximado',
      local: 'Rampa de acesso ao ponto de basculamento — setor norte',
      atividade: 'Transporte e basculamento de material',
      severidadeReal: 'moderada',
      severidadePotencial: 'catastrofica',
      nivelInvestigacao: 'completo',
      acoesImediatas:
        'Isolamento da área, interdição da rampa, remoção controlada do equipamento e suspensão do basculamento no ponto até avaliação geotécnica.',
      localPreservado: true,
      confidencialidade: 'interna',
      criadoEm: '2026-03-12T16:00:00.000Z',
      atualizadoEm: '2026-03-12T16:00:00.000Z',
      excluidoEm: null,
      versao: 1,
      equipe: [
        { usuarioId: 'u-lider', nome: 'Líder da investigação', papel: 'lider', conflitoInteresse: false },
        { usuarioId: 'u-facilitador', nome: 'Facilitador ICAM', papel: 'facilitador_icam', conflitoInteresse: false },
        { usuarioId: 'u-manutencao', nome: 'Representante de manutenção', papel: 'manutencao', conflitoInteresse: true },
        { usuarioId: 'u-operacao', nome: 'Representante de operação', papel: 'operacao', conflitoInteresse: false },
        { usuarioId: 'u-revisor', nome: 'Revisor técnico', papel: 'revisor', conflitoInteresse: false },
      ],
      envolvidos: [
        { id: 'env-1', tipo: 'pessoa', pseudonimo: 'Operador A', funcao: 'Operador de equipamento móvel', nome: null, matricula: null },
        { id: 'env-2', tipo: 'pessoa', pseudonimo: 'Supervisor B', funcao: 'Supervisão de turno', nome: null, matricula: null },
        { id: 'env-3', tipo: 'equipamento', pseudonimo: 'Equipamento EM-07', funcao: null, nome: null, matricula: null },
      ],
      consequencias: [
        { dimensao: 'seguranca', tipo: 'real', descricao: 'Sem lesão. Exposição de uma pessoa a energia gravitacional elevada.', nivel: 'moderada' },
        { dimensao: 'seguranca', tipo: 'potencial', descricao: 'Fatalidade em cenário com tombamento sobre a cabine ou queda de talude.', nivel: 'catastrofica' },
        { dimensao: 'operacional', tipo: 'real', descricao: 'Interdição da via por 14 horas.', nivel: 'moderada' },
        { dimensao: 'financeiro', tipo: 'real', descricao: 'Dano estrutural ao equipamento.', nivel: 'maior' },
      ],
    },

    // -- Evidências (seção 13.14: citações rastreáveis) ---------------------
    evidencias: [
      {
        id: 'ev-1', identificador: 'EV-001', titulo: 'Registro de telemetria do equipamento (24 h anteriores)',
        categoria: 'telemetria', hashOriginal: 'a1'.repeat(32), confidencialidade: 'interna',
        contemDadoSensivel: false, autenticidadeAvaliada: 'confirmada',
        localizadoresValidos: ['linha 1842', 'linha 1843', 'linha 1901'],
      },
      {
        id: 'ev-2', identificador: 'EV-002', titulo: 'Ordem de manutenção do sistema de nivelamento',
        categoria: 'ordem_manutencao', hashOriginal: 'b2'.repeat(32), confidencialidade: 'interna',
        contemDadoSensivel: false, autenticidadeAvaliada: 'confirmada',
        localizadoresValidos: ['p. 2', 'p. 3'],
      },
      {
        id: 'ev-3', identificador: 'EV-003', titulo: 'Procedimento de transporte e basculamento, revisão 04',
        categoria: 'procedimento', hashOriginal: 'c3'.repeat(32), confidencialidade: 'interna',
        contemDadoSensivel: false, autenticidadeAvaliada: 'confirmada',
        localizadoresValidos: ['item 7.3', 'item 9.1'],
      },
      {
        id: 'ev-4', identificador: 'EV-004', titulo: 'Checklist pré-operacional do turno',
        categoria: 'registro_turno', hashOriginal: 'd4'.repeat(32), confidencialidade: 'interna',
        contemDadoSensivel: false, autenticidadeAvaliada: 'duvidosa',
        localizadoresValidos: ['campo 12'],
      },
      {
        id: 'ev-5', identificador: 'EV-005', titulo: 'Log de alarmes do controlador (90 dias)',
        categoria: 'log', hashOriginal: 'e5'.repeat(32), confidencialidade: 'interna',
        contemDadoSensivel: false, autenticidadeAvaliada: 'confirmada',
        localizadoresValidos: ['evento 214', 'evento 331', 'agregado 90d'],
      },
      {
        id: 'ev-6', identificador: 'EV-006', titulo: 'Transcrição de entrevista — Operador A',
        categoria: 'documento', hashOriginal: 'f6'.repeat(32), confidencialidade: 'restrita',
        contemDadoSensivel: false, autenticidadeAvaliada: 'confirmada',
        localizadoresValidos: ['00:12:40', '00:18:05'],
      },
      {
        id: 'ev-7', identificador: 'EV-007', titulo: 'Levantamento topográfico da rampa após o evento',
        categoria: 'diagrama', hashOriginal: '07'.repeat(32), confidencialidade: 'interna',
        contemDadoSensivel: false, autenticidadeAvaliada: 'confirmada',
        localizadoresValidos: ['seção A-A', 'planta 1'],
      },
      {
        id: 'ev-8', identificador: 'EV-008', titulo: 'Captura da configuração de parâmetros do controlador',
        categoria: 'sensor', hashOriginal: '08'.repeat(32), confidencialidade: 'interna',
        contemDadoSensivel: false, autenticidadeAvaliada: 'confirmada',
        localizadoresValidos: ['tela 3', 'parâmetro P-114'],
      },
    ],

    // -- Fontes temporais (seção 13.6: relógios divergentes) ----------------
    fontesTemporais: [
      { id: 'ft-1', nome: 'Sistema de despacho', desvioSegundos: 0, confiabilidade: 'alta' },
      { id: 'ft-2', nome: 'Controlador do equipamento', desvioSegundos: 372, confiabilidade: 'media' },
      { id: 'ft-3', nome: 'Relógio de registro manual do turno', desvioSegundos: null, confiabilidade: 'baixa' },
    ],

    // -- Cronologia (seção 13.1: manutenção e alarmes anteriores) -----------
    eventos: [
      {
        id: 'ec-1', titulo: 'Abertura de ordem de manutenção para o sistema de nivelamento',
        instanteNormalizado: '2026-02-19T09:15:00.000Z', precisao: 'exato', fonteTemporalId: 'ft-1', conflitoTemporal: false,
      },
      {
        id: 'ec-2', titulo: 'Registro de 37 acionamentos do alarme de inclinação em 90 dias',
        instanteNormalizado: '2026-03-11T23:59:00.000Z', precisao: 'intervalo', fonteTemporalId: 'ft-2', conflitoTemporal: false,
      },
      {
        id: 'ec-3', titulo: 'Alteração do parâmetro de limiar do alarme de inclinação',
        instanteNormalizado: '2026-02-27T11:02:00.000Z', precisao: 'exato', fonteTemporalId: 'ft-2', conflitoTemporal: true,
      },
      {
        id: 'ec-4', titulo: 'Preenchimento do checklist pré-operacional do turno',
        instanteNormalizado: '2026-03-12T06:12:00.000Z', precisao: 'aproximado', fonteTemporalId: 'ft-3', conflitoTemporal: false,
      },
      {
        id: 'ec-5', titulo: 'Início da manobra de aproximação ao ponto de basculamento',
        instanteNormalizado: '2026-03-12T14:45:00.000Z', precisao: 'aproximado', fonteTemporalId: 'ft-1', conflitoTemporal: false,
      },
      {
        id: 'ec-6', titulo: 'Tombamento lateral do equipamento',
        instanteNormalizado: '2026-03-12T14:47:00.000Z', precisao: 'aproximado', fonteTemporalId: 'ft-1', conflitoTemporal: false,
      },
      {
        id: 'ec-7', titulo: 'Isolamento da área e acionamento da emergência',
        instanteNormalizado: '2026-03-12T14:53:00.000Z', precisao: 'exato', fonteTemporalId: 'ft-1', conflitoTemporal: false,
      },
    ],

    // -- Plano PEEPO (seção 13.2) -------------------------------------------
    itensPeepo: [
      { id: 'pp-1', dimensao: 'pessoas', perguntaInvestigativa: 'Qual era a expectativa de trabalho definida para a manobra de aproximação?', status: 'coletado', responsavel: 'Representante de operação', prazo: '2026-03-16' },
      { id: 'pp-2', dimensao: 'pessoas', perguntaInvestigativa: 'Qual era o padrão de turno e a jornada nos sete dias anteriores?', status: 'indisponivel', responsavel: 'Representante de operação', prazo: '2026-03-16' },
      { id: 'pp-3', dimensao: 'ambiente', perguntaInvestigativa: 'Qual era o gradiente e a condição da superfície da rampa no momento do evento?', status: 'coletado', responsavel: 'Engenharia geotécnica', prazo: '2026-03-15' },
      { id: 'pp-4', dimensao: 'equipamentos', perguntaInvestigativa: 'Qual era a condição do sistema de nivelamento e o histórico de intervenções?', status: 'coletado', responsavel: 'Representante de manutenção', prazo: '2026-03-15' },
      { id: 'pp-5', dimensao: 'equipamentos', perguntaInvestigativa: 'Qual limiar estava configurado no alarme de inclinação e quando foi alterado?', status: 'coletado', responsavel: 'Automação', prazo: '2026-03-17' },
      { id: 'pp-6', dimensao: 'procedimentos', perguntaInvestigativa: 'Qual revisão do procedimento estava vigente e qual limite de gradiente ela estabelece?', status: 'coletado', responsavel: 'Segurança', prazo: '2026-03-14' },
      { id: 'pp-7', dimensao: 'organizacao', perguntaInvestigativa: 'O que a organização fez com a recorrência de alarmes de inclinação registrada nos 90 dias anteriores?', status: 'coletado', responsavel: 'Líder da investigação', prazo: '2026-03-20' },
      { id: 'pp-8', dimensao: 'organizacao', perguntaInvestigativa: 'Como a gestão de mudanças tratou a alteração do limiar do alarme?', status: 'em_andamento', responsavel: 'Líder da investigação', prazo: '2026-03-22' },
    ],

    // -- Livro de fatos (seção 13.3) ----------------------------------------
    fatos: [
      {
        id: 'f-1', identificador: 'F-001',
        proposicao: 'O levantamento topográfico posterior indicou gradiente de 11,4% na seção onde ocorreu o tombamento.',
        tipoAssercao: 'medicao_ou_registro', estadoVerificacao: 'corroborado', confianca: 'alta',
        aprovadoPorHumano: true, origemIa: false,
        vinculos: [{ evidenciaId: 'ev-7', declaracaoId: null, sentido: 'favoravel', localizador: 'seção A-A', trecho: 'Gradiente medido: 11,4%', peso: 'forte' }],
      },
      {
        id: 'f-2', identificador: 'F-002',
        proposicao: 'O procedimento revisão 04 estabelece gradiente máximo de 8% para a via de acesso ao ponto de basculamento.',
        tipoAssercao: 'medicao_ou_registro', estadoVerificacao: 'corroborado', confianca: 'alta',
        aprovadoPorHumano: true, origemIa: false,
        vinculos: [{ evidenciaId: 'ev-3', declaracaoId: null, sentido: 'favoravel', localizador: 'item 7.3', trecho: 'gradiente máximo admissível de 8%', peso: 'forte' }],
      },
      {
        id: 'f-3', identificador: 'F-003',
        proposicao: 'O parâmetro P-114 do controlador estava configurado com limiar de inclinação de 12%.',
        tipoAssercao: 'medicao_ou_registro', estadoVerificacao: 'corroborado', confianca: 'alta',
        aprovadoPorHumano: true, origemIa: false,
        vinculos: [{ evidenciaId: 'ev-8', declaracaoId: null, sentido: 'favoravel', localizador: 'parâmetro P-114', trecho: 'P-114 = 12,0', peso: 'forte' }],
      },
      {
        id: 'f-4', identificador: 'F-004',
        proposicao: 'O log do controlador registrou 37 acionamentos do alarme de inclinação nos 90 dias anteriores ao evento.',
        tipoAssercao: 'medicao_ou_registro', estadoVerificacao: 'corroborado', confianca: 'alta',
        aprovadoPorHumano: true, origemIa: false,
        vinculos: [{ evidenciaId: 'ev-5', declaracaoId: null, sentido: 'favoravel', localizador: 'agregado 90d', trecho: '37 ocorrências de ALM-INCL', peso: 'forte' }],
      },
      {
        id: 'f-5', identificador: 'F-005',
        proposicao: 'A ordem de manutenção do sistema de nivelamento permanecia aberta na data do evento, com 22 dias desde a abertura.',
        tipoAssercao: 'medicao_ou_registro', estadoVerificacao: 'corroborado', confianca: 'alta',
        aprovadoPorHumano: true, origemIa: false,
        vinculos: [{ evidenciaId: 'ev-2', declaracaoId: null, sentido: 'favoravel', localizador: 'p. 2', trecho: 'status: aberta', peso: 'forte' }],
      },
      {
        id: 'f-6', identificador: 'F-006',
        proposicao: 'O operador relatou que o indicador de inclinação da cabine apresentava leitura próxima de 6% no momento da manobra.',
        tipoAssercao: 'declaracao_entrevistado', estadoVerificacao: 'contestado', confianca: 'media',
        aprovadoPorHumano: true, origemIa: false,
        vinculos: [
          { evidenciaId: 'ev-6', declaracaoId: 'd-1', sentido: 'favoravel', localizador: '00:12:40', trecho: 'o indicador marcava por volta de seis', peso: 'medio' },
          { evidenciaId: 'ev-1', declaracaoId: null, sentido: 'contraria', localizador: 'linha 1842', trecho: 'incl_lateral = 10.8', peso: 'forte' },
        ],
      },
      {
        id: 'f-7', identificador: 'F-007',
        proposicao: 'O checklist pré-operacional do turno registrou "conforme" no campo referente ao sistema de nivelamento.',
        tipoAssercao: 'medicao_ou_registro', estadoVerificacao: 'contestado', confianca: 'media',
        aprovadoPorHumano: true, origemIa: false,
        vinculos: [
          { evidenciaId: 'ev-4', declaracaoId: null, sentido: 'favoravel', localizador: 'campo 12', trecho: 'Sistema de nivelamento: conforme', peso: 'medio' },
          { evidenciaId: 'ev-2', declaracaoId: null, sentido: 'contraria', localizador: 'p. 3', trecho: 'sensor de nivelamento com leitura instável desde 19/02', peso: 'forte' },
        ],
      },
      {
        id: 'f-8', identificador: 'F-008',
        proposicao: 'A telemetria registrou inclinação lateral de 10,8% no instante anterior ao tombamento.',
        tipoAssercao: 'medicao_ou_registro', estadoVerificacao: 'corroborado', confianca: 'alta',
        aprovadoPorHumano: true, origemIa: false,
        vinculos: [{ evidenciaId: 'ev-1', declaracaoId: null, sentido: 'favoravel', localizador: 'linha 1842', trecho: 'incl_lateral = 10.8', peso: 'forte' }],
      },
      {
        id: 'f-9', identificador: 'F-009',
        proposicao: 'Não há registro de análise de gestão de mudanças associada à alteração do parâmetro P-114.',
        tipoAssercao: 'lacuna_informacao', estadoVerificacao: 'indeterminado', confianca: 'media',
        aprovadoPorHumano: true, origemIa: false,
        vinculos: [{ evidenciaId: 'ev-8', declaracaoId: null, sentido: 'contextual', localizador: 'tela 3', trecho: 'alteração registrada sem referência a MOC', peso: 'medio' }],
      },
    ],

    // -- Matriz de contradições (seções 13.4 e 13.5) ------------------------
    conflitos: [
      {
        id: 'c-1', identificador: 'C-001',
        titulo: 'Inclinação relatada pelo operador versus registro de telemetria',
        status: 'aberto', resolucao: null, justificativaResolucao: null,
        itens: [
          { rotulo: 'Leitura relatada em entrevista', valorRelatado: '≈ 6%', fatoId: 'f-6' },
          { rotulo: 'Registro de telemetria', valorRelatado: '10,8%', fatoId: 'f-8' },
        ],
      },
      {
        id: 'c-2', identificador: 'C-002',
        titulo: 'Limite de gradiente: procedimento, nota de manutenção, parâmetro configurado e valor observado',
        status: 'aberto', resolucao: null, justificativaResolucao: null,
        itens: [
          { rotulo: 'Limite do procedimento (rev. 04)', valorRelatado: '8,0%', fatoId: 'f-2' },
          { rotulo: 'Nota de manutenção (referência de projeto)', valorRelatado: '9,0%', fatoId: 'f-5' },
          { rotulo: 'Parâmetro configurado no controlador (P-114)', valorRelatado: '12,0%', fatoId: 'f-3' },
          { rotulo: 'Valor observado no local após o evento', valorRelatado: '11,4%', fatoId: 'f-1' },
        ],
      },
      {
        id: 'c-3', identificador: 'C-003',
        titulo: 'Checklist "conforme" versus evidência técnica posterior',
        status: 'em_diligencia', resolucao: null, justificativaResolucao: null,
        itens: [
          { rotulo: 'Checklist pré-operacional', valorRelatado: 'conforme', fatoId: 'f-7' },
          { rotulo: 'Ordem de manutenção aberta', valorRelatado: 'leitura instável desde 19/02', fatoId: 'f-5' },
        ],
      },
    ],

    lacunas: [
      { id: 'l-1', identificador: 'L-001', descricao: 'Registros de jornada e escala dos sete dias anteriores não foram disponibilizados.', criticidade: 'media', status: 'aberta' },
      { id: 'l-2', identificador: 'L-002', descricao: 'Não foi localizado registro de gestão de mudanças para a alteração do parâmetro P-114.', criticidade: 'alta', status: 'em_diligencia' },
      { id: 'l-3', identificador: 'L-003', descricao: 'O desvio do relógio de registro manual do turno não foi verificado.', criticidade: 'baixa', status: 'aberta' },
    ],

    // -- Classificação ICAM (seções 13.7, 13.8, 13.9) -----------------------
    classificacoes: [
      {
        id: 'cl-1', identificador: 'FT-001', codigo: 'DF08', coluna: 'defesas',
        descricaoContextual:
          'O alarme de inclinação, projetado para advertir o operador antes do limite de estabilidade, estava configurado com limiar de 12%, acima do gradiente máximo admitido pelo procedimento (8%) e acima do valor observado no local (11,4%).',
        mecanismo:
          'Com o limiar acima da condição limite da via, a advertência não foi acionada na faixa em que a manobra já era instável, eliminando a janela de detecção antes da perda de estabilidade.',
        estado: 'confirmado', natureza: 'fator_contribuinte', confianca: 'alta',
        estadoBarreira: 'falha',
        justificativaBarreira:
          'A barreira existia e estava energizada, mas o limiar configurado a tornava inoperante na faixa de risco relevante para esta via.',
        contrafactualResposta: 'evento_improvavel', origemIa: false, decisaoHumana: 'aceita', justificativaGenerico: null,
        sustentacoes: [
          { fatoId: 'f-3', sentido: 'favoravel', peso: 'forte' },
          { fatoId: 'f-1', sentido: 'favoravel', peso: 'forte' },
          { fatoId: 'f-2', sentido: 'favoravel', peso: 'forte' },
        ],
        codigosSecundarios: [
          { codigo: 'DF06', justificativa: 'O alerta visual em cabine compartilha o mesmo limiar e ficou igualmente inoperante na faixa relevante.' },
        ],
      },
      {
        id: 'cl-2', identificador: 'FT-002', codigo: 'TE22', coluna: 'condicoes_tarefa_ambiente',
        descricaoContextual:
          'A rampa de acesso apresentava gradiente de 11,4% na seção do evento, 3,4 pontos percentuais acima do limite estabelecido pelo procedimento vigente.',
        mecanismo:
          'O gradiente acima do especificado reduz a margem de estabilidade lateral do equipamento carregado, de modo que uma correção de trajetória normal passa a produzir transferência de carga suficiente para o tombamento.',
        estado: 'confirmado', natureza: 'causa_sistemica', confianca: 'alta',
        estadoBarreira: null, justificativaBarreira: null,
        contrafactualResposta: 'evento_improvavel', origemIa: false, decisaoHumana: 'aceita', justificativaGenerico: null,
        sustentacoes: [
          { fatoId: 'f-1', sentido: 'favoravel', peso: 'forte' },
          { fatoId: 'f-2', sentido: 'favoravel', peso: 'forte' },
        ],
        codigosSecundarios: [],
      },
      {
        id: 'cl-3', identificador: 'FT-003', codigo: 'TE08', coluna: 'condicoes_tarefa_ambiente',
        descricaoContextual:
          'O sistema de nivelamento do equipamento estava com ordem de manutenção aberta havia 22 dias, com leitura instável registrada desde 19/02.',
        mecanismo:
          'A instabilidade de leitura degrada a informação de inclinação apresentada em cabine, reduzindo a capacidade de o operador perceber a aproximação do limite de estabilidade.',
        estado: 'confirmado', natureza: 'fator_contribuinte', confianca: 'media',
        estadoBarreira: null, justificativaBarreira: null,
        contrafactualResposta: 'evento_ainda_plausivel', origemIa: false, decisaoHumana: 'aceita', justificativaGenerico: null,
        sustentacoes: [
          { fatoId: 'f-5', sentido: 'favoravel', peso: 'forte' },
          { fatoId: 'f-7', sentido: 'contraria', peso: 'medio' },
        ],
        codigosSecundarios: [],
      },
      {
        id: 'cl-4', identificador: 'FT-004', codigo: 'IT12', coluna: 'acoes',
        descricaoContextual:
          'A manobra de aproximação foi executada na via com gradiente acima do especificado, sem que a condição da via tivesse sido comunicada como restrição ativa.',
        mecanismo:
          'A execução da manobra na condição de via existente colocou o equipamento na faixa de instabilidade; a informação disponível em cabine não distinguia essa via das demais.',
        estado: 'confirmado', natureza: 'fator_contribuinte', confianca: 'media',
        estadoBarreira: null, justificativaBarreira: null,
        contrafactualResposta: 'evento_ainda_plausivel', origemIa: false, decisaoHumana: 'aceita', justificativaGenerico: null,
        sustentacoes: [
          { fatoId: 'f-8', sentido: 'favoravel', peso: 'forte' },
          { fatoId: 'f-6', sentido: 'contraria', peso: 'medio' },
        ],
        codigosSecundarios: [],
      },
      {
        id: 'cl-5', identificador: 'FT-005', codigo: 'OL', coluna: 'fatores_organizacionais',
        descricaoContextual:
          'Os 37 acionamentos do alarme de inclinação registrados nos 90 dias anteriores não geraram análise, ação ou revisão do limite da via.',
        mecanismo:
          'A recorrência de sinal sem tratamento removeu o mecanismo pelo qual a organização detectaria a deriva entre o limite de projeto e a condição real da via antes do evento.',
        estado: 'confirmado', natureza: 'causa_sistemica', confianca: 'alta',
        estadoBarreira: null, justificativaBarreira: null,
        contrafactualResposta: 'evento_improvavel', origemIa: false, decisaoHumana: 'aceita', justificativaGenerico: null,
        sustentacoes: [
          { fatoId: 'f-4', sentido: 'favoravel', peso: 'forte' },
          { fatoId: 'f-1', sentido: 'favoravel', peso: 'medio' },
        ],
        codigosSecundarios: [
          { codigo: 'MC', justificativa: 'A alteração do parâmetro P-114 não tem registro de análise de mudança associado (F-009).' },
        ],
      },
      {
        id: 'cl-6', identificador: 'FT-006', codigo: 'MM', coluna: 'fatores_organizacionais',
        descricaoContextual:
          'A ordem de manutenção do sistema de nivelamento permaneceu aberta por 22 dias sem restrição operacional associada ao equipamento.',
        mecanismo:
          'Sem regra que vincule pendência de sistema de segurança a restrição de uso, o equipamento seguiu operando com informação degradada de inclinação.',
        estado: 'confirmado', natureza: 'causa_sistemica', confianca: 'media',
        estadoBarreira: null, justificativaBarreira: null,
        contrafactualResposta: 'evento_ainda_plausivel', origemIa: false, decisaoHumana: 'aceita', justificativaGenerico: null,
        sustentacoes: [{ fatoId: 'f-5', sentido: 'favoravel', peso: 'forte' }],
        codigosSecundarios: [],
      },
      {
        id: 'cl-7', identificador: 'FT-007', codigo: 'HF04', coluna: 'fatores_humanos',
        descricaoContextual:
          'Hipótese de fadiga levantada na reunião de análise, sem registro de jornada disponível para avaliação.',
        mecanismo: null,
        estado: 'rejeitado', natureza: 'nao_definida', confianca: 'baixa',
        estadoBarreira: null, justificativaBarreira: null,
        contrafactualResposta: null, origemIa: true, decisaoHumana: 'rejeitada', justificativaGenerico: null,
        sustentacoes: [],
        codigosSecundarios: [],
      },
      {
        id: 'cl-8', identificador: 'FT-008', codigo: 'DF17', coluna: 'defesas',
        descricaoContextual:
          'A via não possuía sinalização ou delimitação física indicando restrição de uso para a seção com gradiente acima do especificado.',
        mecanismo:
          'Sem delimitação, a via de gradiente irregular era operacionalmente indistinguível das demais, o que impedia a decisão de evitá-la.',
        estado: 'confirmado', natureza: 'oportunidade_melhoria_nao_causal', confianca: 'media',
        estadoBarreira: 'ausente',
        justificativaBarreira:
          'Não há registro de projeto que preveja delimitação nesta via; a ausência é de concepção, não de degradação.',
        contrafactualResposta: 'evento_ainda_plausivel', origemIa: false, decisaoHumana: 'aceita', justificativaGenerico: null,
        sustentacoes: [{ fatoId: 'f-1', sentido: 'favoravel', peso: 'medio' }],
        codigosSecundarios: [],
      },
    ],

    relacoesCausais: [
      { id: 'rc-1', origemId: 'cl-5', destinoId: 'cl-2', tipo: 'permitiu', afirmacaoTestavel: 'A ausência de tratamento da recorrência de alarmes permitiu que o gradiente fora de especificação permanecesse em uso.', grauSustentacao: 'moderado' },
      { id: 'rc-2', origemId: 'cl-6', destinoId: 'cl-3', tipo: 'permitiu', afirmacaoTestavel: 'A ausência de restrição operacional vinculada à ordem aberta permitiu a operação com sistema de nivelamento degradado.', grauSustentacao: 'moderado' },
      { id: 'rc-3', origemId: 'cl-2', destinoId: 'cl-4', tipo: 'contribuiu_para', afirmacaoTestavel: 'O gradiente acima do especificado tornou a manobra padrão suficiente para atingir a faixa de instabilidade.', grauSustentacao: 'forte' },
      { id: 'rc-4', origemId: 'cl-3', destinoId: 'cl-4', tipo: 'contribuiu_para', afirmacaoTestavel: 'A informação degradada de inclinação reduziu a capacidade de perceber a aproximação do limite durante a manobra.', grauSustentacao: 'moderado' },
      { id: 'rc-5', origemId: 'cl-4', destinoId: 'cl-1', tipo: 'contribuiu_para', afirmacaoTestavel: 'A manobra na condição existente ocorreu na faixa em que o alarme, pelo limiar configurado, não atuaria.', grauSustentacao: 'moderado' },
    ],

    // -- Recomendações (seções 13.10, 13.11, 13.13) -------------------------
    recomendacoes: [
      {
        id: 'r-1', identificador: 'R-001',
        acaoProposta: 'Reperfilar a rampa de acesso para gradiente máximo de 8% e incluir a seção no ciclo de verificação topográfica quinzenal.',
        objetivo: 'Eliminar a condição de via fora de especificação no ponto de basculamento.',
        hierarquiaControle: 'engenharia',
        justificativaHierarquia: 'Atua sobre a condição física que reduz a margem de estabilidade, sem depender de comportamento.',
        alternativasSuperioresAvaliadas: 'Eliminação do ponto de basculamento avaliada e descartada por inviabilidade de layout; substituição por outro acesso avaliada e mantida como alternativa de contingência.',
        responsavel: 'Engenharia de mina', prazo: '2026-05-30',
        riscoResidual: 'Deriva do gradiente entre verificações; mitigado pelo ciclo quinzenal.',
        status: 'aprovada', jaTratadaPorId: null,
        classificacaoIds: ['cl-2'],
        indicadores: [
          { id: 'i-1', nome: 'Gradiente medido na seção crítica', meta: '≤ 8,0% em 100% das medições', metodoMedicao: 'Levantamento topográfico quinzenal com registro fotográfico', linhaBase: '11,4%', dataVerificacao: '2026-07-30' },
        ],
      },
      {
        id: 'r-2', identificador: 'R-002',
        acaoProposta: 'Reconfigurar o limiar do alarme de inclinação para valor derivado do limite de estabilidade do equipamento e bloquear a alteração do parâmetro por controle de acesso, com registro obrigatório de gestão de mudanças.',
        objetivo: 'Restaurar a janela de detecção antes da perda de estabilidade e impedir alteração silenciosa do limiar.',
        hierarquiaControle: 'engenharia',
        justificativaHierarquia: 'Restabelece a barreira por projeto e remove a possibilidade de bypass por configuração.',
        alternativasSuperioresAvaliadas: 'Eliminação não aplicável: a barreira é de detecção. Substituição por sistema de estabilidade ativo avaliada e mantida no roadmap por prazo de aquisição.',
        responsavel: 'Automação e manutenção', prazo: '2026-04-30',
        riscoResidual: 'Alarme depende de sensor íntegro; coberto pela ação R-003.',
        status: 'aprovada', jaTratadaPorId: null,
        classificacaoIds: ['cl-1'],
        indicadores: [
          { id: 'i-2', nome: 'Conformidade do parâmetro P-114 na frota', meta: '100% dos equipamentos com limiar conforme especificação', metodoMedicao: 'Auditoria mensal de configuração via exportação do controlador', linhaBase: '0%', dataVerificacao: '2026-06-30' },
        ],
      },
      {
        id: 'r-3', identificador: 'R-003',
        acaoProposta: 'Implantar regra de bloqueio automático que impede a liberação operacional de equipamento com ordem aberta em sistema classificado como de segurança.',
        objetivo: 'Impedir a operação com sistema de segurança degradado.',
        hierarquiaControle: 'engenharia',
        justificativaHierarquia: 'Transforma uma expectativa de conduta em impedimento de sistema.',
        alternativasSuperioresAvaliadas: 'Eliminação não aplicável; substituição não aplicável ao mecanismo de liberação.',
        responsavel: 'Manutenção e sistemas', prazo: '2026-06-15',
        riscoResidual: 'Classificação incorreta do sistema no cadastro; mitigado por revisão inicial da lista.',
        status: 'proposta', jaTratadaPorId: null,
        classificacaoIds: ['cl-3', 'cl-6'],
        indicadores: [
          { id: 'i-3', nome: 'Liberações operacionais com ordem de segurança aberta', meta: '0 ocorrências por mês', metodoMedicao: 'Relatório automático do sistema de liberação', linhaBase: 'não medido', dataVerificacao: '2026-08-15' },
        ],
      },
      {
        id: 'r-4', identificador: 'R-004',
        acaoProposta: 'Estabelecer análise obrigatória de recorrência de alarmes de segurança com limiar de acionamento, responsável designado e prazo de tratamento.',
        objetivo: 'Restaurar o mecanismo de detecção organizacional de deriva.',
        hierarquiaControle: 'administrativa',
        justificativaHierarquia: 'O fator é de governança da informação; a mudança sistêmica está em tornar a análise disparada por regra, não por iniciativa individual.',
        alternativasSuperioresAvaliadas: 'Engenharia avaliada: automatizar o disparo da análise no sistema de alarmes foi incorporado ao escopo desta ação como requisito técnico.',
        responsavel: 'Área de melhoria contínua', prazo: '2026-05-15',
        riscoResidual: 'Análise formalizada sem ação decorrente; mitigado pelo indicador de tempo de tratamento.',
        status: 'proposta', jaTratadaPorId: null,
        classificacaoIds: ['cl-5'],
        indicadores: [
          { id: 'i-4', nome: 'Tempo entre atingir o limiar de recorrência e a decisão registrada', meta: '≤ 10 dias em 90% dos casos', metodoMedicao: 'Extração do sistema de gestão de anomalias', linhaBase: 'não medido', dataVerificacao: '2026-09-15' },
        ],
      },
      {
        id: 'r-5', identificador: 'R-005',
        acaoProposta: 'Sinalizar e delimitar fisicamente as vias com restrição de gradiente, com identificação visível a partir da cabine.',
        objetivo: 'Tornar a restrição da via perceptível na condução.',
        hierarquiaControle: 'engenharia',
        justificativaHierarquia: 'Delimitação física atua sobre o ambiente, não sobre a atenção do operador.',
        alternativasSuperioresAvaliadas: 'Eliminação tratada em R-001; esta ação cobre o período até a conclusão do reperfilamento.',
        responsavel: 'Operação de mina', prazo: '2026-04-15',
        riscoResidual: 'Sinalização danificada por tráfego; incluída na inspeção de via.',
        status: 'proposta', jaTratadaPorId: null,
        classificacaoIds: ['cl-8'],
        indicadores: [
          { id: 'i-5', nome: 'Vias com restrição sinalizadas conforme padrão', meta: '100% das vias identificadas na revisão de layout', metodoMedicao: 'Inspeção mensal de via com registro fotográfico', linhaBase: '0%', dataVerificacao: '2026-07-15' },
        ],
      },
    ],

    comentarios: [
      {
        id: 'cm-1', tipo: 'opiniao_divergente',
        texto:
          'O representante de manutenção registra discordância quanto à natureza atribuída a FT-006: entende que a ausência de restrição operacional decorre de regra corporativa e não de decisão local, e solicita que a análise inclua o nível corporativo.',
        resolvido: false,
      },
      { id: 'cm-2', tipo: 'comentario', texto: 'Conflito C-002 deve permanecer aberto até a conclusão da revisão do procedimento.', resolvido: false },
    ],

    aprovacoes: [
      { tipo: 'conclusoes', decisao: 'pendente' },
      { tipo: 'recomendacoes', decisao: 'pendente' },
    ],

    relatorio: null,
  };
}
