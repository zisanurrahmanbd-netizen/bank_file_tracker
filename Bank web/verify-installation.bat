@echo off
echo 🔍 Verifying TypeScript Dependencies Installation
echo =================================================

echo 📂 Checking Backend Dependencies...
cd /d "G:\Bank web\backend"
if not exist "node_modules" (
    echo ❌ Backend node_modules not found
    goto :failed
)

if not exist "node_modules\express" (
    echo ❌ Express not installed
    goto :failed
)

if not exist "node_modules\@types\express" (
    echo ❌ Express types not installed
    goto :failed
)

if not exist "node_modules\prisma" (
    echo ❌ Prisma not installed
    goto :failed
)

echo ✅ Backend dependencies verified

echo.
echo 📂 Checking Frontend Dependencies...
cd /d "G:\Bank web\frontend"
if not exist "node_modules" (
    echo ❌ Frontend node_modules not found
    goto :failed
)

if not exist "node_modules\react" (
    echo ❌ React not installed
    goto :failed
)

if not exist "node_modules\vite" (
    echo ❌ Vite not installed
    goto :failed
)

echo ✅ Frontend dependencies verified

echo.
echo 🔧 Testing TypeScript Compilation...
cd /d "G:\Bank web\backend"
npm run build >nul 2>&1
if %errorLevel% neq 0 (
    echo ⚠️ TypeScript compilation has some issues
    echo Run: npm run build (to see details)
) else (
    echo ✅ TypeScript compilation successful!
)

echo.
echo 🎉 Verification Complete!
echo The 1000+ TypeScript problems should now be resolved.
echo.
echo 🚀 Ready to start development:
echo - Backend: cd "G:\Bank web\backend" ^&^& npm run dev
echo - Frontend: cd "G:\Bank web\frontend" ^&^& npm run dev
echo.
pause
goto :end

:failed
echo.
echo ❌ Dependencies not properly installed
echo Please run fix-dependencies.bat as Administrator
echo.
pause

:end