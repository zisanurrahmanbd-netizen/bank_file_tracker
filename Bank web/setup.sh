#!/bin/bash

echo "🏦 Bank Loan Recovery System - Environment Setup"
echo "================================================"

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend
npm install

# Install frontend dependencies  
echo "📦 Installing frontend dependencies..."
cd ../frontend
npm install

# Go back to root
cd ..

echo "✅ Dependencies installed successfully!"
echo ""
echo "🚀 To start development:"
echo "   Run: npm run dev:backend (in backend folder)"
echo "   Run: npm run dev (in frontend folder)"
echo "   Or use Docker: ./start-dev.bat"