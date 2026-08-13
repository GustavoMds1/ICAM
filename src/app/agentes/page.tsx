import { listarAgentes } from '@/agentes';
import { avaliarConfiguracaoIa, lerConfiguracaoIa } from '@/agentes/provedor';
import { FERRAMENTAS_PERMITIDAS } from '@/seguranca/injecao';
import { Aviso, Cartao, Selo, Tabela } from '@/componentes/ui';

export const dynamic = 'force-dynamic';

export default async function PaginaAgentes() {
  const config = lerConfiguracaoIa();
  const avisos = avaliarConfiguracaoIa(config);
  const agentes = listarAgentes();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Governança de IA</h1>
        <p className="mt-1 text-sm text-texto-sutil">
          O agente é um fluxo auditável de etapas com contrato de saída, não uma resposta livre.
        </p>
      </div>

      {avisos.map((a) => (
        <Aviso key={a.mensagem} tom={a.nivel === 'erro' ? 'erro' : a.nivel === 'alerta' ? 'alerta' : 'ia'} titulo={
          a.nivel === 'erro' ? 'Configuração bloqueada' : a.nivel === 'alerta' ? 'Atenção' : 'Modo de operação'
        }>
          {a.mensagem}
        </Aviso>
      ))}

      <Cartao titulo="Configuração atual">
        <Tabela legenda="Configuração do provedor de IA" cabecalho={['Parâmetro', 'Valor']}>
          <tr><td>Provedor</td><td><Selo tom={config.provedor === 'deterministico' ? 'ok' : 'alerta'}>{config.provedor}</Selo></td></tr>
          <tr><td>Modelo</td><td className="font-mono text-xs">{config.provedor === 'deterministico' ? '—' : config.modelo}</td></tr>
          <tr><td>Envio externo autorizado</td><td>{config.politica.envioExternoAutorizado ? <Selo tom="alerta">sim</Selo> : <Selo tom="ok">não</Selo>}</td></tr>
          <tr><td>Residência de dados</td><td>{config.politica.residenciaDados}</td></tr>
          <tr><td>Política de não treinamento</td><td>{config.politica.politicaNaoTreinamento}</td></tr>
        </Tabela>
      </Cartao>

      <Cartao titulo="Agentes implementados" descricao="Cada etapa tem contrato próprio e allowlist de ferramentas.">
        <Tabela legenda="Agentes" cabecalho={['#', 'Agente', 'Responsabilidade', 'Ferramentas permitidas']}>
          {agentes.map((a, n) => (
            <tr key={a.nome}>
              <td className="tabular-nums">{n + 1}</td>
              <td className="font-medium">{a.rotulo}</td>
              <td className="max-w-md text-xs">{a.instrucaoResumida}</td>
              <td className="font-mono text-xs">{(FERRAMENTAS_PERMITIDAS[a.nome] ?? []).join(', ')}</td>
            </tr>
          ))}
        </Tabela>
      </Cartao>

      <Cartao titulo="Contrato de saída obrigatório" descricao="Toda resposta analítica obedece a esta estrutura; saída fora do contrato é descartada, não corrigida.">
        <pre className="overflow-auto rounded bg-superficie-forte p-4 text-xs">{`{
  "resposta": "...",
  "tipo": "fato|declaracao|inferencia|hipotese|conflito|lacuna",
  "evidencias_favoraveis": [],
  "evidencias_contrarias": [],
  "citacoes": [],
  "premissas": [],
  "confianca": "baixa|media|alta",
  "limitacoes": [],
  "proximas_diligencias": [],
  "requer_validacao_humana": true
}`}</pre>
      </Cartao>

      <Cartao titulo="Defesa contra prompt injection">
        <ul className="list-disc space-y-1 pl-5 text-sm text-texto-sutil">
          <li>Conteúdo importado é envelopado como dado, com delimitador imprevisível que o próprio conteúdo não consegue fechar.</li>
          <li>Padrões de instrução, exfiltração, mudança de papel e caracteres invisíveis são detectados e registrados na evidência.</li>
          <li>Ferramentas seguem allowlist por agente; qualquer chamada fora da lista é recusada e auditada.</li>
          <li>A saída é validada contra o contrato Zod antes de tocar o banco.</li>
        </ul>
      </Cartao>
    </div>
  );
}
