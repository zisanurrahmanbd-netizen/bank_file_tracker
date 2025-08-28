@echo off
echo 🏦 Starting Bank Recovery System...
echo ====================================

REM Configure npm to avoid permission issues
npm config set cache "C:\npm-cache"
npm config set prefix "C:\npm-global"

echo 📦 Setting up Backend...
cd /d "G:\Bank web\backend"

REM Install dependencies if needed
if not exist "node_modules" (
    echo Installing backend dependencies...
    npm install --no-audit --no-fund
    if %errorLevel% neq 0 (
        echo ❌ Backend dependency installation failed
        goto :manual
    )
)

echo 🚀 Starting Backend Server...
start "Backend Server" cmd /k "cd /d \"G:\Bank web\backend\" && npm run dev"

REM Wait for backend to start
timeout /t 3 /nobreak >nul

echo 📦 Setting up Frontend...
cd /d "G:\Bank web\frontend"

REM Install dependencies if needed  
if not exist "node_modules" (
    echo Installing frontend dependencies...
    npm install --no-audit --no-fund
    if %errorLevel% neq 0 (
        echo ❌ Frontend dependency installation failed
        goto :manual
    )
)

echo 🚀 Starting Frontend Server...
start "Frontend Server" cmd /k "cd /d \"G:\Bank web\frontend\" && npm run dev"

REM Wait for frontend to start
timeout /t 5 /nobreak >nul

echo.
echo 🎉 Bank Recovery System is Starting!
echo ====================================
echo 📍 Frontend: http://localhost:5173
echo 📍 Backend API: http://localhost:3000  
echo 📍 API Docs: http://localhost:3000/docs
echo.
echo 🔑 Demo Login Credentials:
echo Admin: admin@example.com / admin123
echo Agent: agent1@example.com / agent123
echo.

REM Open browser automatically
start http://localhost:5173

echo ✅ System started! Check the opened browser window.
echo Close this window when done with development.
pause
goto :end

:manual
echo.
echo 📝 Manual Steps Required:
echo 1. Open Command Prompt as Administrator
echo 2. cd /d "G:\Bank web\backend" 
echo 3. npm install
echo 4. npm run dev
echo 5. Open another Admin Command Prompt
echo 6. cd /d "G:\Bank web\frontend"
echo 7. npm install  
echo 8. npm run dev
echo 9. Open http://localhost:5173
echo.
pause

:end