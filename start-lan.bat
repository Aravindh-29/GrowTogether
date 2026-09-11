@echo off
echo =====================================================
echo  Combined Studies - LAN HTTPS Mode
echo  Your LAN IP: 192.168.8.218
echo =====================================================
echo.
echo Starting backend (HTTP on port 5000)...
start "Backend" cmd /k "cd /d "%~dp0backend\src\CombinedStudies.Api" && dotnet run --launch-profile http"

echo Waiting 3 seconds for backend to start...
timeout /t 3 /nobreak >nul

echo Starting frontend (HTTPS on port 5173 - LAN mode)...
start "Frontend LAN" cmd /k "cd /d "%~dp0web" && npm run dev:lan"

echo.
echo =====================================================
echo  Once both servers are running:
echo.
echo  THIS machine:   https://localhost:5173
echo  OTHER devices:  https://192.168.8.218:5173
echo.
echo  On the other device, accept the certificate
echo  warning (Advanced -> Proceed) when prompted.
echo =====================================================
pause
