@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Instale o Node.js LTS: https://nodejs.org/
  pause
  exit /b 1
)
set /p LIVE_STUDIO_SECRET=Senha de controle desta execucao: 
if "%LIVE_STUDIO_SECRET%"=="" (
  echo Senha obrigatoria.
  pause
  exit /b 1
)
node server.js
pause
