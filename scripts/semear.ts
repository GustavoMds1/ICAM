/**
 * Prepara o banco: aplica migrações, cria a organização, cria os usuários
 * iniciais e opcionalmente semeia o caso anonimizado de demonstração.
 *
 * Os dados do caso são fictícios. Nunca use dados fictícios para preencher uma
 * investigação real (restrição 16 do escopo): o caso semeado fica marcado como
 * demonstração na trilha de auditoria.
 *
 * Uso:
 *   npm run db:seed                      # migrações + admin + caso de demonstração
 *   npm run db:seed -- --sem-demonstracao  # apenas migrações e usuário administrador
 */
import { abrirBanco, aplicarMigracoes } from '../src/servidor/bd';
import { RepositorioPostgres } from '../src/servidor/repositorioPostgres';
import { ServicoAutenticacao } from '../src/servidor/autenticacao';
import { PAPEIS_GLOBAIS, type PapelGlobal } from '../src/domain/enumeracoes';
import { criarCasoAnonimizado, ORGANIZACAO_FIXTURE } from '../src/fixtures/casoAnonimizado';
import { conferirCatalogo } from '../src/domain/taxonomia/catalogo';
import { verificarQualidade } from '../src/domain/qualidade/verificar';
import { gerarSenhaInicial } from '../src/seguranca/senha';

async function principal(): Promise<void> {
  const semDemonstracao = process.argv.includes('--sem-demonstracao');
  const bd = await abrirBanco();

  console.log(`Motor do banco: ${bd.motor}`);
  if (bd.motor === 'pglite') {
    console.log(
      'Aviso: sem DATABASE_URL definido, os dados ficam em PGlite local. Para produção, defina DATABASE_URL.',
    );
  }

  const migracoes = await aplicarMigracoes(bd);
  console.log(
    migracoes.aplicadas.length > 0
      ? `Migrações aplicadas: ${migracoes.aplicadas.join(', ')}`
      : 'Migrações já estavam aplicadas.',
  );

  // --- Organização -------------------------------------------------------
  const organizacaoId = process.env.ORGANIZACAO_ID ?? ORGANIZACAO_FIXTURE;
  const organizacaoNome = process.env.ORGANIZACAO_NOME ?? 'Organização de demonstração';
  await bd.consultar(
    `INSERT INTO organizacoes (id, nome) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING`,
    [organizacaoId, organizacaoNome],
  );

  // --- Usuário administrador --------------------------------------------
  const auth = new ServicoAutenticacao(bd);
  const emailAdmin = process.env.ADMIN_EMAIL ?? 'admin@exemplo.com';
  const senhaInformada = process.env.ADMIN_SENHA;
  const senhaAdmin = senhaInformada ?? gerarSenhaInicial();

  const criacao = await auth.criarUsuario({
    organizacaoId,
    nome: process.env.ADMIN_NOME ?? 'Administrador da plataforma',
    email: emailAdmin,
    senha: senhaAdmin,
    papelGlobal: 'administrador',
    podeVerCamposSensiveis: true,
  });

  if (criacao.ok) {
    console.log('\n--- Usuário administrador criado ---');
    console.log(`  E-mail: ${emailAdmin}`);
    if (senhaInformada) {
      console.log('  Senha:  a definida em ADMIN_SENHA');
    } else {
      console.log(`  Senha:  ${senhaAdmin}`);
      console.log('  Anote agora: esta senha não será exibida de novo.');
    }
    console.log('  A troca de senha é obrigatória no primeiro acesso.');
  } else {
    console.log(`\nUsuário administrador não criado: ${criacao.problemas.join(' ')}`);
  }

  // --- Equipe ------------------------------------------------------------
  // Hospedagem sem terminal (plano gratuito do Render, por exemplo) não
  // permite rodar comando para abrir conta. A equipe vem de USUARIOS_INICIAIS,
  // uma pessoa por linha:
  //
  //   maria@empresa.com | Maria Silva | investigador
  //   joao@empresa.com  | João Souza  | aprovador | sensivel
  //
  // Papel é opcional (padrão investigador). `sensivel` só para quem precisa
  // ver nome, matrícula e dados de saúde. Rodar de novo não duplica ninguém.
  const listaEquipe = (process.env.USUARIOS_INICIAIS ?? '').trim();
  if (listaEquipe) {
    console.log('\n--- Equipe ---');
    let criados = 0;

    for (const linha of listaEquipe.split(/[\n;]+/)) {
      const bruto = linha.trim();
      if (!bruto || bruto.startsWith('#')) continue;

      const [email, nome, papel, marcador] = bruto.split('|').map((p) => p.trim());
      if (!email || !nome) {
        console.log(`  ignorado (falta e-mail ou nome): ${bruto}`);
        continue;
      }

      const papelEscolhido = (papel || 'investigador') as PapelGlobal;
      if (!PAPEIS_GLOBAIS.includes(papelEscolhido)) {
        console.log(
          `  ignorado (papel "${papel}" não existe): ${email}` +
            `\n      papéis válidos: ${PAPEIS_GLOBAIS.join(', ')}`,
        );
        continue;
      }

      const senha = gerarSenhaInicial();
      const resultado = await auth.criarUsuario({
        organizacaoId,
        nome,
        email,
        senha,
        papelGlobal: papelEscolhido,
        podeVerCamposSensiveis: (marcador ?? '').toLowerCase() === 'sensivel',
      });

      if (resultado.ok) {
        criados += 1;
        console.log(`  criado: ${email} (${papelEscolhido}) — senha provisória: ${senha}`);
      } else {
        console.log(`  ${email}: ${resultado.problemas.join(' ')}`);
      }
    }

    if (criados > 0) {
      console.log(
        '\n  Entregue cada senha por canal separado (pessoalmente ou por telefone),\n' +
          '  nunca no mesmo e-mail que leva o endereço da plataforma.\n' +
          '  A troca de senha é obrigatória no primeiro acesso.',
      );
    }
  }

  // --- Caso de demonstração ---------------------------------------------
  if (!semDemonstracao) {
    const repo = new RepositorioPostgres(bd);
    const caso = criarCasoAnonimizado();
    caso.metadados.organizacaoId = organizacaoId;

    const existente = await repo.obterInvestigacao(organizacaoId, caso.investigacaoId);
    if (existente) {
      console.log(`\nCaso de demonstração já presente: ${caso.codigo}`);
    } else {
      await repo.salvarInvestigacao(caso);
      await repo.registrarAuditoria({
        organizacaoId,
        usuarioId: criacao.ok ? criacao.id : null,
        atorTipo: 'sistema',
        acao: 'criar',
        entidadeTipo: 'investigacao',
        entidadeId: caso.investigacaoId,
        investigacaoId: caso.investigacaoId,
        depois: { codigo: caso.codigo, titulo: caso.titulo, origem: 'seed_demonstracao' },
      });
      console.log(`\nCaso de demonstração carregado: ${caso.codigo} — ${caso.titulo}`);

      const qualidade = verificarQualidade(caso);
      console.log(
        `  Verificadores: ${qualidade.bloqueios} bloqueio(s), ${qualidade.alertas} alerta(s) — publicação liberada: ${qualidade.podePublicar}`,
      );
      console.log('  (os avisos são intencionais: o caso exercita os verificadores)');
    }
  }

  // --- Catálogo ----------------------------------------------------------
  const catalogo = conferirCatalogo();
  console.log(`\nCatálogo ICAM: ${catalogo.total}/${catalogo.totalEsperado} — conforme: ${catalogo.conforme}`);
  console.log(`  com definição importada: ${catalogo.total - catalogo.semDefinicao}`);
  console.log(`  sem definição: ${catalogo.semDefinicao}`);
  for (const g of catalogo.porGrupo) {
    console.log(`  ${g.grupo}: ${g.encontrado}/${g.esperado}`);
  }

  await bd.encerrar();
}

principal().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
