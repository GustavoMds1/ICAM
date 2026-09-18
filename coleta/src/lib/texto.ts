/**
 * Processamento de texto em português para a associação local de códigos.
 *
 * Nada aqui é sofisticado, e é de propósito: o objetivo é casar constatação de
 * investigação com título e definição de código ICAM, num corpus de 101
 * documentos curtos. Radicalização agressiva demais junta "condução" com
 * "conduta"; leve demais separa "sinalização" de "sinalizar". O meio-termo
 * abaixo foi escolhido para esse corpus, não para português em geral.
 */

/**
 * Palavras sem poder de discriminação neste domínio.
 *
 * A lista é escrita com acento, por legibilidade, mas guardada sem — a
 * comparação acontece depois da normalização. Sem esse passo, "após" na lista
 * nunca casaria com "apos" no texto, e metade das palavras vazias passaria
 * direto para a pontuação.
 */
const VAZIAS_COM_ACENTO = [
  'a','ao','aos','as','à','às','com','como','da','das','de','do','dos','e','em','entre','era','essa',
  'esse','esta','este','eu','foi','for','foram','há','isso','já','lhe','mais','mas','me','mesmo','meu',
  'muito','na','nas','no','nos','nossa','nosso','num','numa','o','os','ou','para','pela','pelas','pelo',
  'pelos','por','qual','quando','que','quem','se','sem','ser','seu','seus','só','sua','suas','também',
  'te','tem','tendo','ter','teu','um','uma','umas','uns','vez','você','ainda','apenas','após','antes',
  'durante','onde','sobre','porém','entretanto','contudo','todavia','sendo','dia','dias','data','ano',
  'conforme','acordo','referente','mesma','mesmas','mesmos','outro','outra','outros','outras','qualquer',
  'algum','alguma','alguns','algumas','cada','todo','toda','todos','todas','pode','podem','deve','devem',
  'está','estão','estava','estavam','sido','houve','haja','fica','ficou','faz','feito','feita','realizado',
  'realizada','identificado','identificada','informado','informada','apresentado','apresentada','verificado',
];

/** Marcas de ausência: mudam o sentido do achado e valem sinal próprio. */
const AUSENCIA = [
  /\bn[ãa]o\s+(?:existe|h[áa]|foi|est[áa]|consta|possui|disp[õo]e|apresent|realiz|evidenc|atend|cumpr|dispunha|tinha|havia|tem)/i,
  /\b(?:aus[êe]ncia|falta|inexist[êe]ncia|caren[çc]ia|sem\s+(?:registro|evid[êe]ncia|procedimento|sinaliza|treinamento|controle|barreira|placa))/i,
  /\bn[ãa]o\s+\w+ad[oa]s?\b/i,
];

export function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function normalizar(texto: string): string {
  return semAcento(texto).toLowerCase();
}

const VAZIAS = new Set(VAZIAS_COM_ACENTO.map((p) => normalizar(p)));

const CORTES: [RegExp, string][] = [
  [/oes$/, 'ao'],
  [/aes$/, 'ao'],
  [/ns$/, 'm'],
  [/mente$/, ''],
  [/(?:cao|coes)$/, 'c'],
  [/(?:mento|mentos)$/, ''],
  [/(?:ando|endo|indo)$/, ''],
  [/(?:ada|ado|adas|ados)$/, ''],
  [/(?:ida|ido|idas|idos)$/, ''],
  [/(?:avel|ivel|aveis|iveis)$/, ''],
  [/(?:ancia|encia)$/, ''],
  [/(?:idade|idades)$/, ''],
  [/(?:izar|izacao)$/, ''],
  [/(?:oso|osa|osos|osas)$/, ''],
  [/(?:ar|er|ir)$/, ''],
  [/s$/, ''],
];

/**
 * Radical aproximado.
 *
 * Duas passagens, e não uma: "sinalizacoes" precisa virar "sinalizacao" no
 * plural e só então perder o sufixo. Com uma passagem só, plural e singular da
 * mesma palavra terminariam em radicais diferentes — que é o oposto do que
 * este arquivo existe para fazer.
 *
 * Só corta quando sobram ao menos quatro caracteres: sem essa trava, "via"
 * viraria "v" e passaria a casar com meio catálogo.
 */
export function radical(palavra: string): string {
  let p = palavra;

  for (let passagem = 0; passagem < 2; passagem += 1) {
    const antes = p;
    for (const [padrao, troca] of CORTES) {
      if (!padrao.test(p)) continue;
      const tentativa = p.replace(padrao, troca);
      if (tentativa.length >= 4) {
        p = tentativa;
        break;
      }
    }
    if (p === antes) break;
  }

  return p;
}

export function tokens(texto: string): string[] {
  return normalizar(texto)
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length > 2 && !VAZIAS.has(p) && !/^\d+$/.test(p));
}

export function radicais(texto: string): string[] {
  return tokens(texto).map(radical);
}

/** Pares de radicais vizinhos. "hora extra" discrimina muito mais que "hora". */
export function bigramas(texto: string): string[] {
  const t = radicais(texto);
  const pares: string[] = [];
  for (let i = 0; i < t.length - 1; i += 1) pares.push(`${t[i]} ${t[i + 1]}`);
  return pares;
}

/** O achado aponta algo que faltava? É o padrão mais comum em investigação. */
export function indicaAusencia(texto: string): boolean {
  return AUSENCIA.some((p) => p.test(semAcento(texto)) || p.test(texto));
}

export function contar(lista: string[]): Map<string, number> {
  const mapa = new Map<string, number>();
  for (const item of lista) mapa.set(item, (mapa.get(item) ?? 0) + 1);
  return mapa;
}
