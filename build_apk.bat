@echo off
echo === Compilando APK DeliveryCity ===
cd /d "%~dp0android"
call gradlew.bat assembleDebug
if %ERRORLEVEL% == 0 (
    echo.
    echo === APK compilado com sucesso! ===
    echo Arquivo: app\build\outputs\apk\debug\app-debug.apk
) else (
    echo.
    echo === ERRO na compilacao ===
)
pause
