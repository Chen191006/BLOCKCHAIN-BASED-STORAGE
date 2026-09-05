@echo off
title Spider-Web Omega Blockchain Cloud Storage Node
color 0A

echo =========================================================================
echo  ⚡ SPIDER-WEB OMEGA: BLOCKCHAIN CLOUD STORAGE SYSTEM
echo =========================================================================
echo.

if not exist node_modules (
    echo [INFO] Installing required Node.js dependencies...
    call npm install
    echo.
)

echo [INFO] Opening Localhost Web Interface in default browser...
start http://localhost:3000

echo [INFO] Launching Blockchain Node Server on http://localhost:3000...
echo.
node server.js

pause
