@echo off
echo.
echo ============================================
echo   DeliveryCity - Instalar APK via ADB
echo ============================================
echo.

cd /d "%~dp0"

echo Verificando dispositivo conectado...
adb devices
echo.

set APK=android\app\build\outputs\apk\debug\app-debug.apk

if not exist "%APK%" (
    echo ERRO: APK nao encontrado em %APK%
    echo Execute build_apk.bat primeiro!
    pause
    exit /b 1
)

echo Instalando APK no dispositivo...
adb install -r "%APK%"

if %ERRORLEVEL% EQU 0 (
    echo.
    ec