@echo off
setlocal
cd /d "%~dp0"

echo.
echo ============================================================
echo   ABRIR O APLICATIVO DE COLETA NO NAVEGADOR
echo ============================================================
echo.
echo O aplicativo vai rodar no seu computador, em
echo   http://localhost:3000
echo.
echo Para encerrar, feche esta janela preta.
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [X] O Node.js nao esta instalado. Baixe a versao LTS em
  echo     https://nodejs.org, feche esta janela e tente de novo.
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo ==^> Instalando as dependencias. So na primeira vez.
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo.
    echo [X] A instalacao falhou. Copie as linhas acima e me mande.
    echo.
    pause
    exit /b 1
  )
  echo.
)

echo ==^> Iniciando. Aguarde a mensagem "Ready" e o navegador abrir.
echo.
start "" http://localhost:3000
call npm run dev

echo.
echo O aplicativo foi encerrado.
pause
