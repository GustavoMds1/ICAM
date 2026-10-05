@echo off
setlocal
cd /d "%~dp0"

echo.
echo ============================================================
echo   CONSERTAR O CONTROLE DE VERSAO (GIT)
echo ============================================================
echo.
echo Use quando a publicacao falhar com uma mensagem como
echo "invalid object ... for ..." ou "Error building trees".
echo.
echo Isso quer dizer que o Git perdeu um arquivo interno dele.
echo Quase sempre e o OneDrive, que sincroniza a pasta .git e
echo as vezes deixa pedacos dela so na nuvem.
echo.
echo SEU CODIGO NAO CORRE RISCO. Este reparo mexe so no indice
echo do Git, que e reconstruido a partir dos seus arquivos.
echo.
echo ------------------------------------------------------------
echo   ANTES DE CONTINUAR, PAUSE O ONEDRIVE
echo.
echo   1. Clique no icone da nuvem, perto do relogio
echo   2. Engrenagem  ^>  "Pausar sincronizacao"  ^>  2 horas
echo ------------------------------------------------------------
echo.
pause

where git >nul 2>&1
if errorlevel 1 (
  echo [X] O git nao esta instalado. Baixe em https://git-scm.com
  echo.
  pause
  exit /b 1
)

if not exist .git (
  echo [X] Esta pasta nao tem repositorio git. Rode o
  echo     PUBLICAR-NO-GITHUB.bat, que cria um do zero.
  echo.
  pause
  exit /b 1
)

echo.
echo ==^> PASSO 1 de 4: medindo o estrago
echo     A lista abaixo mostra o que o Git nao esta conseguindo ler.
echo     "dangling" NAO e problema; ignore essas linhas.
echo.
git fsck --full 2>&1 | findstr /v /c:"dangling"
echo.
echo     (se nao apareceu nada acima, o dano era so no indice)
echo.

echo ==^> PASSO 2 de 4: descartando o indice quebrado
if exist .git\index del /f /q .git\index
if exist .git\index (
  echo.
  echo [X] Nao consegui apagar .git\index. Feche o VS Code e
  echo     qualquer janela de terminal, confirme que o OneDrive
  echo     esta pausado, e rode de novo.
  echo.
  pause
  exit /b 1
)
echo     OK, indice removido.
echo.

echo ==^> PASSO 3 de 4: reconstruindo a partir dos seus arquivos
echo     O Git vai reescrever os objetos que faltavam.
git add -A
if errorlevel 1 (
  echo.
  echo [X] A reconstrucao falhou. Copie o texto acima e me mande:
  echo     nesse caso o dano passou do indice e o conserto e outro.
  echo.
  pause
  exit /b 1
)
echo     OK, reconstruido.
echo.

echo ==^> PASSO 4 de 4: conferindo de novo
git fsck --full 2>&1 | findstr /v /c:"dangling"
echo.

echo ============================================================
echo   PRONTO
echo.
echo   Agora rode o PUBLICAR-NO-GITHUB.bat.
echo.
echo   Se a publicacao falhar de novo com "invalid object",
echo   o dano esta no historico e nao no indice - me mande o
echo   texto inteiro que eu te passo o proximo passo.
echo.
echo   Lembre de RETOMAR a sincronizacao do OneDrive depois.
echo ============================================================
echo.
pause
