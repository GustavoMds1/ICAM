<#
    Publica o projeto ICAM no GitHub.

    Uso normal: de duplo clique em PUBLICAR-NO-GITHUB.bat, que chama este script.

    Uso manual, no PowerShell:
        cd "C:\Users\gusta\OneDrive\Documentos\ICAM"
        .\publicar-no-github.ps1 -Usuario SEU-USUARIO-GITHUB

    Pode ser executado quantas vezes for preciso. Nada e enviado se a
    conferencia de seguranca encontrar segredo ou dado local versionado.
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$Usuario,

    [string]$Repositorio = 'ICAM',

    # Privado por padrao. Mesmo sem dados reais, o codigo contem a estrutura de
    # seguranca da plataforma.
    [ValidateSet('private', 'public')]
    [string]$Visibilidade = 'private',

    [string]$Email = 'gustavomendesh@gmail.com',
    [string]$Nome  = 'Gustavo',

    # Pula a etapa de abrir o navegador para criar o repositorio.
    [switch]$RepositorioJaExiste
)

# O git escreve em stderr durante operacoes normais (progresso do push, por
# exemplo). Isso nao pode virar excecao, ou o script aborta sem motivo.
# O controle de falha e feito conferindo o codigo de saida de cada comando.
$ErrorActionPreference = 'Continue'

function Passo($texto) { Write-Host "`n==> $texto" -ForegroundColor Cyan }
function Ok($texto)    { Write-Host "    OK  $texto" -ForegroundColor Green }
function Aviso($texto) { Write-Host "    !   $texto" -ForegroundColor Yellow }
function Erro($texto)  { Write-Host "    X   $texto" -ForegroundColor Red }

Set-Location -LiteralPath $PSScriptRoot

Write-Host ''
Write-Host "    Projeto      : Plataforma de investigacao ICAM"
Write-Host "    Repositorio  : $Usuario/$Repositorio ($Visibilidade)"
Write-Host "    Pasta        : $PSScriptRoot"

# ---------------------------------------------------------------------------
Passo 'Verificando o git'
# ---------------------------------------------------------------------------
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Erro 'git nao encontrado neste computador.'
    Write-Host '        Instale em https://git-scm.com/download/win, aceitando as opcoes padrao.' -ForegroundColor Gray
    Write-Host '        Depois FECHE esta janela e execute o arquivo de novo.' -ForegroundColor Gray
    exit 1
}
Ok (git --version)

# ---------------------------------------------------------------------------
Passo 'Liberando trava remanescente'
# ---------------------------------------------------------------------------
if (Test-Path '.git\index.lock') {
    Remove-Item '.git\index.lock' -Force
    Ok 'index.lock removido'
} else {
    Ok 'nenhuma trava pendente'
}

# ---------------------------------------------------------------------------
Passo 'Preparando o repositorio local'
# ---------------------------------------------------------------------------
if (-not (Test-Path '.git')) {
    git init -q
    git symbolic-ref HEAD refs/heads/main
    Ok 'repositorio inicializado'
} else {
    Ok 'repositorio ja existente'
}

git config user.name  $Nome
git config user.email $Email

git add -A
if ($LASTEXITCODE -ne 0) {
    Erro 'nao foi possivel preparar os arquivos (git add falhou).'
    exit 1
}
Ok 'arquivos preparados'

# ---------------------------------------------------------------------------
Passo 'CONFERENCIA DE SEGURANCA'
# ---------------------------------------------------------------------------
# Nenhum envio acontece se esta etapa falhar.
$versionados = @(git ls-files)
if ($versionados.Count -eq 0) {
    Erro 'nenhum arquivo versionado. Confira se a pasta esta correta.'
    exit 1
}

$proibidos = @($versionados | Where-Object {
    $_ -eq '.env' -or
    $_ -like '.env.local*' -or
    $_ -like '.env.*.local' -or
    $_ -like 'node_modules/*' -or
    $_ -like '.next/*' -or
    $_ -like 'armazenamento/*' -or
    $_ -like 'dados-locais/*' -or
    $_ -like '*.db'
})

if ($proibidos.Count -gt 0) {
    Erro 'Arquivos que NAO podem ser publicados foram encontrados:'
    $proibidos | ForEach-Object { Write-Host "        $_" -ForegroundColor Red }
    Erro 'Publicacao abortada. Remova-os com: git rm --cached <arquivo>'
    exit 1
}
Ok "$($versionados.Count) arquivos versionados, nenhum segredo nem dado local"

# Varredura do CONTEUDO dos arquivos. Os trechos do padrao sao montados em
# tempo de execucao para que este proprio script nao seja apontado como
# suspeito ao procurar por ele mesmo.
$fragmentos = @(
    ('sk' + '-ant-api'),
    ('gh' + 'p_[A-Za-z0-9]{20,}'),
    ('github' + '_pat_[A-Za-z0-9_]{20,}'),
    'AKIA[0-9A-Z]{16}',
    'BEGIN [A-Z ]*PRIVATE KEY',
    ('xox' + '[baprs]-[A-Za-z0-9-]{10,}')
)
$padrao = $fragmentos -join '|'

$aVarrer = @($versionados | Where-Object {
    $_ -ne 'package-lock.json' -and
    $_ -ne 'publicar-no-github.ps1' -and
    (Test-Path -LiteralPath $_)
})

# Atencao: passar os caminhos por -LiteralPath faz o Select-String ler o
# CONTEUDO de cada arquivo. Se a lista fosse enviada pelo pipe, ele procuraria
# apenas dentro dos nomes dos arquivos, e a conferencia nao valeria nada.
$suspeitos = @(Select-String -LiteralPath $aVarrer -Pattern $padrao -List -ErrorAction SilentlyContinue)

if ($suspeitos.Count -gt 0) {
    Erro 'Possiveis credenciais encontradas no conteudo dos arquivos:'
    $suspeitos | ForEach-Object { Write-Host "        $($_.Path):$($_.LineNumber)" -ForegroundColor Red }
    Erro 'Publicacao abortada. Remova as credenciais antes de continuar.'
    exit 1
}
Ok "conteudo de $($aVarrer.Count) arquivos conferido, nenhuma credencial"

# ---------------------------------------------------------------------------
Passo 'Registrando a versao'
# ---------------------------------------------------------------------------
$pendentes = @(git status --porcelain)
if ($pendentes.Count -gt 0) {
    $mensagem = @'
Plataforma de investigacao ICAM

Aplicativo para conduzir e documentar investigacoes de incidentes segundo a
metodologia ICAM, com copiloto de IA auditavel.
'@
    git commit -q -m $mensagem
    if ($LASTEXITCODE -ne 0) {
        Erro 'nao foi possivel registrar a versao (git commit falhou).'
        exit 1
    }
    Ok 'versao registrada'
} else {
    Ok 'nada novo a registrar; a versao local ja esta pronta'
}

git rev-parse --verify HEAD > $null 2>&1
if ($LASTEXITCODE -ne 0) {
    Erro 'nao existe nenhuma versao registrada para enviar.'
    exit 1
}

# Garante que o envio va para o ramo main.
$ramo = (git rev-parse --abbrev-ref HEAD).Trim()
if ($ramo -ne 'main') {
    git branch -M main
    Ok "ramo renomeado de $ramo para main"
} else {
    Ok 'ramo main'
}

# ---------------------------------------------------------------------------
Passo 'Criando o repositorio no GitHub'
# ---------------------------------------------------------------------------
$url = "https://github.com/$Usuario/$Repositorio.git"

# Se um envio anterior ja funcionou, o repositorio existe e a origem esta
# gravada nesta pasta. Nao ha nada a criar: seguimos direto para o envio, sem
# abrir navegador nem incomodar quem so quer mandar uma atualizacao.
$origemGravada = (git remote get-url origin 2>$null)
$origemJaConfigurada = ($LASTEXITCODE -eq 0) -and ($origemGravada -ne $null) -and ($origemGravada.Trim() -eq $url)

if ($origemJaConfigurada) {
    Ok 'repositorio ja publicado antes; enviando apenas as novidades'
} elseif ($RepositorioJaExiste) {
    Ok 'etapa pulada a pedido (-RepositorioJaExiste)'
} elseif (Get-Command gh -ErrorAction SilentlyContinue) {
    gh repo view "$Usuario/$Repositorio" > $null 2>&1
    if ($LASTEXITCODE -ne 0) {
        $argVisibilidade = '--' + $Visibilidade
        gh repo create "$Usuario/$Repositorio" $argVisibilidade
        if ($LASTEXITCODE -ne 0) {
            Erro 'o GitHub CLI nao conseguiu criar o repositorio. Crie pelo site: https://github.com/new'
            exit 1
        }
        Ok "repositorio criado: https://github.com/$Usuario/$Repositorio"
    } else {
        Ok 'repositorio ja existe no GitHub'
    }
} else {
    Write-Host @"

    Vou abrir a pagina de criacao do repositorio no seu navegador.
    La, faca exatamente isto:

      1. Repository name: $Repositorio   (ja vem preenchido)
      2. Marque a opcao Private
      3. NAO marque nenhuma das tres caixas do fim da pagina:
           Add a README file / Add .gitignore / Choose a license
         Marcar qualquer uma faz o envio dar erro de conflito, porque o
         projeto ja tem esses arquivos.
      4. Clique no botao verde Create repository

    Se a pagina disser que o nome ja existe, o repositorio ja foi criado
    antes. Nesse caso e so voltar para esta janela.

"@ -ForegroundColor Gray

    Start-Process "https://github.com/new?name=$Repositorio"
    Read-Host '    Terminou? Pressione Enter para continuar'
}

# ---------------------------------------------------------------------------
Passo 'Enviando'
# ---------------------------------------------------------------------------
$origemAtual = (git remote get-url origin 2>$null)
if ($LASTEXITCODE -ne 0) {
    git remote add origin $url
    Ok "origem definida: $url"
} elseif ($origemAtual.Trim() -ne $url) {
    git remote set-url origin $url
    Ok "origem atualizada: $url"
} else {
    Ok 'origem ja configurada'
}

Write-Host ''
Write-Host '    O git vai pedir para voce entrar na conta do GitHub.' -ForegroundColor Gray
Write-Host '    O normal e abrir uma janela do navegador: entre e autorize.' -ForegroundColor Gray
Write-Host '    Se pedir usuario e senha aqui na janela preta, a senha da conta' -ForegroundColor Gray
Write-Host '    NAO funciona. Crie um token em https://github.com/settings/tokens/new' -ForegroundColor Gray
Write-Host '    marcando o escopo repo, e cole o token no lugar da senha.' -ForegroundColor Gray
Write-Host ''

git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ''
    Write-Host "PUBLICADO: https://github.com/$Usuario/$Repositorio" -ForegroundColor Green
    Write-Host ''
    Write-Host 'Proximo passo: abra PUBLICAR.md e siga a partir do Passo 2,' -ForegroundColor Gray
    Write-Host 'que cria o servico no Render usando este repositorio.' -ForegroundColor Gray
    Write-Host ''
    exit 0
}

Erro 'O envio falhou. As causas mais comuns:'
Write-Host ''
Write-Host '    "Repository not found"' -ForegroundColor Yellow
Write-Host "        O repositorio $Usuario/$Repositorio nao existe ou o usuario esta" -ForegroundColor Gray
Write-Host '        escrito diferente. Confira em https://github.com e rode de novo.' -ForegroundColor Gray
Write-Host ''
Write-Host '    "Authentication failed"' -ForegroundColor Yellow
Write-Host '        A senha da conta nao serve para enviar codigo. Crie um token em' -ForegroundColor Gray
Write-Host '        https://github.com/settings/tokens/new (escopo repo) e use no lugar dela.' -ForegroundColor Gray
Write-Host ''
Write-Host '    "Updates were rejected"' -ForegroundColor Yellow
Write-Host '        O repositorio foi criado com README, .gitignore ou licenca. Apague-o em' -ForegroundColor Gray
Write-Host '        Settings > Delete this repository e crie de novo sem marcar nada.' -ForegroundColor Gray
Write-Host ''
exit 1
