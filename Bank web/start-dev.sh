#!/bin/bash

echo "🏦 Bank Loan Recovery System - Development Setup"
echo "================================================"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your configuration before continuing."
    echo "   At minimum, set secure passwords for POSTGRES_PASSWORD and REDIS_PASSWORD"
    read -p "Press Enter when ready to continue..."
fi

echo "🔧 Starting development environment..."

# Start all services
docker-compose -f infra/docker-compose.dev.yml up -d

echo "⏳ Waiting for services to start..."
sleep 10

# Check if services are healthy
echo "🏥 Checking service health..."

# Check PostgreSQL
if docker-compose -f infra/docker-compose.dev.yml exec postgres pg_isready -U bankuser -d loan_recovery > /dev/null 2>&1; then
    echo "✅ PostgreSQL is ready"
else
    echo "❌ PostgreSQL is not ready. Check docker logs."
    exit 1
fi

# Check Redis
if docker-compose -f infra/docker-compose.dev.yml exec redis redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis is ready"
else
    echo "❌ Redis is not ready. Check docker logs."
    exit 1
fi

# Run database migrations
echo "🔄 Running database migrations..."
docker-compose -f infra/docker-compose.dev.yml exec backend npm run migrate
if [ $? -ne 0 ]; then
    echo "❌ Database migration failed."
    exit 1
fi

# Seed demo data
echo "🌱 Seeding demo data..."
docker-compose -f infra/docker-compose.dev.yml exec backend npm run seed
if [ $? -ne 0 ]; then
    echo "❌ Database seeding failed."
    exit 1
fi

echo "🚀 Development environment is ready!"
echo ""
echo "📍 Access URLs:"
echo "   Frontend:      http://localhost:5173"
echo "   Backend API:   http://localhost:3000"
echo "   API Docs:      http://localhost:3000/docs" 
echo "   Adminer:       http://localhost:8080"
echo "   Redis Admin:   http://localhost:8081"
echo ""
echo "🔑 Demo Login Credentials:"
echo "   Admin: admin@example.com / admin123"
echo "   Agent: agent1@example.com / agent123"
echo ""
echo "📝 To stop the environment:"
echo "   docker-compose -f infra/docker-compose.dev.yml down"
echo ""
echo "🔍 To view logs:"
echo "   docker-compose -f infra/docker-compose.dev.yml logs -f [service-name]"