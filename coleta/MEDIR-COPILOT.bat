@echo off
setlocal
cd /d "%~dp0"

echo.
echo ============================================================
echo   MEDIR A VERSAO DO COPILOT STUDIO
echo ============================================================
echo.
echo Compara a resposta do agente com os mesmos 17 casos que
echo medem o aplicativo. So assim da para saber qual das duas
echo versoes esta melhor.
echo.
echo Antes de rodar: cole a resposta do agente, inteira e sem
echo editar, no arquivo:
echo.
echo     copilot-studio\resposta-do-agente.txt
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [X] O Node.js nao esta instalado neste computador.
  echo     Baixe a versao LTS em: https://nodejs.org
  echo.
  pause
  exit /b 1
)

call node scripts/medir-copilot.mjs
if errorlevel 1 (
  echo.
  pause
  exit /b 1
)

echo ============================================================
echo   Me mande esse resultado inteiro, com o caso a caso.
echo   Com ele da para ajustar o prompt do agente.
echo ============================================================
echo.
pause
