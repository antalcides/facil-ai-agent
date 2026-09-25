@echo off
chcp 65001 >nul <nul
cd /d "%~dp0"
setlocal EnableExtensions

echo ===================================================
echo        FACIL CON AI AGENT - LANZADOR
echo ===================================================
echo.

REM --- Buscar ollama.exe (where a veces falla al doble-clic) ---
set "OLLAMA_EXE="
where ollama >nul 2>nul <nul
if not errorlevel 1 (
    for /f "delims=" %%i in ('where ollama 2^>nul ^<nul') do (
        if not defined OLLAMA_EXE set "OLLAMA_EXE=%%i"
    )
)
if not defined OLLAMA_EXE if exist "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" set "OLLAMA_EXE=%LOCALAPPDATA%\Programs\Ollama\ollama.exe"
if not defined OLLAMA_EXE if exist "%USERPROFILE%\AppData\Local\Programs\Ollama\ollama.exe" set "OLLAMA_EXE=%USERPROFILE%\AppData\Local\Programs\Ollama\ollama.exe"
if not defined OLLAMA_EXE if exist "C:\Program Files\Ollama\ollama.exe" set "OLLAMA_EXE=C:\Program Files\Ollama\ollama.exe"
if not defined OLLAMA_EXE if exist "C:\Users\%USERNAME%\AppData\Local\Programs\Ollama\ollama.exe" set "OLLAMA_EXE=C:\Users\%USERNAME%\AppData\Local\Programs\Ollama\ollama.exe"

if defined OLLAMA_EXE (
    echo [OK] Ollama: %OLLAMA_EXE%
) else (
    echo [!] Ollama no encontrado en este PC.
    echo     Solo afecta al modo LOCAL; el modo NUBE no lo necesita.
)

REM CORS para que el navegador pueda hablar con 11434
set "OLLAMA_ORIGINS=*"
setx OLLAMA_ORIGINS "*" >nul 2>nul <nul
echo [OK] OLLAMA_ORIGINS=*

:MENU
echo.
echo ===================================================
echo  ELIGE COMO USAR LA APP   (todo en ESTA ventana)
echo ---------------------------------------------------
echo  1 = LOCAL : arrancar Ollama (oculto) + sitio :8765
echo  2 = LOCAL : Ollama ya esta corriendo + sitio :8765
echo  3 = NUBE  : solo sitio :8765 (OpenAI, Gemini...)
echo  4 = Abrir index.html directo (file://)
echo  5 = Detener Ollama
echo  6 = Salir
echo ===================================================
set "OPC="
ver >nul
set /p OPC="Opcion [1]: "
if errorlevel 1 goto END
if "%OPC%"=="" set OPC=1
if "%OPC%"=="6" goto END
if "%OPC%"=="5" goto STOP_OLLAMA
if "%OPC%"=="4" goto OPENFILE
if "%OPC%"=="3" goto SERVER
if "%OPC%"=="2" goto LOCAL_RUNNING
goto LOCAL_START

REM ---------------------------------------------------
REM MODO LOCAL: arranca Ollama en segundo plano (oculto)
REM ---------------------------------------------------
:LOCAL_START
if not defined OLLAMA_EXE goto NO_OLLAMA

echo [..] Comprobando si Ollama ya responde en 127.0.0.1:11434 ...
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:11434' -UseBasicParsing -TimeoutSec 3; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" <nul
if not errorlevel 1 (
    echo [OK] Ollama ya esta corriendo en 11434
    goto LOCAL_MODELS
)

echo [..] Arrancando Ollama en segundo plano (sin ventana extra)...
powershell -NoProfile -Command "$env:OLLAMA_ORIGINS='*'; Start-Process -FilePath '%OLLAMA_EXE%' -ArgumentList 'serve' -WindowStyle Hidden" <nul
if errorlevel 1 (
    echo [X] No se pudo arrancar Ollama.
    goto NO_OLLAMA
)

set "TRIES=0"
:WAIT_OLLAMA
ping -n 2 127.0.0.1 >nul 2>nul <nul
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:11434' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" <nul
if not errorlevel 1 (
    echo [OK] Ollama listo en 11434
    goto LOCAL_MODELS
)
set /a TRIES=%TRIES%+1
if %TRIES% GEQ 30 goto OLLAMA_TIMEOUT
goto WAIT_OLLAMA

REM ---------------------------------------------------
REM MODO LOCAL: Ollama ya deberia estar corriendo
REM ---------------------------------------------------
:LOCAL_RUNNING
if not defined OLLAMA_EXE goto NO_OLLAMA
echo [..] Comprobando Ollama en 127.0.0.1:11434 ...
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:11434' -UseBasicParsing -TimeoutSec 3; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" <nul
if not errorlevel 1 (
    echo [OK] Ollama responde en 11434
    goto LOCAL_MODELS
)
echo [!] Ollama no responde. Lo arrancamos igual (opciones 1)...
goto LOCAL_START

:LOCAL_MODELS
echo.
echo Modelos tipicos en tu PC (usa el NOMBRE EXACTO en el selector):
echo   mistral:latest
echo   mistral:7b-instruct-q4_K_M
echo   deepseek-coder:latest
echo   qwen2.5:3b
echo   llama3.2:3b
echo.
echo Si eliges un nombre que no existe, Ollama devuelve error HTTP.
echo.
goto SERVER

:OLLAMA_TIMEOUT
echo [!] Ollama no respondio tras 30 s. Revisa que no este bloqueado.
echo     Puedes continuar y usar el modo NUBE, o reintentar con la opcion 1.
goto SERVER

:NO_OLLAMA
echo.
echo [X] Ollama no esta disponible en este PC.
echo     Instalalo desde https://ollama.com/download
echo     o vuelve al menu y elige la opcion 3 (NUBE).
echo.
goto MENU

:STOP_OLLAMA
taskkill /IM ollama.exe /F >nul 2>nul
if errorlevel 1 (
    echo [!] No hay ningun ollama.exe en ejecucion.
) else (
    echo [OK] Ollama detenido.
)
goto MENU

REM ---------------------------------------------------
REM SERVIDOR LOCAL DEL SITIO (un solo ventana)
REM ---------------------------------------------------
:SERVER
echo.
echo Sirviendo http://127.0.0.1:8765
echo Deja esta ventana abierta. Ctrl+C para parar.
echo.
where python >nul 2>nul <nul
if not errorlevel 1 (
    start "" "http://127.0.0.1:8765/index.html"
    python -m http.server 8765
    goto END
)
where py >nul 2>nul <nul
if not errorlevel 1 (
    start "" "http://127.0.0.1:8765/index.html"
    py -m http.server 8765
    goto END
)
echo [X] Python no encontrado. Usando file://
goto OPENFILE

:OPENFILE
start "" "%~dp0index.html"
echo Abierto index.html. En Zen preferible opcion 1 con Python.
goto END

:END
echo.
pause
endlocal
