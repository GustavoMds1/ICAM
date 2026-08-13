@echo off
setlocal
chcp 65001 >nul 2>&1
cd /d "%~dp0"

echo.
echo ============================================================
echo   PUBLICAR NO GITHUB - Plataforma de investigacao ICAM
echo ============================================================
echo.
echo Este assistente envia o projeto para o GitHub.
echo Voce so precisa informar seu nome de usuario do GitHub.
echo.
echo Se ainda nao tem conta, crie em https://github.com/signup
echo (leva 2 minutos; depois volte aqui e rode de novo)
echo.

where git >nul 2>&1
if errorlevel 1 (
  echo [X] O Git nao esta instalado neste computador.
  echo.
  echo     Baixe e instale em: https://git-scm.com/download/win
  echo     Aceite todas as opcoes padrao durante a instalacao.
  echo     Depois FECHE esta janela e execute este arquivo de novo.
  echo.
  pause
  exit /b 1
)

set "USUARIO="
set /p USUARIO=Seu usuario do GitHub: 
if "%USUARIO%"=="" (
  echo.
  echo [X] Nenhum usuario informado. Nada foi feito.
  echo.
  pause
  exit /b 1
)

echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0publicar-no-github.ps1" -Usuario "%USUARIO%"
set CODIGO=%ERRORLEVEL%

echo.
if %CODIGO% NEQ 0 (
  echo ------------------------------------------------------------
  echo A publicacao NAO foi concluida. Leia as mensagens acima.
  echo ------------------------------------------------------------
)
echo.
echo Pressione qualquer tecla para fechar.
pause >nul
