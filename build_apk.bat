@echo off
echo.
echo ============================================
echo   DeliveryCity - Build Completo APK
echo ============================================
echo.

cd /d "%~dp0"

echo [1/4] Gerando build web (React/Vite)...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo ERRO: npm run build falhou!