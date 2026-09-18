@echo off
setlocal
cd /d "%~dp0"

echo.
echo ============================================================
echo   MATERIAL PARA MONTAR O AGENTE NO COPILOT STUDIO
echo ============================================================
echo.
echo Gera os textos que voce vai colar no Copilot Studio, tirados
echo do MESMO catalogo e do MESMO gabarito que o aplicativo usa.
echo.
echo Nada e enviado para lugar nenhum. Sao arquivos de texto.
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [X] O Node.js nao esta instalado neste computador.
  echo.
  echo     Baixe a versao LTS em: https://nodejs.org
  echo     Depois FECHE esta janela e execute este arquivo de novo.
  echo.
  pause
  exit /b 1
)

call node scripts/gerar-material-copilot.mjs
if errorlevel 1 (
  echo.
  echo [X] Nao deu certo. Copie as linhas acima e me mande.
  echo.
  pause
  exit /b 1
)

echo.
echo ------------------------------------------------------------
echo   Os arquivos estao na pasta: copilot-studio
echo.
echo   Abrindo a pasta para voce...
echo ------------------------------------------------------------
start "" "%~dp0copilot-studio"
echo.
pause
