'use client';

import { useActionState } from 'react';
import { gerarRascunho } from '@/app/acoes/investigacoes';
import { RASCUNHO_INICIAL } from '@/app/acoes/estados';
import { Aviso, Selo } from './ui';

/**
 * Disparo do rascunho assistido.
 *
 * O texto do painel é deliberadamente explícito sobre três coisas: o que a IA
 * vai fazer, para onde o conteúdo vai, e que nada entra aprovado. Quem clica
 * precisa saber que, em provedor externo, o relato do incidente sai do
 * ambiente — essa informação não pode estar só na documentação.
 */
export function PainelRascunho({
  investigacaoId,
  provedor,
  modelo,
  enviaParaFora,
  podeExecutar,
  jaTemPropostas,
}: {
  investigacaoId: string;
  provedor: string;
  modelo: string;
  enviaParaFora: boolean;
  podeExecutar: boolean;
  jaTemPropostas: boolean;
}) {
  const [estado, acao, pendente] = useActionState(gerarRascunho, RASCUNHO_INICIAL);

  const resumo = estado.resumo;

  return (
    <form action={acao} className="space-y-4">
      <input type="hidden" name="investigacaoId" value={investigacaoId} />

      <div className="flex flex-wrap items-center gap-2">
        <Selo tom="ia">{provedor}</Selo>
        <span className="text-xs text-texto-fraco">modelo {modelo}</span>
        {enviaParaFora ? (
          <Selo tom="alerta">o conteúdo sai do ambiente</Selo>
        ) : (
          <Selo tom="ok">nada sai do ambiente</Selo>
        )}
      </div>

      <div aria-live="polite" className="space-y-3">
        {estado.erro && <Aviso tom="erro" titulo="O rascunho não foi gerado">{estado.erro}</Aviso>}

        {resumo && (
          <Aviso tom="ia" titulo="Rascunho gerado. Nada foi aprovado.">
            <ul className="mt-1 space-y-0.5">
              <li>{resumo.fatos} proposição(ões) de fato aguardando decisão</li>
              <li>{resumo.eventos} evento(s) na cronologia</li>
              <li>{resumo.classificacoes} classificação(ões) ICAM candidata(s)</li>
              <li>{resumo.relacoes} relação(ões) causal(is) propostas</li>
              <li>{resumo.recomendacoes} recomendação(ões) no plano, como proposta</li>
              <li>{resumo.diligencias} pergunta(s) de coleta PEEPO</li>
              <li>{resumo.lacunas} lacuna(s) registrada(s)</li>
            </ul>
            <p className="mt-2">
              Percorra as abas Fatos, Cronologia, ICAM e Recomendações para aceitar, editar ou
              recusar item a item.
            </p>
          </Aviso>
        )}

        {estado.avisos.length > 0 && (
          <Aviso tom="alerta" titulo="Observações da execução">
            <ul className="list-disc space-y-1 pl-5">
              {estado.avisos.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </Aviso>
        )}
      </div>

      {podeExecutar ? (
        <div className="space-y-2">
          <button type="submit" className="botao-primario" disabled={pendente}>
            {pendente
              ? 'Analisando o relato…'
              : jaTemPropostas
                ? 'Gerar rascunho de novo'
                : 'Gerar rascunho a partir do relato'}
          </button>
          <p className="text-xs text-texto-fraco">
            {jaTemPropostas
              ? 'Rodar de novo só acrescenta o que ainda não existe. Nada que você já decidiu é alterado.'
              : 'A IA propõe; você decide. Cada item entra como pendente e exige aceite explícito.'}
          </p>
        </div>
      ) : (
        <p className="text-sm text-texto-sutil">
          Seu papel não permite executar a IA nesta investigação.
        </p>
      )}
    </form>
  );
}
