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
    pause
    exit /b 1
)
echo     OK

echo.
echo [2/4] Sincronizando assets com Android (cap sync)...
call npx cap sync android
if %ERRORLEVEL% NEQ 0 (
    echo ERRO: cap sync falhou!
    pause
    exit /b 1
)
echo     OK

echo.
echo [3/4] Compilando APK (Gradle)...
cd /d "%~dp0android"
call gradlew.bat assembleDebug
if %ERRORLEVEL% NEQ 0 (
    echo ERRO: Gradle build falhou!
    pause
    exit /b 1
)
echo     OK

echo.
echo [4/4] Copiando APK para raiz do projeto...
cd /d "%~dp0"
copy /Y "android\app\build\outputs\apk\debug\app-debug.apk" "DeliveryCity.apk"
echo     OK

echo.
echo ============================================
echo   APK PRONTO: DeliveryCity.apk
echo ============================================
echo.
echo Para instalar no celular, execute: install_apk.bat
echo (Certifique-se que o USB Debugging esta ativo)
echo.
pause
