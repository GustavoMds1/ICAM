'use client';

import { useActionState } from 'react';
import {
  decidirClassificacao,
  decidirFato,
  decidirRecomendacao,
} from '@/app/acoes/investigacoes';
import { DECISAO_INICIAL } from '@/app/acoes/estados';
import { NATUREZAS_FATOR, type NaturezaFator } from '@/domain/enumeracoes';
import { Aviso } from './ui';

/**
 * Controles de decisão humana sobre as propostas da IA.
 *
 * Três regras de interface aplicadas aqui:
 *
 *   - aceitar e recusar têm o mesmo peso visual. Botão de aceitar destacado e
 *     recusar apagado empurra para o aceite, que é justamente o viés que uma
 *     ferramenta de investigação não pode ter;
 *   - o motivo da recusa de confirmação aparece inteiro, com a regra que
 *     barrou. "Não foi possível confirmar" sem motivo ensina a contornar, não
 *     a investigar;
 *   - nada é decidido em lote. Cada item exige um clique próprio.
 */

const ROTULOS_NATUREZA: Record<NaturezaFator, string> = {
  fato_constatado: 'Fato constatado — sem juízo causal',
  fator_contribuinte: 'Fator contribuinte',
  causa_sistemica: 'Causa sistêmica',
  oportunidade_melhoria_nao_causal: 'Oportunidade de melhoria, não causal',
  nao_definida: 'Ainda não definida',
};

function Retorno({ estado }: { estado: { erro: string | null; bloqueios?: string[]; mensagem?: string | null } }) {
  return (
    <div aria-live="polite">
      {estado.erro && (
        <Aviso tom="erro" titulo={estado.erro}>
          {estado.bloqueios && estado.bloqueios.length > 0 && (
            <ul className="list-disc space-y-1 pl-5">
              {estado.bloqueios.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}
        </Aviso>
      )}
      {!estado.erro && estado.mensagem && (
        <p className="text-sm text-ok">{estado.mensagem}</p>
      )}
    </div>
  );
}

export function DecisaoFato({
  investigacaoId,
  fatoId,
  aprovado,
  podeDecidir,
}: {
  investigacaoId: string;
  fatoId: string;
  aprovado: boolean;
  podeDecidir: boolean;
}) {
  const [estado, acao, pendente] = useActionState(decidirFato, DECISAO_INICIAL);

  if (!podeDecidir) {
    return (
      <p className="mt-3 text-xs text-texto-fraco">
        Seu papel não permite aprovar fatos. A proposta continua pendente.
      </p>
    );
  }

  if (aprovado) return null;

  return (
    <form action={acao} className="mt-4 space-y-2 border-t border-borda pt-3">
      <input type="hidden" name="investigacaoId" value={investigacaoId} />
      <input type="hidden" name="fatoId" value={fatoId} />
      <Retorno estado={estado} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" name="decisao" value="aceitar" className="botao" disabled={pendente}>
          Aceitar como proposição do dossiê
        </button>
        <button type="submit" name="decisao" value="rejeitar" className="botao" disabled={pendente}>
          Recusar e remover
        </button>
      </div>
      <p className="text-xs text-texto-fraco">
        Recusar remove a proposição daqui. O texto continua na trilha de auditoria, que não pode ser
        alterada nem apagada.
      </p>
    </form>
  );
}

export function DecisaoClassificacao({
  investigacaoId,
  classificacaoId,
  mecanismo,
  natureza,
  justificativaGenerico,
  codigoGenerico,
  decidida,
  podeDecidir,
}: {
  investigacaoId: string;
  classificacaoId: string;
  mecanismo: string | null;
  natureza: NaturezaFator;
  justificativaGenerico: string | null;
  codigoGenerico: boolean;
  decidida: boolean;
  podeDecidir: boolean;
}) {
  const [estado, acao, pendente] = useActionState(decidirClassificacao, DECISAO_INICIAL);

  if (!podeDecidir) {
    return (
      <p className="mt-3 text-xs text-texto-fraco">
        Seu papel não permite confirmar classificação. A proposta continua como candidata.
      </p>
    );
  }

  if (decidida) return null;

  return (
    <form action={acao} className="mt-4 space-y-3 border-t border-borda pt-3">
      <input type="hidden" name="investigacaoId" value={investigacaoId} />
      <input type="hidden" name="classificacaoId" value={classificacaoId} />
      <Retorno estado={estado} />

      <div>
        <label htmlFor={`mecanismo-${classificacaoId}`} className="rotulo-campo">
          Mecanismo — como este fator contribuiu para o evento
        </label>
        <textarea
          id={`mecanismo-${classificacaoId}`}
          name="mecanismo"
          rows={3}
          defaultValue={mecanismo ?? ''}
          className="campo"
        />
        <p className="mt-1 text-xs text-texto-fraco">
          Descreva a cadeia concreta. Semelhança entre o texto do achado e o título do código não
          classifica nada.
        </p>
      </div>

      <div>
        <label htmlFor={`natureza-${classificacaoId}`} className="rotulo-campo">
          Natureza do fator
        </label>
        <select
          id={`natureza-${classificacaoId}`}
          name="natureza"
          defaultValue={natureza}
          className="campo sm:max-w-md"
        >
          {NATUREZAS_FATOR.map((n) => (
            <option key={n} value={n}>
              {ROTULOS_NATUREZA[n]}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-texto-fraco">
          Fator contribuinte e causa sistêmica exigem tratamento por recomendação.
        </p>
      </div>

      {codigoGenerico && (
        <div>
          <label htmlFor={`generico-${classificacaoId}`} className="rotulo-campo">
            Por que nenhum código específico do grupo se aplica
          </label>
          <textarea
            id={`generico-${classificacaoId}`}
            name="justificativaGenerico"
            rows={2}
            defaultValue={justificativaGenerico ?? ''}
            className="campo"
          />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="submit" name="decisao" value="confirmar" className="botao" disabled={pendente}>
          Confirmar classificação
        </button>
        <button type="submit" name="decisao" value="rejeitar" className="botao" disabled={pendente}>
          Rejeitar
        </button>
      </div>
    </form>
  );
}

export function DecisaoRecomendacao({
  investigacaoId,
  recomendacaoId,
  responsavel,
  prazo,
  decidida,
  podeDecidir,
}: {
  investigacaoId: string;
  recomendacaoId: string;
  responsavel: string | null;
  prazo: string | null;
  decidida: boolean;
  podeDecidir: boolean;
}) {
  const [estado, acao, pendente] = useActionState(decidirRecomendacao, DECISAO_INICIAL);

  if (!podeDecidir) {
    return (
      <p className="mt-3 text-xs text-texto-fraco">
        Seu papel não permite aprovar recomendação. A proposta continua no plano como proposta.
      </p>
    );
  }

  if (decidida) return null;

  return (
    <form action={acao} className="mt-4 space-y-3 border-t border-borda pt-3">
      <input type="hidden" name="investigacaoId" value={investigacaoId} />
      <input type="hidden" name="recomendacaoId" value={recomendacaoId} />
      <Retorno estado={estado} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`responsavel-${recomendacaoId}`} className="rotulo-campo">
            Responsável
          </label>
          <input
            id={`responsavel-${recomendacaoId}`}
            name="responsavel"
            defaultValue={responsavel ?? ''}
            placeholder="Função ou nome de quem responde"
            className="campo"
          />
        </div>
        <div>
          <label htmlFor={`prazo-${recomendacaoId}`} className="rotulo-campo">
            Prazo
          </label>
          <input
            id={`prazo-${recomendacaoId}`}
            name="prazo"
            type="date"
            defaultValue={prazo ?? ''}
            className="campo"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="submit" name="decisao" value="aprovar" className="botao" disabled={pendente}>
          Aprovar ação
        </button>
        <button type="submit" name="decisao" value="rejeitar" className="botao" disabled={pendente}>
          Recusar e remover do plano
        </button>
      </div>
    </form>
  );
}
