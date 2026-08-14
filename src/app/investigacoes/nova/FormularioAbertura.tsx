'use client';

import { useActionState } from 'react';
import {
  NIVEIS_CONFIDENCIALIDADE,
  NIVEIS_INVESTIGACAO,
  NIVEIS_SEVERIDADE,
  PRECISOES_TEMPORAIS,
  ROTULOS_CONFIDENCIALIDADE,
  ROTULOS_NIVEL_INVESTIGACAO,
  ROTULOS_PRECISAO_TEMPORAL,
  ROTULOS_SEVERIDADE,
} from '@/domain/enumeracoes';
import { abrirInvestigacao } from '@/app/acoes/investigacoes';
import { INVESTIGACAO_INICIAL } from '@/app/acoes/estados';
import { Aviso, Cartao } from '@/componentes/ui';

export function FormularioAbertura() {
  const [estado, acao, pendente] = useActionState(abrirInvestigacao, INVESTIGACAO_INICIAL);

  return (
    <form action={acao} className="space-y-6">
      <div aria-live="polite">
        {estado.erro && (
          <Aviso tom="erro" titulo="Não foi possível abrir a investigação">
            {estado.erro}
            {estado.problemas && estado.problemas.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {estado.problemas.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            )}
          </Aviso>
        )}
      </div>

      <Cartao
        titulo="O que aconteceu"
        descricao="É este relato que a IA vai usar para propor cronologia, fatos e classificação. Escreva o que se sabe, sem interpretar causa ainda."
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="titulo" className="rotulo-campo">
              Título do evento
            </label>
            <input
              id="titulo"
              name="titulo"
              required
              minLength={10}
              maxLength={300}
              autoFocus
              placeholder="Tombamento de equipamento móvel em rampa de acesso"
              className="campo"
            />
            <p className="mt-1 text-xs text-texto-fraco">
              Descreva o evento, não a causa. &quot;Falha do operador&quot; é conclusão, não título.
            </p>
          </div>

          <div>
            <label htmlFor="descricaoInicial" className="rotulo-campo">
              Relato inicial
            </label>
            <textarea
              id="descricaoInicial"
              name="descricaoInicial"
              required
              minLength={40}
              rows={10}
              placeholder={
                'Conte o que se sabe até agora: o que estava sendo feito, o que aconteceu, quando, onde, quem estava envolvido, o que foi observado no local e quais registros existem.\n\nQuanto mais concreto o relato, melhor a proposta da IA. Onde não souber, escreva que não se sabe — a lacuna vira diligência.'
              }
              className="campo font-normal"
            />
          </div>
        </div>
      </Cartao>

      <Cartao titulo="Quando e onde" descricao="Deixe em branco o que ainda não estiver confirmado.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="ocorridoEm" className="rotulo-campo">
              Data e hora da ocorrência
            </label>
            <input id="ocorridoEm" name="ocorridoEm" type="datetime-local" className="campo" />
          </div>

          <div>
            <label htmlFor="precisaoOcorrencia" className="rotulo-campo">
              Precisão do horário
            </label>
            <select id="precisaoOcorrencia" name="precisaoOcorrencia" defaultValue="aproximado" className="campo">
              {PRECISOES_TEMPORAIS.map((p) => (
                <option key={p} value={p}>
                  {ROTULOS_PRECISAO_TEMPORAL[p]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="local" className="rotulo-campo">
              Local
            </label>
            <input id="local" name="local" maxLength={300} placeholder="Rampa de acesso ao ponto de basculamento" className="campo" />
          </div>

          <div>
            <label htmlFor="atividade" className="rotulo-campo">
              Atividade em execução
            </label>
            <input id="atividade" name="atividade" maxLength={300} placeholder="Transporte e basculamento de material" className="campo" />
          </div>
        </div>
      </Cartao>

      <Cartao
        titulo="Triagem"
        descricao="Severidade potencial é o que poderia ter acontecido nas mesmas condições — costuma ser maior que a real, e é ela que define a profundidade da investigação."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="severidadeReal" className="rotulo-campo">
              Severidade real
            </label>
            <select id="severidadeReal" name="severidadeReal" defaultValue="nao_classificada" className="campo">
              {NIVEIS_SEVERIDADE.map((s) => (
                <option key={s} value={s}>
                  {ROTULOS_SEVERIDADE[s]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="severidadePotencial" className="rotulo-campo">
              Severidade potencial
            </label>
            <select id="severidadePotencial" name="severidadePotencial" defaultValue="nao_classificada" className="campo">
              {NIVEIS_SEVERIDADE.map((s) => (
                <option key={s} value={s}>
                  {ROTULOS_SEVERIDADE[s]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="nivelInvestigacao" className="rotulo-campo">
              Nível da investigação
            </label>
            <select id="nivelInvestigacao" name="nivelInvestigacao" defaultValue="nao_definido" className="campo">
              {NIVEIS_INVESTIGACAO.map((n) => (
                <option key={n} value={n}>
                  {ROTULOS_NIVEL_INVESTIGACAO[n]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="confidencialidade" className="rotulo-campo">
              Confidencialidade
            </label>
            <select id="confidencialidade" name="confidencialidade" defaultValue="interna" className="campo">
              {NIVEIS_CONFIDENCIALIDADE.map((c) => (
                <option key={c} value={c}>
                  {ROTULOS_CONFIDENCIALIDADE[c]}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-texto-fraco">
              Restrita e confidencial limitam o acesso a quem está na equipe da investigação.
            </p>
          </div>
        </div>
      </Cartao>

      <Cartao titulo="Resposta imediata" descricao="O que já foi feito para conter o evento.">
        <div className="space-y-4">
          <div>
            <label htmlFor="acoesImediatas" className="rotulo-campo">
              Ações imediatas tomadas
            </label>
            <textarea
              id="acoesImediatas"
              name="acoesImediatas"
              rows={3}
              placeholder="Isolamento da área, acionamento da emergência, interdição do equipamento…"
              className="campo"
            />
          </div>

          <label className="flex items-start gap-2 text-sm text-texto">
            <input type="checkbox" name="localPreservado" className="mt-0.5" />
            <span>
              O local foi preservado para a investigação
              <span className="block text-xs text-texto-fraco">
                Local não preservado não invalida a investigação, mas limita o que a evidência
                física pode sustentar — e isso precisa constar do relatório.
              </span>
            </span>
          </label>

          <div>
            <label htmlFor="codigo" className="rotulo-campo">
              Código da investigação (opcional)
            </label>
            <input id="codigo" name="codigo" maxLength={40} placeholder="Gerado automaticamente se ficar em branco" className="campo sm:max-w-xs" />
          </div>
        </div>
      </Cartao>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="botao-primario" disabled={pendente}>
          {pendente ? 'Abrindo…' : 'Abrir investigação'}
        </button>
        <p className="text-xs text-texto-fraco">
          A abertura fica registrada na trilha de auditoria com seu usuário e o horário.
        </p>
      </div>
    </form>
  );
}
