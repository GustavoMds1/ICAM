@echo off
setlocal
cd /d "%~dp0"

echo.
echo ============================================================
echo   REINSTALACAO LIMPA DAS DEPENDENCIAS
echo ============================================================
echo.
echo Use quando aparecer o erro "UNKNOWN: unknown error, read".
echo Ele quer dizer que o Windows nao conseguiu ler um arquivo
echo da pasta node_modules - quase sempre porque o OneDrive
echo deixou o arquivo so na nuvem, ou porque uma instalacao
echo anterior parou pela metade.
echo.
echo ------------------------------------------------------------
echo   ANTES DE CONTINUAR, PAUSE O ONEDRIVE
echo.
echo   1. Clique no icone da nuvem, perto do relogio
echo   2. Engrenagem  ^>  "Pausar sincronizacao"  ^>  2 horas
echo.
echo   Sem isso, o OneDrive mexe nos arquivos enquanto o npm
echo   escreve, e o erro volta.
echo ------------------------------------------------------------
echo.
pause

where node >nul 2>&1
if errorlevel 1 (
  echo [X] O Node.js nao esta instalado. Baixe em https://nodejs.org
  echo.
  pause
  exit /b 1
)

echo.
echo ==^> PASSO 1 de 3: apagando a pasta node_modules
echo     Sao muitos arquivos; pode levar varios minutos.
if exist node_modules (
  rmdir /s /q node_modules
  if exist node_modules (
    echo.
    echo [X] Nao consegui apagar a pasta node_modules por completo.
    echo     Geralmente e porque algum programa esta usando os
    echo     arquivos. Feche o VS Code e qualquer janela de terminal,
    echo     confirme que o OneDrive esta pausado, e rode de novo.
    echo.
    pause
    exit /b 1
  )
  echo     Apagada.
) else (
  echo     Ja nao existia.
)
echo.

echo ==^> PASSO 2 de 3: liberando os scripts de instalacao
echo     O esbuild precisa do script dele para funcionar. Se o npm
echo     perguntar alguma coisa, responda que sim.
call npm approve-scripts --allow-scripts-pending
echo.

echo ==^> PASSO 3 de 3: instalando de novo
call npm install --no-audit --no-fund --foreground-scripts
if errorlevel 1 (
  echo.
  echo [X] A instalacao falhou. Copie o texto acima e me mande.
  echo.
  pause
  exit /b 1
)

echo.
echo ============================================================
echo   PRONTO
echo.
echo   Agora rode o GERAR-HTML.bat.
echo.
echo   Se der certo, lembre de RETOMAR a sincronizacao do
echo   OneDrive depois: mesmo icone da nuvem.
echo ============================================================
echo.
pause
