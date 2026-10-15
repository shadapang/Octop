@echo off
REM ============================================================
REM  Octop launcher - pins OCTOP_HOME so the data dir can
REM  never silently fall back to C:\Users\<you>\.octop
REM
REM  Why this file exists:
REM  OCTOP_HOME was only ever set in ONE shell session - not in
REM  the registry, not in a PowerShell profile. Restarting Octop
REM  from any fresh terminal therefore fell back to
REM  C:\Users\Administrator\.octop, a stale 2026-09-29 instance,
REM  and the user was shown an older expert set.
REM
REM  Usage:  start-octop.bat      (stops any old instance first)
REM          stop-octop.bat
REM
REM  Locations default to this script's own directory. Override by exporting
REM  first:   set OCTOP_ROOT=D:\Octop && start-octop.bat
REM ============================================================
setlocal

REM Force UTF-8 mode for every Python process spawned by Octop
REM (agents' file-reading tools were failing with 'gbk' codec errors).
set "PYTHONUTF8=1"

REM Paths default to this script's own directory (repo root), where .venv and
REM .octop-dev live. Override any of them by setting the var before calling.
set "OCTOP_ROOT=%OCTOP_ROOT%"
if "%OCTOP_ROOT%"=="" set "OCTOP_ROOT=%~dp0"
if "%OCTOP_ROOT:~-1%"=="\" set "OCTOP_ROOT=%OCTOP_ROOT:~0,-1%"

set "OCTOP_BIN=%OCTOP_ROOT%\.venv\Scripts\octop.exe"
set "OCTOP_HOME=%OCTOP_HOME%"
if "%OCTOP_HOME%"=="" set "OCTOP_HOME=%OCTOP_ROOT%\.octop-dev"
set "OCTOP_HOST=127.0.0.1"
set "OCTOP_PORT=8088"
set "OCTOP_CWD=%OCTOP_ROOT%"

if not exist "%OCTOP_BIN%" (
  echo [FATAL] octop.exe not found: %OCTOP_BIN%
  exit /b 1
)
if not exist "%OCTOP_HOME%\octop.db" (
  echo [FATAL] no octop.db under %OCTOP_HOME%
  echo         Refusing to start - otherwise it would silently fall back
  echo         to the stale C:\Users\...\.octop instance.
  exit /b 1
)

echo === Octop launcher ===
echo   OCTOP_HOME : %OCTOP_HOME%
echo   bind       : http://%OCTOP_HOST%:%OCTOP_PORT%
echo.

echo [stop] clearing any previous instance ...
call "%~dp0stop-octop.bat" --quiet

echo [start] launching ...
cd /d "%OCTOP_CWD%"
start "Octop" /min "%OCTOP_BIN%" run --host %OCTOP_HOST% --port %OCTOP_PORT%

echo [wait] health endpoint (up to 120s) ...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='SilentlyContinue';" ^
  "$u='http://%OCTOP_HOST%:%OCTOP_PORT%/api/health';" ^
  "for($i=0;$i -lt 40;$i++){" ^
  "  Start-Sleep -Seconds 3;" ^
  "  try{ $r=Invoke-WebRequest $u -UseBasicParsing -TimeoutSec 5;" ^
  "       Write-Host ('  [ok] ' + $r.Content); exit 0 }catch{}" ^
  "}" ^
  "Write-Host '  [FAIL] health check timed out after 120s';" ^
  "exit 1"

if errorlevel 1 (
  echo        check %OCTOP_HOME%\logs\octop.log
  exit /b 1
)

echo [done] data dir = %OCTOP_HOME%
endlocal
exit /b 0