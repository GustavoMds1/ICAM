@echo off
setlocal
cd /d "%~dp0"

echo.
echo ============================================================
echo   MEDIR A IDENTIFICACAO LOCAL DE CODIGOS ICAM
echo ============================================================
echo.
echo Este programa confere o codigo e mede quantas vezes ele acerta
echo o codigo ICAM, comparando com o gabarito do seu slide 13.
echo.
echo Nada e publicado. Nada sai do seu computador.
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [X] O Node.js nao esta instalado neste computador.
  echo.
  echo     Baixe a versao LTS em: https://nodejs.org
  echo     Aceite as opcoes padrao. Depois FECHE esta janela e
  echo     execute este arquivo de novo.
  echo.
  pause
  exit /b 1
)

for /f "delims=" %%v in ('node --version') do echo Node.js %%v
echo.

if not exist node_modules (
  echo ==^> Instalando as dependencias. So na primeira vez, leva alguns minutos.
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

echo ==^> PASSO 1 de 2: conferindo se o codigo compila
call npm run typecheck
if errorlevel 1 (
  echo.
  echo [X] O codigo tem erro de compilacao.
  echo     Copie as linhas acima e me mande: sao os erros que eu nao
  echo     consegui ver sem ambiente para rodar.
  echo.
  pause
  exit /b 1
)
echo     OK, compila.
echo.

echo ==^> PASSO 2 de 2: medindo o acerto contra o gabarito
echo.
echo     Procure por "acerto em 1 lugar" no meio do texto. Abaixo dele
echo     sai a lista de acertos e a lista de erros com o motivo de cada
echo     um: qual codigo ganhou, com que pontuacao, e em que lugar
echo     ficou o codigo que a equipe tinha escolhido.
echo.
call npm test
set RESULTADO=%errorlevel%

echo.
echo ============================================================
if "%RESULTADO%"=="0" (
  echo   PASSOU
  echo.
  echo   O acerto ficou dentro ou acima do piso registrado. Se o
  echo   numero subiu, me mande: o piso do teste sobe junto, senao
  echo   ele para de proteger contra piora.
) else (
  echo   ALGUM TESTE REPROVOU
  echo.
  echo   Procure por "Failed Tests" acima: o nome do teste diz o que
  echo   caiu. Nem sempre e o acerto - pode ser uma regra de
  echo   integridade do catalogo ou um teste que eu escrevi errado.
  echo.
  echo   O numero do acerto continua impresso logo acima, em
  echo   "acerto em 1 lugar": confira se ele mudou mesmo antes de
  echo   concluir que piorou.
  echo.
  echo   Copie o texto inteiro e me mande.
)
echo ============================================================
echo.
pause
