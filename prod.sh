#!/bin/bash

echo "🏭 Starting production environment..."

# Stop any existing containers
docker-compose down

# Build and start production containers
docker-compose up --build -d

echo "✅ Production environment started!"
echo "🌐 Frontend: http://localhost:80"
echo "🔧 Backend: http://localhost:3000"
echo "🗄️ PostgreSQL: localhost:5432"