@echo off
echo 🔧 Fixing TypeScript Dependencies - Bank Recovery System
echo ============================================================

REM Check if running as administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ❌ This script needs to run as Administrator
    echo Right-click and select "Run as administrator"
    pause
    exit /b 1
)

echo ✅ Running with Administrator privileges

REM Navigate to project backend
echo.
echo 📂 Navigating to backend directory...
cd /d "G:\Bank web\backend"
if %errorLevel% neq 0 (
    echo ❌ Could not find backend directory
    pause
    exit /b 1
)

echo 📦 Installing Backend Dependencies...
echo.

REM Clear npm cache
npm cache clean --force

REM Remove existing node_modules and package-lock
if exist "node_modules" (
    echo 🗑️ Removing existing node_modules...
    rmdir /s /q "node_modules"
)

if exist "package-lock.json" (
    del "package-lock.json"
)

REM Configure npm settings
npm config set fund false
npm config set audit false

REM Install backend dependencies
npm install --no-optional --prefer-offline
if %errorLevel% neq 0 (
    echo ❌ Backend installation failed
    goto :error
)

echo ✅ Backend dependencies installed successfully!

REM Navigate to frontend
echo.
echo 📂 Navigating to frontend directory...
cd /d "G:\Bank web\frontend"
if %errorLevel% neq 0 (
    echo ❌ Could not find frontend directory
    pause
    exit /b 1
)

echo 📦 Installing Frontend Dependencies...
echo.

REM Remove existing node_modules and package-lock
if exist "node_modules" (
    echo 🗑️ Removing existing node_modules...
    rmdir /s /q "node_modules"
)

if exist "package-lock.json" (
    del "package-lock.json"
)

REM Install frontend dependencies
npm install --no-optional --prefer-offline
if %errorLevel% neq 0 (
    echo ❌ Frontend installation failed
    goto :error
)

echo ✅ Frontend dependencies installed successfully!

REM Verify TypeScript compilation
echo.
echo 🔧 Verifying TypeScript Compilation...
cd /d "G:\Bank web\backend"
npm run build
if %errorLevel% neq 0 (
    echo ⚠️ TypeScript compilation has some issues, but dependencies are installed
) else (
    echo ✅ TypeScript compilation successful!
)

echo.
echo 🎉 Dependency installation completed!
echo.
echo 📋 Next Steps:
echo 1. Restart your IDE/VS Code
echo 2. Open the project and check for remaining TypeScript errors
echo 3. Start development server: npm run dev (in backend folder)
echo 4. Start frontend: npm run dev (in frontend folder)
echo.
pause
goto :end

:error
echo.
echo ❌ Installation failed. Try manual installation:
echo 1. Open Command Prompt as Administrator
echo 2. cd /d "G:\Bank web\backend"
echo 3. npm install
echo 4. cd /d "G:\Bank web\frontend"  
echo 5. npm install
echo.
pause

:end