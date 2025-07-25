# Live Coding Collaborative Editor

Collaborative real-time code editor with cursor tracking and text synchronization.

## Features

- 🚀 Real-time collaborative editing
- 👥 Multi-user cursor tracking with user labels  
- 🎨 Syntax highlighting for multiple languages
- 💾 Auto-save to database
- 🔄 Operational transformation for cursor positions
- 🌐 WebSocket-based communication

## Development Setup

### Prerequisites
- Docker
- Docker Compose

### Quick Start

#### Development Mode (with hot reload)
```bash
# Interactive mode (shows logs, press Ctrl+C to stop)
./dev.sh

# Background mode (runs in background)
./dev-detached.sh
```
This will start:
- Frontend: http://localhost:3001 (with hot reload)
- Backend: http://localhost:3000 (with hot reload)
- PostgreSQL: localhost:5432

#### Production Mode
```bash
./prod.sh
```
This will start:
- Frontend: http://localhost:80 (optimized build with nginx)
- Backend: http://localhost:3000 (compiled)
- PostgreSQL: localhost:5432

## Development Workflow

1. Make changes to source code in `./frontend/src` or `./backend/src`
2. Changes are automatically reflected in running containers
3. No need to rebuild containers for code changes
4. Database data persists between container restarts

## Architecture

### Backend (NestJS)
- **Framework**: NestJS with TypeScript
- **Database**: PostgreSQL with Sequelize ORM
- **WebSockets**: Socket.io for real-time communication
- **Hot Reload**: nodemon + ts-node in development

### Frontend (React)
- **Framework**: React with TypeScript
- **State Management**: Redux Toolkit
- **Styling**: CSS with syntax highlighting
- **Hot Reload**: React development server