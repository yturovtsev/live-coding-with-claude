#!/bin/bash

echo "🚀 Starting development environment in background..."

# Stop any existing containers
docker-compose -f docker-compose.dev.yml down

# Build and start development containers in detached mode
docker-compose -f docker-compose.dev.yml up --build -d

echo "✅ Development environment started in background!"
echo "📝 Frontend: http://localhost:3001"
echo "🔧 Backend: http://localhost:3000"
echo "🗄️ PostgreSQL: localhost:5432"
echo ""
echo "To view logs: docker-compose -f docker-compose.dev.yml logs -f"
echo "To stop: docker-compose -f docker-compose.dev.yml down"