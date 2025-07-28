FROM node:18-alpine AS build

WORKDIR /app

# Copy package files from frontend directory
COPY frontend/package*.json ./
RUN npm ci

# Copy all frontend files
COPY frontend/ ./
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/nginx.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]