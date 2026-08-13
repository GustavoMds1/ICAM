<#
    Publica o projeto no GitHub.

    Execute no PowerShell, dentro da pasta do projeto:

        cd "C:\Users\gusta\OneDrive\Documentos\ICAM"
        .\publicar-no-github.ps1 -Usuario SEU-USUARIO-GITHUB

    O script é seguro para rodar mais de uma vez. Antes de enviar qualquer
    coisa, ele CONFERE que nenhum segredo ou dado local está versionado — e
    aborta se encontrar algum.
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$Usuario,

    [string]$Repositorio = 'icam',

    # Repositório privado por padrão. Mesmo sem dados reais, o código contém a
    # estrutura de segurança da plataforma.
    [ValidateSet('private', 'public')]
    [string]$Visibilidade = 'private',

    [string]$Email = 'gustavomendesh@gmail.com',
    [string]$Nome  = 'Gustavo'
)

$ErrorActionPreference = 'Stop'

function Passo($texto)  { Write-Host "`n==> $texto" -ForegroundColor Cyan }
function Ok($texto)     { Write-Host "    OK  $texto" -ForegroundColor Green }
function Aviso($texto)  { Write-Host "    !   $texto" -ForegroundColor Yellow }
function Erro($texto)   { Write-Host "    X   $texto" -ForegroundColor Red }

# ---------------------------------------------------------------------------
Passo 'Verificando o git'
# ---------------------------------------------------------------------------
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Erro 'git não encontrado. Instale em https://git-scm.com/download/win e reabra o PowerShell.'
    exit 1
}
Ok (git --version)

# ---------------------------------------------------------------------------
Passo 'Liberando trava remanescente'
# ---------------------------------------------------------------------------
# A preparação foi feita a partir de um ambiente que não conseguiu remover
# este arquivo. No Windows a remoção funciona normalmente.
if (Test-Path '.git\index.lock') {
    Remove-Item '.git\index.lock' -Force
    Ok 'index.lock removido'
} else {
    Ok 'nenhuma trava pendente'
}

# ---------------------------------------------------------------------------
Passo 'Preparando o repositório local'
# ---------------------------------------------------------------------------
if (-not (Test-Path '.git')) {
    git init -q
    git symbolic-ref HEAD refs/heads/main
    Ok 'repositório inicializado'
} else {
    Ok 'repositório já existente'
}

git config user.name  $Nome
git config user.email $Email
git add -A
Ok 'arquivos preparados'

# ---------------------------------------------------------------------------
Passo 'CONFERÊNCIA DE SEGURANÇA'
# ---------------------------------------------------------------------------
# Nenhum envio acontece se esta etapa falhar.
$versionados = git ls-files
$proibidos = $versionados | Where-Object {
    $_ -eq '.env' -or
    $_ -like '.env.local*' -or
    $_ -like 'node_modules/*' -or
    $_ -like '.next/*' -or
    $_ -like 'armazenamento/*' -or
    $_ -like 'dados-locais/*' -or
    $_ -like '*.db'
}

if ($proibidos) {
    Erro 'Arquivos que NÃO podem ser publicados foram encontrados:'
    $proibidos | ForEach-Object { Write-Host "        $_" -ForegroundColor Red }
    Erro 'Publicação abortada. Remova-os com: git rm --cached <arquivo>'
    exit 1
}
Ok "$($versionados.Count) arquivos, nenhum segredo nem dado local"

# Procura por padrões de credencial no conteúdo.
$padroes = 'sk-ant-|ghp_|github_pat_|AKIA[0-9A-Z]{16}|BEGIN [A-Z ]*PRIVATE KEY|xox[baprs]-'
$suspeitos = $versionados |
    Where-Object { $_ -notlike 'package-lock.json' -and (Test-Path $_) } |
    Select-String -Pattern $padroes -List -ErrorAction SilentlyContinue

if ($suspeitos) {
    Erro 'Possíveis credenciais encontradas no conteúdo:'
    $suspeitos | ForEach-Object { Write-Host "        $($_.Path):$($_.LineNumber)" -ForegroundColor Red }
    Erro 'Publicação abortada. Remova as credenciais antes de continuar.'
    exit 1
}
Ok 'nenhuma credencial no conteúdo dos arquivos'

# ---------------------------------------------------------------------------
Passo 'Registrando a versão'
# ---------------------------------------------------------------------------
$pendentes = git status --porcelain
if ($pendentes) {
    $mensagem = @'
Plataforma de investigação ICAM

Aplicativo para conduzir e documentar investigações de incidentes segundo a
metodologia ICAM, com copiloto de IA auditável.

- Catálogo dos 101 códigos com proveniência: 99 definições integrais
  importadas do documento de origem, 2 sem definição na fonte. Nenhuma
  definição gerada por IA.
- Dez agentes com contrato de saída validado por Zod, provedor determinístico
  como padrão e adaptador externo opcional.
- 26 verificadores automáticos de qualidade causal que bloqueiam a publicação
  do relatório enquanto houver achado sem sustentação.
- Autenticação por usuário com scrypt, sessão revogável e bloqueio por
  tentativa.
- PostgreSQL com migrações versionadas e trilha de auditoria append-only
  garantida por gatilho no próprio banco.
- 202 testes, dos quais 41 rodam contra PostgreSQL real.
'@
    git commit -q -m $mensagem
    Ok 'versão registrada'
} else {
    Ok 'nada novo a registrar'
}

# ---------------------------------------------------------------------------
Passo 'Criando o repositório no GitHub'
# ---------------------------------------------------------------------------
$url = "https://github.com/$Usuario/$Repositorio.git"

if (Get-Command gh -ErrorAction SilentlyContinue) {
    $existe = gh repo view "$Usuario/$Repositorio" 2>$null
    if ($LASTEXITCODE -ne 0) {
        gh repo create "$Usuario/$Repositorio" --$Visibilidade --source=. --remote=origin --push
        Ok "repositório criado e enviado: $url"
        Write-Host "`nPronto: https://github.com/$Usuario/$Repositorio" -ForegroundColor Green
        exit 0
    }
    Ok 'repositório já existe no GitHub'
} else {
    Aviso 'GitHub CLI (gh) não instalado.'
    Write-Host @"

    Crie o repositório manualmente:
      1. Abra https://github.com/new
      2. Nome: $Repositorio
      3. Marque $Visibilidade
      4. NÃO marque "Add a README", "Add .gitignore" nem "Choose a license"
         (o projeto já tem os arquivos; marcar causa conflito no primeiro envio)
      5. Clique em "Create repository"

    Depois rode este script de novo, ou continue com os comandos abaixo.

"@ -ForegroundColor Gray
}

# ---------------------------------------------------------------------------
Passo 'Enviando'
# ---------------------------------------------------------------------------
$origemAtual = git remote get-url origin 2>$null
if ($LASTEXITCODE -ne 0) {
    git remote add origin $url
    Ok "origem definida: $url"
} elseif ($origemAtual -ne $url) {
    git remote set-url origin $url
    Ok "origem atualizada: $url"
} else {
    Ok 'origem já configurada'
}

Write-Host "`n    O git vai pedir suas credenciais do GitHub." -ForegroundColor Gray
Write-Host "    Se pedir senha, use um Personal Access Token, não a senha da conta:" -ForegroundColor Gray
Write-Host "    https://github.com/settings/tokens  (escopo 'repo')`n" -ForegroundColor Gray

git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nPublicado: https://github.com/$Usuario/$Repositorio" -ForegroundColor Green
    Write-Host "Próximo passo: PUBLICAR.md, a partir do Passo 2 (criar o serviço no Render).`n" -ForegroundColor Gray
} else {
    Erro 'O envio falhou. Confira o usuário, o nome do repositório e as credenciais.'
    exit 1
}
