@echo off
echo 🔧 Quick Fix for TypeScript Issues
echo ===================================

echo 📦 Step 1: Installing backend dependencies...
cd backend
call npm install --silent

echo 📦 Step 2: Installing frontend dependencies...
cd ..\frontend
call npm install --silent

echo 🔧 Step 3: Building TypeScript...
cd ..\backend
call npm run build

echo ✅ Quick fix completed!
echo.
echo 🔍 To check for remaining issues:
echo    npm run lint (in backend folder)
echo    npm run build (to verify compilation)
echo.
pause