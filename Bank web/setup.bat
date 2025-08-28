@echo off
echo 🏦 Bank Loan Recovery System - Environment Setup
echo ================================================

REM Install backend dependencies
echo 📦 Installing backend dependencies...
cd backend
call npm install

REM Install frontend dependencies  
echo 📦 Installing frontend dependencies...
cd ..\frontend
call npm install

REM Go back to root
cd ..

echo ✅ Dependencies installed successfully!
echo.
echo 🚀 To start development:
echo    Run: npm run dev (in backend folder)
echo    Run: npm run dev (in frontend folder)
echo    Or use Docker: start-dev.bat