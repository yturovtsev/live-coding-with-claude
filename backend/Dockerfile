FROM node:18-alpine

WORKDIR /app

# Copy package.json from backend directory
COPY backend/package.json ./
RUN npm install

# Copy all backend files
COPY backend/ ./
RUN npm run build

# Remove dev dependencies after build
RUN npm prune --production

EXPOSE 3000

CMD ["npm", "start"]