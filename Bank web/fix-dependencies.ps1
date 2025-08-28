# PowerShell script to fix TypeScript dependency issues
# Run this as Administrator

Write-Host "🔧 Fixing TypeScript Dependencies - Bank Recovery System" -ForegroundColor Green
Write-Host "=" * 60

# Function to check if running as admin
function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Check admin privileges
if (-not (Test-Administrator)) {
    Write-Host "❌ This script needs to run as Administrator" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Set execution policy temporarily
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process -Force

try {
    # Navigate to project root
    $projectRoot = "G:\Bank web"
    if (-not (Test-Path $projectRoot)) {
        throw "Project directory not found: $projectRoot"
    }
    
    Write-Host "📂 Project found at: $projectRoot" -ForegroundColor Green
    
    # Backend installation
    Write-Host "`n📦 Installing Backend Dependencies..." -ForegroundColor Cyan
    Set-Location "$projectRoot\backend"
    
    # Clear npm cache
    npm cache clean --force
    
    # Remove existing node_modules if they exist
    if (Test-Path "node_modules") {
        Write-Host "🗑️ Removing existing node_modules..." -ForegroundColor Yellow
        Remove-Item -Recurse -Force "node_modules" -ErrorAction SilentlyContinue
    }
    
    if (Test-Path "package-lock.json") {
        Remove-Item "package-lock.json" -ErrorAction SilentlyContinue
    }
    
    # Install with specific npm configuration
    npm config set fund false
    npm config set audit false
    npm install --no-optional --prefer-offline
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Backend dependencies installed successfully!" -ForegroundColor Green
    } else {
        throw "Backend npm install failed"
    }
    
    # Frontend installation
    Write-Host "`n📦 Installing Frontend Dependencies..." -ForegroundColor Cyan
    Set-Location "$projectRoot\frontend"
    
    # Clear and install frontend
    if (Test-Path "node_modules") {
        Remove-Item -Recurse -Force "node_modules" -ErrorAction SilentlyContinue
    }
    
    if (Test-Path "package-lock.json") {
        Remove-Item "package-lock.json" -ErrorAction SilentlyContinue
    }
    
    npm install --no-optional --prefer-offline
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Frontend dependencies installed successfully!" -ForegroundColor Green
    } else {
        throw "Frontend npm install failed"
    }
    
    # Verify TypeScript compilation
    Write-Host "`n🔧 Verifying TypeScript Compilation..." -ForegroundColor Cyan
    Set-Location "$projectRoot\backend"
    npm run build
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ TypeScript compilation successful!" -ForegroundColor Green
        Write-Host "`n🎉 All 1000+ problems should now be resolved!" -ForegroundColor Green
    } else {
        Write-Host "⚠️ TypeScript compilation has some issues, but dependencies are installed" -ForegroundColor Yellow
    }
    
    Write-Host "`n📋 Next Steps:" -ForegroundColor Cyan
    Write-Host "1. Restart your IDE/VS Code" -ForegroundColor White
    Write-Host "2. Open the project and check for remaining TypeScript errors" -ForegroundColor White
    Write-Host "3. Start development server: npm run dev (in backend folder)" -ForegroundColor White
    Write-Host "4. Start frontend: npm run dev (in frontend folder)" -ForegroundColor White
    
} catch {
    Write-Host "`n❌ Error occurred: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "`n🔧 Manual Steps:" -ForegroundColor Yellow
    Write-Host "1. Open Command Prompt as Administrator" -ForegroundColor White
    Write-Host "2. cd /d `"G:\Bank web\backend`"" -ForegroundColor White
    Write-Host "3. npm install" -ForegroundColor White
    Write-Host "4. cd /d `"G:\Bank web\frontend`"" -ForegroundColor White
    Write-Host "5. npm install" -ForegroundColor White
} finally {
    Write-Host "`nPress Enter to continue..." -ForegroundColor Gray
    Read-Host
}