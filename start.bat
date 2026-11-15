@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Installing Resell dependencies...
  call npm install
  if errorlevel 1 goto :error
)
echo Starting Resell development website at http://localhost:1420
call npm run dev
if errorlevel 1 goto :error
goto :eof
:error
echo.
echo Resell could not start. Make sure Node.js 22.12 or newer is installed.
pause
