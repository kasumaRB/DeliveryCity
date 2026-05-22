@echo off
echo.
echo ============================================
echo   DeliveryCity - Instalar APK via ADB
echo ============================================
echo.

cd /d "%~dp0"

REM Caminho do ADB no Android Studio
set ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe

if not exist "%ADB%" (
    echo ADB nao encontrado em: %ADB%
    echo Tentando adb do PATH...
    set ADB=adb
)

echo Verificando dispositivo conectado...
"%ADB%" devices
echo.

set APK=android\app\build\outputs\apk\debug\app-debug.apk

if not exist "%APK%" (
    echo ERRO: APK nao encontrado em %APK%
    echo Execute build_apk.bat primeiro!
    pause
    exit /b 1
)

echo Instalando APK no dispositivo...
"%ADB%" install -r "%APK%"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================
    echo   INSTALADO COM SUCESSO!
    echo   Abra o app DeliveryCity no celular
    echo ============================================
) else (
    echo.
    echo ============================================
    echo   ERRO na instalacao
    echo   Verifique se USB Debugging esta ativo
    echo   e se o celular aparece em "adb devices"
    echo ============================================
)
echo.
pause
