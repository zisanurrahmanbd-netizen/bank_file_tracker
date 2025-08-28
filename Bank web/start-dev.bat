@echo off
echo 🏦 Bank Loan Recovery System - Development Setup
echo ================================================

REM Check if Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not running. Please start Docker and try again.
    pause
    exit /b 1
)

REM Check if .env file exists
if not exist .env (
    echo 📝 Creating .env file from template...
    copy .env.example .env
    echo ⚠️  Please edit .env file with your configuration before continuing.
    echo    At minimum, set secure passwords for POSTGRES_PASSWORD and REDIS_PASSWORD
    pause
)

echo 🔧 Starting development environment...

REM Start all services
docker-compose -f infra/docker-compose.dev.yml up -d

echo ⏳ Waiting for services to start...
timeout /t 10 /nobreak >nul

echo 🏥 Checking service health...

REM Check PostgreSQL
docker-compose -f infra/docker-compose.dev.yml exec postgres pg_isready -U bankuser -d loan_recovery >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ PostgreSQL is ready
) else (
    echo ❌ PostgreSQL is not ready
)

REM Check Redis
docker-compose -f infra/docker-compose.dev.yml exec redis redis-cli ping >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Redis is ready
) else (
    echo ❌ Redis is not ready
)

REM Run database migrations
echo 🔄 Running database migrations...
docker-compose -f infra/docker-compose.dev.yml exec backend npm run migrate

REM Seed demo data
echo 🌱 Seeding demo data...
docker-compose -f infra/docker-compose.dev.yml exec backend npm run seed

echo.
echo 🚀 Development environment is ready!
echo.
echo 📍 Access URLs:
echo    Frontend:      http://localhost:5173
echo    Backend API:   http://localhost:3000
echo    API Docs:      http://localhost:3000/docs
echo    Adminer:       http://localhost:8080
echo    Redis Admin:   http://localhost:8081
echo.
echo 🔑 Demo Login Credentials:
echo    Admin: admin@example.com / admin123
echo    Agent: agent1@example.com / agent123
echo.
echo 📝 To stop the environment:
echo    docker-compose -f infra/docker-compose.dev.yml down
echo.
echo 🔍 To view logs:
echo    docker-compose -f infra/docker-compose.dev.yml logs -f [service-name]
echo.
pause