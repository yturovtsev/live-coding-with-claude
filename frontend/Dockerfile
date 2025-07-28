FROM node:18-alpine AS build

WORKDIR /app

# Copy package files - handle both cases (from root or from frontend dir)
COPY package*.json ./
RUN npm ci

# Copy all files
COPY . ./

# Build args for environment variables
ARG REACT_APP_API_URL
ARG REACT_APP_SOCKET_URL

# Set environment variables for build
ENV REACT_APP_API_URL=$REACT_APP_API_URL
ENV REACT_APP_SOCKET_URL=$REACT_APP_SOCKET_URL

# Debug: show environment variables during build
RUN echo "Build env vars:" && echo "REACT_APP_API_URL=$REACT_APP_API_URL" && echo "REACT_APP_SOCKET_URL=$REACT_APP_SOCKET_URL"

RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]