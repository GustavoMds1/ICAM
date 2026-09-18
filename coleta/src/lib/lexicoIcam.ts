/**
 * Léxico do domínio: termos que apontam um código com pouca ambiguidade.
 *
 * Por que isto existe, se já há casamento por similaridade: o texto de uma
 * constatação de investigação quase nunca repete as palavras do título do
 * código. Ninguém escreve "padrões de turno ruins"; escreve "interjornada
 * menor que a prevista". A similaridade sozinha erra esses casos, que são
 * justamente os mais frequentes.
 *
 * Regras de escrita deste léxico:
 *
 *   - cada entrada é auditável: termo, código e o porquê estão à vista;
 *   - termo genérico demais não entra. "procedimento" aparece em metade das
 *     constatações e não distingue nada;
 *   - código inexistente no catálogo é descartado no carregamento, e há teste
 *     que reprova o arquivo inteiro se alguma entrada apontar para o vazio.
 *
 * Nenhuma entrada decide sozinha: o léxico soma pontos ao score, e a decisão
 * final continua passando pela revisão humana na tela.
 */

export interface RegraLexico {
  /** Expressão procurada no texto já sem acento e em minúsculas. */
  padrao: RegExp;
  codigo: string;
  /** Aparece na tela como motivo da sugestão. */
  motivo: string;
  /** Peso relativo. Acima de 1 para termo praticamente inequívoco. */
  peso?: number;
}

export const LEXICO: RegraLexico[] = [
  // --- Fatores humanos ----------------------------------------------------
  { padrao: /\b(interjornada|intervalo\s+entre\s+jornada|descanso\s+entre\s+jornada|hora\s+extra|jornada\s+excedid|escala\s+de\s+trabalho|turno\s+prolongad)/, codigo: 'HF21', motivo: 'jornada, interjornada ou hora extra', peso: 1.6 },
  { padrao: /\b(fadig|sonol|cansa[çc]|privac[ãa]o\s+de\s+sono|alerta\s+de\s+fadiga)/, codigo: 'HF21', motivo: 'sinal de fadiga ligado a jornada', peso: 1.2 },
  { padrao: /\b(etilo(?:teste|metro)|baf[õo]metro|alco[oó]l|toxicol[óo]gic|drogas?)\b/, codigo: 'HF02', motivo: 'álcool, droga ou teste toxicológico', peso: 1.6 },
  { padrao: /\b(mudan[çc]a\s+de\s+rotina|altera[çc][ãa]o\s+de\s+rotina|fora\s+da\s+rotina|rotina\s+alterad)/, codigo: 'HF24', motivo: 'mudança de rotina', peso: 1.4 },

  // --- Condições da tarefa e do ambiente ----------------------------------
  // "faixa contínua" ficou de fora de propósito: ela aparece quase sempre para
  // descrever a ultrapassagem irregular, que é ação individual (IT11), não
  // condição da via. Aqui ficam só os termos sobre o que a via tinha ou não.
  // Peso alto: "não possuía sinalização vertical" é das descrições menos
  // ambíguas que uma constatação de trânsito produz. Precisa ser alto também
  // para vencer a penalidade de código genérico que TE24 carrega.
  { padrao: /\b(sinaliza[çc][ãa]o\s+vertical|sinaliza[çc][ãa]o\s+horizontal|placa\s+de\s+velocidade|placa\s+no\s+local|sem\s+sinaliza|sinaliza[çc][ãa]o\s+de\s+advert)/, codigo: 'TE24', motivo: 'sinalização viária ausente ou insuficiente', peso: 1.8 },
  { padrao: /\b(chuva|neblina|garoa|piso\s+molhad|visibilidade\s+reduzid|condi[çc][õo]es?\s+clim[áa]tic|tempo\s+chuvos)/, codigo: 'TE10', motivo: 'condição de tempo', peso: 1.5 },

  // --- Ações individuais e de equipe --------------------------------------
  { padrao: /\b(ultrapass|convers[ãa]o\s+proibid|excesso\s+de\s+velocidade|velocidade\s+acima|manobra\s+irregular)/, codigo: 'IT11', motivo: 'decisão de risco na condução', peso: 1.3 },
  // "em desacordo com o procedimento" mudou de IT11 para cá depois da
  // medição: descumprir o procedimento é conformidade processual, e deixar a
  // expressão nos dois lugares fazia os dois códigos empatarem.
  { padrao: /\b(n[ãa]o\s+interromp|prosseguiu|seguiu\s+viagem|deixou\s+de\s+(?:comunicar|reportar|parar)|descumpr(?:iu|imento)\s+do\s+procedimento|em\s+desacordo\s+com\s+o\s+procedimento)/, codigo: 'IT06', motivo: 'desvio de conformidade processual', peso: 1.3 },
  { padrao: /\b(epi|equipamento\s+de\s+prote[çc][ãa]o|cinto\s+de\s+seguran[çc]a|capacete|[óo]culos\s+de\s+prote)/, codigo: 'IT05', motivo: 'uso de EPI', peso: 1.5 },

  // --- Defesas ausentes ou falhas -----------------------------------------
  // "treinad" entra ao lado de "treinamento": o texto de investigação diz
  // "não foi apresentada a evidência de que o colaborador foi treinado", e
  // procurar só pelo substantivo perderia exatamente essa frase.
  { padrao: /\b(treinament|treinad|capacita[çc]|retreinament|habilita[çc][ãa]o\s+n[ãa]o|sem\s+evid[êe]ncia\s+de\s+treinament|competenc)/, codigo: 'DF03', motivo: 'competência ou treinamento não evidenciado', peso: 1.4 },
  { padrao: /\b(dss|di[áa]logo\w*\s+di[áa]ri\w*|fica\s+a?\s*dica|campanha\s+de\s+preven|palestra|supervis[ãa]o)/, codigo: 'DF04', motivo: 'supervisão e conscientização', peso: 1.2 },
  // Regra separada, e não mais uma alternativa da de cima, porque cada regra
  // pontua uma vez só. Quando o texto traz o meio (DSS) E a falha (alguém
  // ficou de fora), são duas evidências e devem somar como duas.
  { padrao: /\bn[ãa]o\s+participou|n[ãa]o\s+(?:foi\s+)?(?:abrangid|alcanc|contemplad)/, codigo: 'DF04', motivo: 'o destinatário ficou fora da ação de conscientização', peso: 1.3 },
  // O texto real escreve "simulado de ocorrência de emergência": entre as duas
  // palavras cabe qualquer coisa, então a distância é que vale, não a colagem.
  { padrao: /\bsimulad\w*[^.]{0,40}emerg|plano\s+de\s+emerg|rota\s+de\s+fuga|\bpae\b|resgate|abandono/, codigo: 'DF19', motivo: 'preparo e simulado de emergência', peso: 1.5 },
  // "percepção de risco" saiu: é nome de treinamento e de tema de DSS, e
  // aparecia como assunto da evidência, não como o achado.
  { padrao: /\b(an[áa]lise\s+de\s+risco|apr\b|take\s*5|pare\s+e\s+pense|identifica[çc][ãa]o\s+de\s+perigo)/, codigo: 'DF01', motivo: 'identificação de perigo antes da tarefa', peso: 1.3 },

  // Aqui havia uma regra ligando "check list" e "inspeção" a DF11. Ela foi
  // removida depois da primeira medição contra o gabarito: era responsável
  // por TODOS os três erros de confiança alta.
  //
  // O motivo é instrutivo. Constatação de investigação cita o check list como
  // a FONTE do achado — "no check list consta que o motorista pegou o veículo
  // às 05:30" —, não como o assunto dele. A regra lia a fonte e respondia com
  // convicção sobre o tema errado. Termo que aparece em metade das
  // constatações não distingue nada, e com peso alto vira erro confiante,
  // que é o pior tipo.

  // --- Fatores organizacionais --------------------------------------------
  { padrao: /\b(manuten[çc][ãa]o|ordem\s+de\s+servi[çc]o|preventiv|corretiv|oficina|plano\s+de\s+manuten)/, codigo: 'MM', motivo: 'gestão de manutenção', peso: 1.4 },
  { padrao: /\b(procedimento\s+(?:n[ãa]o|inexistente|desatualizad|omisso)|pro\s*\d|pgs\s*\d|instru[çc][ãa]o\s+de\s+trabalho)/, codigo: 'PR', motivo: 'procedimento ausente, omisso ou desatualizado', peso: 1.3 },
  { padrao: /\b(comunica[çc][ãa]o|n[ãa]o\s+foi\s+(?:descrit|comunicad|informad)|registro\s+em\s+(?:parte\s+di[áa]ria|livro)|repasse\s+de\s+informa)/, codigo: 'CO', motivo: 'falha de comunicação ou registro', peso: 1.2 },
  { padrao: /\b(gest[ãa]o\s+de\s+mudan[çc]|mudan[çc]a\s+n[ãa]o\s+(?:avaliad|analisad)|altera[çc][ãa]o\s+de\s+par[âa]metro|sem\s+gest[ãa]o\s+de\s+mudan)/, codigo: 'MC', motivo: 'mudança sem gestão formal', peso: 1.5 },
  { padrao: /\b(evento\s+anterior|hist[óo]rico\s+de\s+(?:evento|ocorr)|li[çc][õo]es\s+aprendid|recorr[êe]ncia|reincid)/, codigo: 'OL', motivo: 'aprendizado organizacional', peso: 1.4 },
  { padrao: /\b(escala\s+(?:mensal|de\s+folguista)|planejamento\s+log[íi]stic|dimensionamento\s+de\s+equipe|gest[ãa]o\s+da\s+frota)/, codigo: 'VW', motivo: 'gestão de frota e escala', peso: 1.2 },
  { padrao: /\b(gin[áa]stica\s+laboral|ergonom|pausa\s+peri[óo]dica|sa[úu]de\s+ocupacional|pgr\b|aso\b)/, codigo: 'MS', motivo: 'programa de gestão de saúde e segurança', peso: 1.2 },
  // Registro que deveria existir e não existe.
  //
  // Esta regra veio de olhar o gabarito, e por isso merece desconfiança: a
  // equipe usou MS como caixa-de-tudo para lacuna de registro. Mas a leitura
  // se sustenta pela metodologia, não só pelo gabarito — documento de controle
  // sem o dado que deveria conter é falha do sistema de gestão que o mantém.
  // Peso baixo de propósito, e vale reconferir num segundo evento antes de
  // tratá-la como certa.
  // A distância entre "não existe" e "o dado" precisa ser folgada: o texto
  // real escreve "não existe NO CHECK LIST o dado de quem estava na
  // condução", e exigir as palavras coladas perdia exatamente essa frase.
  { padrao: /\bn[ãa]o\s+consta|n[ãa]o\s+existe[^.]{0,30}(?:dado|registro|informa)|sem\s+registro\s+de|diverg[êe]ncia\s+entre\s+(?:os\s+)?registro/, codigo: 'MS', motivo: 'registro do sistema de gestão ausente ou inconsistente', peso: 1.1 },
  { padrao: /\b(matriz\s+de\s+risco|gerenciamento\s+de\s+risco|risco\s+n[ãa]o\s+(?:avaliad|mapead)|invent[áa]rio\s+de\s+risco)/, codigo: 'RM', motivo: 'gestão de riscos', peso: 1.3 },
  { padrao: /\b(cnh|habilita[çc][ãa]o|certifica[çc][ãa]o\s+(?:estadual|atran)|licen[çc]a\s+(?:do\s+)?ve[íi]culo|documenta[çc][ãa]o\s+do\s+ve[íi]culo)/, codigo: 'RI', motivo: 'exigência legal ou regulatória', peso: 1.2 },
  { padrao: /\b(empreiteir|contratad|terceiriz|presta[çc][ãa]o\s+de\s+servi[çc]o\s+de\s+terceiro)/, codigo: 'CM', motivo: 'gestão de contratada', peso: 1.4 },
  { padrao: /\b(meta\s+de\s+produ|press[ãa]o\s+por\s+(?:produ|prazo)|conflito\s+entre\s+seguran[çc]a\s+e\s+produ)/, codigo: 'IG', motivo: 'metas incompatíveis com segurança', peso: 1.5 },
  { padrao: /\b(projeto\s+(?:do\s+)?(?:equipamento|via|layout)|ergonomia\s+do\s+posto|concep[çc][ãa]o\s+do\s+sistema)/, codigo: 'DE', motivo: 'design do sistema', peso: 1.3 },
];

/** Entradas cujo código não existe no catálogo são descartadas no uso. */
export function lexicoValido(existe: (codigo: string) => boolean): RegraLexico[] {
  return LEXICO.filter((r) => existe(r.codigo));
}

export function lexicoInvalido(existe: (codigo: string) => boolean): string[] {
  return LEXICO.filter((r) => !existe(r.codigo)).map((r) => r.codigo);
}
