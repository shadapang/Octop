@echo off
REM Stop every octop.exe bound to the launcher port.
REM Pass --quiet to suppress the banner (used by start-octop.bat).
setlocal
set "OCTOP_PORT=8088"

if not "%~1"=="--quiet" echo === stopping Octop on port %OCTOP_PORT% ===

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='SilentlyContinue';" ^
  "Get-CimInstance Win32_Process -Filter \"Name='octop.exe'\" |" ^
  "  Where-Object { $_.CommandLine -like '*run*%OCTOP_PORT%*' } |" ^
  "  ForEach-Object { Write-Host ('  kill PID ' + $_.ProcessId); Stop-Process -Id $_.ProcessId -Force }"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Start-Sleep -Seconds 4;" ^
  "$c = @(Get-NetTCPConnection -LocalPort %OCTOP_PORT% -State Listen -ErrorAction SilentlyContinue);" ^
  "if ($c.Count -gt 0) { Write-Host '  [WARN] port %OCTOP_PORT% still listening' }" ^
  "else { Write-Host '  [ok] port %OCTOP_PORT% free' }"

endlocal
exit /b 0