@echo off
setlocal
cd /d "%~dp0"

echo.
echo ============================================================
echo   GERAR A VERSAO DE ARQUIVO UNICO
echo ============================================================
echo.
echo Monta o ICAM-Coleta.html: um arquivo so, que abre no Edge
echo com duplo clique. Sem servidor, sem instalacao e sem rede.
echo.
echo Voce so precisa do Node.js NESTE computador, para gerar.
echo Quem vai usar o arquivo depois nao precisa de nada.
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [X] O Node.js nao esta instalado neste computador.
  echo     Baixe a versao LTS em: https://nodejs.org
  echo.
  pause
  exit /b 1
)

echo ==^> Conferindo as dependencias.
echo     Na primeira vez leva alguns minutos; depois e rapido.
call npm install --no-audit --no-fund
if errorlevel 1 goto falhou
echo.

echo ==^> PASSO 1 de 2: conferindo se o codigo compila
call npm run typecheck
if errorlevel 1 (
  echo.
  echo [X] O codigo tem erro de compilacao. Copie as linhas acima
  echo     e me mande antes de gerar o arquivo.
  echo.
  pause
  exit /b 1
)
echo     OK, compila.
echo.

echo ==^> PASSO 2 de 2: montando o arquivo
call node scripts/montar-navegador.mjs
if errorlevel 1 goto falhou

echo.
echo ============================================================
echo   PRONTO
echo.
echo   O arquivo ICAM-Coleta.html esta nesta pasta.
echo   Duplo clique para abrir. Para usar em outra maquina,
echo   basta copiar esse arquivo - mais nada.
echo ============================================================
echo.
start "" "%~dp0"
pause
exit /b 0

:falhou
echo.
echo ------------------------------------------------------------
echo [X] Nao deu certo.
echo.
echo   Se aparecer "UNKNOWN: unknown error, read" no texto acima,
echo   NAO e erro do programa: o Windows nao conseguiu ler um
echo   arquivo da pasta node_modules. Rode o REINSTALAR.bat, que
echo   resolve esse caso, e depois volte aqui.
echo.
echo   Para qualquer outra mensagem, copie o texto inteiro e me
echo   mande.
echo ------------------------------------------------------------
echo.
pause
exit /b 1
