#!/bin/bash

echo "🚀 Starting development environment..."

# Stop any existing containers
docker-compose -f docker-compose.dev.yml down

echo "📝 Frontend will be available at: http://localhost:3001"
echo "🔧 Backend will be available at: http://localhost:3000"
echo "🗄️ PostgreSQL available at: localhost:5432"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Build and start development containers in foreground
docker-compose -f docker-compose.dev.yml up --build
