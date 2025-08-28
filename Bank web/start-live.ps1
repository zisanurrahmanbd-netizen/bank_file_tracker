# Quick Start Script for Bank Recovery System
Write-Host "🏦 Starting Bank Recovery System..." -ForegroundColor Green

# Set npm configurations to avoid permission issues
npm config set cache "C:\npm-cache" --global
npm config set prefix "C:\npm-global" --global

try {
    # Backend Setup
    Write-Host "📦 Setting up Backend..." -ForegroundColor Cyan
    Set-Location "G:\Bank web\backend"
    
    # Quick dependency check and install
    if (-not (Test-Path "node_modules")) {
        Write-Host "Installing backend dependencies..." -ForegroundColor Yellow
        npm install --no-audit --no-fund --prefer-offline
    }
    
    # Start backend server in background
    Write-Host "🚀 Starting Backend Server on http://localhost:3000" -ForegroundColor Green
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'G:\Bank web\backend'; npm run dev"
    
    # Wait a moment for backend to start
    Start-Sleep -Seconds 3
    
    # Frontend Setup  
    Write-Host "📦 Setting up Frontend..." -ForegroundColor Cyan
    Set-Location "G:\Bank web\frontend"
    
    if (-not (Test-Path "node_modules")) {
        Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
        npm install --no-audit --no-fund --prefer-offline
    }
    
    # Start frontend server
    Write-Host "🚀 Starting Frontend Server on http://localhost:5173" -ForegroundColor Green
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'G:\Bank web\frontend'; npm run dev"
    
    # Wait for servers to start
    Start-Sleep -Seconds 5
    
    Write-Host "`n🎉 Bank Recovery System is Starting!" -ForegroundColor Green
    Write-Host "📍 Frontend: http://localhost:5173" -ForegroundColor White
    Write-Host "📍 Backend API: http://localhost:3000" -ForegroundColor White
    Write-Host "📍 API Docs: http://localhost:3000/docs" -ForegroundColor White
    Write-Host "`n🔑 Demo Credentials:" -ForegroundColor Cyan
    Write-Host "Admin: admin@example.com / admin123" -ForegroundColor White
    Write-Host "Agent: agent1@example.com / agent123" -ForegroundColor White
    
    # Open browser
    Start-Process "http://localhost:5173"
    
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "`n📝 Try Manual Steps:" -ForegroundColor Yellow
    Write-Host "1. Open 2 PowerShell windows as Administrator" -ForegroundColor White
    Write-Host "2. Window 1: cd 'G:\Bank web\backend'; npm install; npm run dev" -ForegroundColor White
    Write-Host "3. Window 2: cd 'G:\Bank web\frontend'; npm install; npm run dev" -ForegroundColor White
}

Read-Host "`nPress Enter to continue..."